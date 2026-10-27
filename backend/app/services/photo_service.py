import hashlib
import os
import secrets
import string
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Barathon, BarathonParticipant, User, PhotoSecureGuest
from app.photo_models import (
    PhotoAnswer,
    PhotoAudience,
    PhotoChallenge,
    PhotoMedia,
    PhotoRateEvent,
    PhotoResult,
)
from app.photo_schemas import (
    PhotoAnswerPayload,
    PhotoChallengeCreate,
    PhotoChallengeItemRead,
    PhotoDraftResponse,
    PhotoMysteryStateResponse,
    PhotoPublishPayload,
    PhotoResultRead,
    PhotoSubmissionRead,
)
from app.security import create_access_token, decode_access_token
from app.services.photo_processor import process_photo
from app.services.photo_purge import cleanup_orphaned_files
from app.services.photo_storage import decrypt_media, delete_file, encrypt_and_store
from app.websocket.registry import ws_manager


UPLOAD_CODE_ALPHABET = string.ascii_uppercase + string.digits  # 36 chars, 10 chars = 36^10 ~ 3.65 x 10^15 > 2^51 (~51.7 bits)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_photo_enabled(barathon_id: int) -> bool:
    """Vérifie le Feature Flag serveur et l'allowlist."""
    flag = os.getenv("PHOTO_MYSTERY_ENABLED", "false").lower() in ("true", "1", "yes")
    if not flag:
        return False
    allowlist_str = os.getenv("PHOTO_MYSTERY_ALLOWLIST", "").strip()
    if not allowlist_str:
        return False
    allowlist_ids = [s.strip() for s in allowlist_str.split(",") if s.strip()]
    return str(barathon_id) in allowlist_ids or "*" in allowlist_ids


def check_eligibility(db: Session, user: User, barathon_id: int) -> bool:
    """
    Règle stricte d'éligibilité :
    - Utilisateurs enregistrés : toujours éligibles.
    - Invités : UNIQUEMENT s'ils ont été créés via le flux sécurisé (présents dans photo_secure_guests).
    """
    if not user.is_guest:
        return True
    secure = db.scalar(
        select(PhotoSecureGuest).where(
            PhotoSecureGuest.user_id == user.id,
            PhotoSecureGuest.barathon_id == barathon_id,
        )
    )
    return secure is not None


def get_participant_membership(db: Session, barathon_id: int, user_id: int) -> Optional[BarathonParticipant]:
    return db.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == barathon_id,
            BarathonParticipant.user_id == user_id,
        )
    )


def check_rate_limits(db: Session, user_id: int, kind: str) -> None:
    """
    Vérifie les quotas de création et de publication :
    - Max 3 créations de draft en 10 minutes.
    - Max 5 publications en 1 heure.
    - Max 1 publication par minute.
    """
    now = utc_now()
    if kind == "draft_create":
        ten_min_ago = now - timedelta(minutes=10)
        recent_count = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "draft_create",
                PhotoRateEvent.occurred_at >= ten_min_ago,
            )
        ) or 0
        if recent_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite de création de défis atteinte (max 3 par 10 minutes).",
            )
    elif kind == "publish":
        one_min_ago = now - timedelta(minutes=1)
        one_min_count = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "publish",
                PhotoRateEvent.occurred_at >= one_min_ago,
            )
        ) or 0
        if one_min_count >= 1:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Veuillez patienter 1 minute entre deux publications.",
            )
        one_hour_ago = now - timedelta(hours=1)
        one_hour_count = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "publish",
                PhotoRateEvent.occurred_at >= one_hour_ago,
            )
        ) or 0
        if one_hour_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite horaire de publication atteinte (max 5 par heure).",
            )


class PhotoService:
    @staticmethod
    def get_state(
        db: Session,
        barathon: Barathon,
        current_user: User,
    ) -> PhotoMysteryStateResponse:
        enabled = is_photo_enabled(barathon.id)
        eligible = check_eligibility(db, current_user, barathon.id)

        # Si le jeu est désactivé ou l'utilisateur non éligible
        if not enabled or not eligible or barathon.status != "started":
            return PhotoMysteryStateResponse(
                server_time=utc_now(),
                enabled=enabled and eligible and barathon.status == "started",
                can_create=False,
                pending_count=0,
                unseen_results_count=0,
                items=[],
            )

        # Vérifier et finaliser les défis expirés avant de lire
        PhotoService.finalize_expired_challenges(db, barathon.id)

        # Récupérer les défis du barathon (actifs et récents clos)
        challenges = db.scalars(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.barathon_id == barathon.id,
                PhotoChallenge.state.in_(["draft", "published", "closed"]),
            )
            .order_by(PhotoChallenge.created_at.desc())
        ).all()

        items: List[PhotoChallengeItemRead] = []
        pending_count = 0

        for ch in challenges:
            # Pour un draft : visible uniquement par l'auteur
            if ch.state == "draft":
                if ch.creator_user_id == current_user.id:
                    has_media = ch.media and any(m.state == "ready" for m in ch.media)
                    items.append(
                        PhotoChallengeItemRead(
                            id=ch.id,
                            version=ch.version,
                            state="draft",
                            question=ch.question,
                            options=ch.options,
                            correct_index=None,  # Ne jamais dévoiler en dehors de closed
                            expires_at=ch.draft_expires_at,
                            my_submission=None,
                            can_answer=False,
                            photo_available=bool(has_media),
                        )
                    )
                continue

            # Pour published ou closed : l'utilisateur doit être dans l'audience
            aud = db.scalar(
                select(PhotoAudience).where(
                    PhotoAudience.challenge_id == ch.id,
                    PhotoAudience.user_id == current_user.id,
                    PhotoAudience.revoked_at.is_(None),
                )
            )
            if not aud:
                continue

            # Vérification de la soumission de l'utilisateur
            sub = db.scalar(
                select(PhotoAnswer).where(
                    PhotoAnswer.challenge_id == ch.id,
                    PhotoAnswer.audience_id == aud.id,
                )
            )
            my_submission = (
                PhotoSubmissionRead(
                    choice_index=sub.choice_index,
                    passed=sub.passed,
                    submitted_at=sub.submitted_at,
                )
                if sub
                else None
            )

            # can_answer : défi publié, utilisateur non créateur, pas encore répondu
            can_answer = (
                ch.state == "published"
                and not aud.is_creator
                and my_submission is None
                and ch.expires_at is not None
                and utc_now() < ensure_utc(ch.expires_at)
            )

            if can_answer:
                pending_count += 1

            has_media = ch.media and any(m.state == "ready" for m in ch.media)

            # Révélation de la bonne réponse et des résultats UNIQUEMENT si le défi est 'closed'
            results_dto = None
            revealed_correct_index = None

            if ch.state == "closed":
                revealed_correct_index = ch.correct_index
                if ch.results:
                    results_dto = PhotoResultRead(
                        closed_at=ch.results.closed_at,
                        reason=ch.results.reason,
                        expected_count=ch.results.expected_count,
                        correct_count=ch.results.correct_count,
                        incorrect_count=ch.results.incorrect_count,
                        passed_count=ch.results.passed_count,
                        creator_dare=ch.results.creator_dare,
                        my_dare_assigned=aud.dare_assigned,
                    )

            items.append(
                PhotoChallengeItemRead(
                    id=ch.id,
                    version=ch.version,
                    state=ch.state,
                    question=ch.question,
                    options=ch.options,
                    correct_index=revealed_correct_index,
                    expires_at=ch.expires_at,
                    my_submission=my_submission,
                    can_answer=can_answer,
                    photo_available=bool(has_media),
                    results=results_dto,
                )
            )

        # Peut créer s'il n'y a pas déjà de draft en cours par cet auteur
        has_active_draft = any(
            c.state == "draft" and c.creator_user_id == current_user.id for c in challenges
        )
        has_published = any(c.state == "published" for c in challenges)
        can_create = (not has_active_draft) and (not has_published)

        return PhotoMysteryStateResponse(
            server_time=utc_now(),
            enabled=True,
            can_create=can_create,
            pending_count=pending_count,
            unseen_results_count=0,
            items=items,
        )

    @staticmethod
    def create_draft(
        db: Session,
        barathon: Barathon,
        creator: User,
        payload: PhotoChallengeCreate,
        idempotency_key: uuid.UUID,
    ) -> PhotoDraftResponse:
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )
        if not check_eligibility(db, creator, barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Compte non éligible à Photo Mystère.",
            )
        if barathon.status != "started":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le barathon doit être en cours pour créer un défi.",
            )

        membership = get_participant_membership(db, barathon.id, creator.id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous devez participer à ce barathon.",
            )

        # Vérifier les quotas
        check_rate_limits(db, creator.id, "draft_create")

        # Vérifier si l'auteur a déjà un draft actif
        existing_draft = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.creator_user_id == creator.id,
                PhotoChallenge.state == "draft",
                PhotoChallenge.draft_expires_at > utc_now(),
            )
        )
        if existing_draft:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vous avez déjà un défi en cours de création.",
            )

        # Vérifier qu'aucun défi n'est publié actuellement dans ce barathon
        active_published = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.barathon_id == barathon.id,
                PhotoChallenge.state == "published",
                PhotoChallenge.expires_at > utc_now(),
            )
        )
        if active_published:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un défi est déjà en cours dans ce barathon.",
            )

        # Générer le code d'upload (10 caractères alphanumériques aléatoires)
        raw_code = "".join(secrets.choice(UPLOAD_CODE_ALPHABET) for _ in range(10))
        code_hash = hashlib.sha256(raw_code.encode("utf-8")).hexdigest()

        now = utc_now()
        draft_expires = now + timedelta(minutes=15)
        code_expires = now + timedelta(minutes=2)
        retention = now + timedelta(hours=24)

        challenge = PhotoChallenge(
            id=uuid.uuid4(),
            barathon_id=barathon.id,
            creator_user_id=creator.id,
            creator_membership_id=membership.id,
            state="draft",
            question=payload.question.strip(),
            options=payload.options,
            correct_index=payload.correct_index,
            create_key=idempotency_key,
            create_fingerprint=code_hash,
            upload_code_hash=code_hash,
            code_expires_at=code_expires,
            notice_version=payload.notice_version,
            created_at=now,
            draft_expires_at=draft_expires,
            retention_until=retention,
        )
        db.add(challenge)

        # Enregistrer l'événement de rate limit
        rate_event = PhotoRateEvent(
            user_id=creator.id,
            operation_id=challenge.id,
            kind="draft_create",
            occurred_at=now,
        )
        db.add(rate_event)
        db.commit()
        db.refresh(challenge)

        return PhotoDraftResponse(
            id=challenge.id,
            state=challenge.state,
            upload_code=raw_code,
            code_expires_at=code_expires,
            draft_expires_at=draft_expires,
            notice_version=challenge.notice_version,
        )

    @staticmethod
    def claim_upload_code(
        db: Session,
        code: str,
    ) -> Tuple[str, uuid.UUID, datetime]:
        """
        Échange atomique à usage unique du code à 10 caractères contre un jeton de capacité d'upload.
        """
        clean_code = code.strip().upper()
        if len(clean_code) != 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code invalide (10 caractères requis).",
            )

        code_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()
        now = utc_now()

        # Recherche du draft correspondant
        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.upload_code_hash == code_hash,
                PhotoChallenge.state == "draft",
                PhotoChallenge.code_expires_at > now,
            )
        )
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Code invalide ou expiré.",
            )

        # Consommation atomique : on efface le hash pour empêcher toute réutilisation
        challenge.upload_code_hash = None
        db.commit()

        # Émission d'un token de capacité temporaire (scope "photo_upload", validité 5 minutes)
        upload_expires = now + timedelta(minutes=5)
        upload_token = create_access_token(
            data={
                "sub": f"upload:{challenge.creator_user_id}",
                "challenge_id": str(challenge.id),
                "scope": "photo_upload",
            },
            expires_delta=timedelta(minutes=5),
        )

        return upload_token, challenge.id, upload_expires

    @staticmethod
    def upload_photo(
        db: Session,
        challenge_id: uuid.UUID,
        raw_bytes: bytes,
        auth_context: dict,
    ) -> Tuple[uuid.UUID, int, int]:
        """
        Réception, validation, nettoyage Pillow, chiffrement AES-GCM et enregistrement du média.
        """
        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.state == "draft",
            )
        )
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Défi introuvable ou plus en état de brouillon.",
            )

        if ensure_utc(challenge.draft_expires_at) < utc_now():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Le brouillon a expiré.",
            )

        # Traitement Pillow (nettoyage EXIF, redimensionnement <= 1600, JPEG <= 512 KiB)
        try:
            clean_jpeg, width, height = process_photo(raw_bytes)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

        media_id = uuid.uuid4()
        storage_key, cipher_len = encrypt_and_store(media_id, clean_jpeg)

        # Enregistrement en base de la ligne photo_media
        purge_due = utc_now() + timedelta(hours=6)
        media_record = PhotoMedia(
            id=media_id,
            challenge_id=challenge.id,
            storage_key=storage_key,
            state="ready",
            cipher_bytes=cipher_len,
            jpeg_bytes=len(clean_jpeg),
            width=width,
            height=height,
            purge_due_at=purge_due,
        )
        db.add(media_record)
        challenge.version += 1
        db.commit()

        return media_id, width, height

    @staticmethod
    async def publish_challenge(
        db: Session,
        barathon: Barathon,
        challenge_id: uuid.UUID,
        user: User,
        payload: PhotoPublishPayload,
    ) -> PhotoChallengeItemRead:
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé.",
            )
        if barathon.status != "started":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le barathon doit être actif pour publier un défi.",
            )

        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
        )
        if not challenge or challenge.creator_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Défi introuvable ou vous n'en êtes pas l'auteur.",
            )

        if challenge.state != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le défi est déjà en état '{challenge.state}'.",
            )

        # Vérifier qu'une photo est bien prête
        has_ready_media = db.scalar(
            select(func.count(PhotoMedia.id)).where(
                PhotoMedia.challenge_id == challenge.id,
                PhotoMedia.state == "ready",
            )
        )
        if not has_ready_media:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune photo prête pour ce défi.",
            )

        # Vérifier quotas de publication
        check_rate_limits(db, user.id, "publish")

        # Figer l'audience : tous les participants éligibles actuels du barathon
        eligible_participants: List[BarathonParticipant] = []
        for p in barathon.participants:
            if p.user and check_eligibility(db, p.user, barathon.id):
                eligible_participants.append(p)

        respondents = [p for p in eligible_participants if p.user_id != user.id]
        if len(respondents) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Il faut au moins 1 autre participant éligible dans le barathon pour publier.",
            )
        if len(eligible_participants) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limite de 20 participants dépassée pour Photo Mystère.",
            )

        now = utc_now()
        challenge.state = "published"
        challenge.published_at = now
        challenge.expires_at = now + timedelta(minutes=3)
        challenge.expected_count = len(respondents)
        challenge.version += 1

        # Création des lignes d'audience figées
        for p in eligible_participants:
            is_creator = p.user_id == user.id
            aud = PhotoAudience(
                id=uuid.uuid4(),
                challenge_id=challenge.id,
                user_id=p.user_id,
                membership_id=p.id,
                is_creator=is_creator,
            )
            db.add(aud)

        # Rate limit event
        rate_ev = PhotoRateEvent(
            user_id=user.id,
            operation_id=challenge.id,
            kind="publish",
            occurred_at=now,
        )
        db.add(rate_ev)
        db.commit()
        db.refresh(challenge)

        # Notification WebSocket proactive à l'audience (/ws/me)
        for p in eligible_participants:
            try:
                await ws_manager.send_to_user(
                    p.user_id,
                    {
                        "type": "PHOTO_MYSTERY_UPDATE",
                        "barathon_id": barathon.id,
                        "challenge_id": str(challenge.id),
                        "action": "published",
                    },
                )
            except Exception:
                pass

        return PhotoChallengeItemRead(
            id=challenge.id,
            version=challenge.version,
            state=challenge.state,
            question=challenge.question,
            options=challenge.options,
            correct_index=None,  # Protégé
            expires_at=challenge.expires_at,
            my_submission=None,
            can_answer=False,  # Créateur ne peut pas répondre
            photo_available=True,
        )

    @staticmethod
    async def submit_answer(
        db: Session,
        barathon: Barathon,
        challenge_id: uuid.UUID,
        user: User,
        payload: PhotoAnswerPayload,
    ) -> PhotoChallengeItemRead:
        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
        )
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Défi introuvable.",
            )

        if challenge.state != "published":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce défi n'est plus ouvert aux réponses.",
            )

        if challenge.expires_at and utc_now() >= ensure_utc(challenge.expires_at):
            # Échéance dépassée
            PhotoService.finalize_challenge(db, challenge, reason="deadline")
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Le temps imparti pour répondre est écoulé.",
            )

        audience_entry = db.scalar(
            select(PhotoAudience).where(
                PhotoAudience.challenge_id == challenge.id,
                PhotoAudience.user_id == user.id,
                PhotoAudience.revoked_at.is_(None),
            )
        )
        if not audience_entry:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne faites pas partie de l'audience de ce défi.",
            )

        if audience_entry.is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="L'auteur du défi ne peut pas y répondre.",
            )

        # Vérifier si une réponse existe déjà
        existing_answer = db.scalar(
            select(PhotoAnswer).where(
                PhotoAnswer.challenge_id == challenge.id,
                PhotoAnswer.audience_id == audience_entry.id,
            )
        )
        if existing_answer:
            # Idempotence : si même réponse, renvoyer 200, sinon 409 Conflict
            if (
                existing_answer.passed == payload.passed
                and existing_answer.choice_index == payload.choice_index
            ):
                return PhotoChallengeItemRead(
                    id=challenge.id,
                    version=challenge.version,
                    state=challenge.state,
                    question=challenge.question,
                    options=challenge.options,
                    correct_index=None,
                    expires_at=challenge.expires_at,
                    my_submission=PhotoSubmissionRead(
                        choice_index=existing_answer.choice_index,
                        passed=existing_answer.passed,
                        submitted_at=existing_answer.submitted_at,
                    ),
                    can_answer=False,
                    photo_available=True,
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vous avez déjà répondu à ce défi.",
            )

        # Validation du choix si pas passed
        if not payload.passed:
            if payload.choice_index is None or payload.choice_index >= len(challenge.options):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Index de choix invalide.",
                )

        now = utc_now()
        answer = PhotoAnswer(
            challenge_id=challenge.id,
            audience_id=audience_entry.id,
            choice_index=payload.choice_index,
            passed=payload.passed,
            submitted_at=now,
        )
        db.add(answer)
        challenge.version += 1
        db.commit()

        # Vérifier si tous les répondants ont répondu
        respondents_count = challenge.expected_count or 1
        answers_count = db.scalar(
            select(func.count(PhotoAnswer.audience_id)).where(
                PhotoAnswer.challenge_id == challenge.id
            )
        ) or 0

        is_closed = False
        if answers_count >= respondents_count:
            PhotoService.finalize_challenge(db, challenge, reason="all_handled")
            is_closed = True

        # Notification WS
        for aud in challenge.audience:
            try:
                await ws_manager.send_to_user(
                    aud.user_id,
                    {
                        "type": "PHOTO_MYSTERY_UPDATE",
                        "barathon_id": barathon.id,
                        "challenge_id": str(challenge.id),
                        "action": "closed" if is_closed else "answered",
                    },
                )
            except Exception:
                pass

        return PhotoChallengeItemRead(
            id=challenge.id,
            version=challenge.version,
            state=challenge.state,
            question=challenge.question,
            options=challenge.options,
            correct_index=challenge.correct_index if is_closed else None,
            expires_at=challenge.expires_at,
            my_submission=PhotoSubmissionRead(
                choice_index=answer.choice_index,
                passed=answer.passed,
                submitted_at=answer.submitted_at,
            ),
            can_answer=False,
            photo_available=True,
        )

    @staticmethod
    def finalize_challenge(
        db: Session,
        challenge: PhotoChallenge,
        reason: str,
    ) -> None:
        """Clôture atomique du défi et calcul mathématique des résultats."""
        if challenge.state in ("closed", "cancelled", "expired"):
            return

        now = utc_now()
        answers = db.scalars(
            select(PhotoAnswer).where(PhotoAnswer.challenge_id == challenge.id)
        ).all()

        correct_count = 0
        incorrect_count = 0
        passed_count = 0

        correct_idx = challenge.correct_index

        for ans in answers:
            if ans.passed:
                passed_count += 1
            elif ans.choice_index == correct_idx:
                correct_count += 1
            else:
                incorrect_count += 1

        expected = challenge.expected_count or len(challenge.audience) - 1
        missing_count = max(0, expected - len(answers))

        # Règle ARCHITECTURE : si aucune réponse choisie (uniquement Pass ou Missing) -> expired
        if correct_count + incorrect_count == 0:
            challenge.state = "expired"
            challenge.terminal_at = now
            challenge.terminal_reason = "no_submissions"
            db.commit()
            return

        challenge.state = "closed"
        challenge.terminal_at = now
        challenge.terminal_reason = reason

        # Calcul des gages facultatifs :
        # Si 100% des répondants ont trouvé la bonne réponse -> gage créateur
        creator_dare = (correct_count == expected) and (expected > 0)

        # Attribution des gages aux répondants incorrects
        for aud in challenge.audience:
            if aud.is_creator:
                aud.dare_assigned = creator_dare
            else:
                user_ans = next((a for a in answers if a.audience_id == aud.id), None)
                if user_ans and not user_ans.passed and user_ans.choice_index != correct_idx:
                    aud.dare_assigned = True
                else:
                    aud.dare_assigned = False

        res = PhotoResult(
            challenge_id=challenge.id,
            closed_at=now,
            reason=reason,
            expected_count=expected,
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            passed_count=passed_count,
            missing_count=missing_count,
            creator_dare=creator_dare,
        )
        db.add(res)
        db.commit()

    @staticmethod
    def finalize_expired_challenges(db: Session, barathon_id: int) -> None:
        """Watcher appelé avant lecture pour garantir l'immutabilité temporelle."""
        now = utc_now()
        expired_challenges = db.scalars(
            select(PhotoChallenge).where(
                PhotoChallenge.barathon_id == barathon_id,
                PhotoChallenge.state == "published",
                PhotoChallenge.expires_at <= now,
            )
        ).all()
        for ch in expired_challenges:
            PhotoService.finalize_challenge(db, ch, reason="deadline")

    @staticmethod
    def get_photo_bytes(
        db: Session,
        barathon: Barathon,
        challenge_id: uuid.UUID,
        user: User,
    ) -> bytes:
        """
        Lecture sécurisée et déchiffrement de la photo pour l'audience autorisée.
        """
        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
        )
        if not challenge:
            raise HTTPException(status_code=404, detail="Défi introuvable.")

        # Vérifier l'appartenance à l'audience (ou auteur si draft)
        if challenge.state == "draft":
            if challenge.creator_user_id != user.id:
                raise HTTPException(status_code=403, detail="Accès refusé.")
        else:
            aud = db.scalar(
                select(PhotoAudience).where(
                    PhotoAudience.challenge_id == challenge.id,
                    PhotoAudience.user_id == user.id,
                    PhotoAudience.revoked_at.is_(None),
                )
            )
            if not aud:
                raise HTTPException(status_code=403, detail="Accès refusé.")

        # Règle de conservation : photo retirée 15 min après clôture
        if challenge.state == "closed" and challenge.terminal_at:
            if utc_now() > ensure_utc(challenge.terminal_at) + timedelta(minutes=15):
                raise HTTPException(status_code=404, detail="Photo expirée et purgée.")

        # Récupérer le média
        media = db.scalar(
            select(PhotoMedia).where(
                PhotoMedia.challenge_id == challenge.id,
                PhotoMedia.state == "ready",
            )
        )
        if not media:
            raise HTTPException(status_code=404, detail="Photo non disponible.")

        # Déchiffrement AES-GCM
        try:
            return decrypt_media(media.id, media.storage_key)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Erreur lors du déchiffrement du média.",
            )
