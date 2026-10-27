import hashlib
import logging
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
from app.services.photo_purge import cleanup_orphaned_files, purge_media_file
from app.services.photo_storage import decrypt_media, delete_file, encrypt_and_store
from app.websocket.registry import ws_manager

logger = logging.getLogger(__name__)

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


def check_active_participant(db: Session, barathon_id: int, user_id: int) -> BarathonParticipant:
    """Vérifie que l'utilisateur est un participant actif du barathon."""
    part = db.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == barathon_id,
            BarathonParticipant.user_id == user_id,
        )
    )
    if not part:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès interdit : vous n'êtes pas un participant actif de ce barathon.",
        )
    return part


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
        cutoff = now - timedelta(minutes=10)
        count = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "draft_create",
                PhotoRateEvent.occurred_at >= cutoff,
            )
        ) or 0
        if count >= 3:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de défis créés récemment (maximum 3 brouillons par 10 minutes).",
            )
    elif kind == "publish":
        cutoff_1h = now - timedelta(hours=1)
        count_1h = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "publish",
                PhotoRateEvent.occurred_at >= cutoff_1h,
            )
        ) or 0
        if count_1h >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de publications récentes (maximum 5 par heure).",
            )

        cutoff_1m = now - timedelta(minutes=1)
        count_1m = db.scalar(
            select(func.count(PhotoRateEvent.id)).where(
                PhotoRateEvent.user_id == user_id,
                PhotoRateEvent.kind == "publish",
                PhotoRateEvent.occurred_at >= cutoff_1m,
            )
        ) or 0
        if count_1m >= 1:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Veuillez patienter 1 minute entre deux publications.",
            )


def generate_secure_upload_code() -> str:
    """Génère un code à 10 caractères alphanumériques à haute entropie (> 51 bits)."""
    return "".join(secrets.choice(UPLOAD_CODE_ALPHABET) for _ in range(10))


class PhotoService:
    utc_now = staticmethod(utc_now)

    @staticmethod
    def revoke_participant_photo_access(db: Session, barathon_id: int, user_id: int) -> None:
        """
        Révocation immédiate des droits photo d'un participant (exclusion, départ ou suppression).
        1. Marque revoked_at sur toutes les audiences de défis dans ce barathon.
        2. Annule tous les drafts créés par cet utilisateur dans ce barathon et purge leurs médias.
        """
        now = utc_now()
        audiences = db.scalars(
            select(PhotoAudience)
            .join(PhotoChallenge, PhotoChallenge.id == PhotoAudience.challenge_id)
            .where(
                PhotoChallenge.barathon_id == barathon_id,
                PhotoAudience.user_id == user_id,
                PhotoAudience.revoked_at.is_(None),
            )
        ).all()
        for aud in audiences:
            aud.revoked_at = now

        user_challenges = db.scalars(
            select(PhotoChallenge).where(
                PhotoChallenge.barathon_id == barathon_id,
                PhotoChallenge.creator_user_id == user_id,
                PhotoChallenge.state.in_(["draft", "published"]),
            )
        ).all()
        for ch in user_challenges:
            ch.state = "cancelled"
            ch.terminal_at = now
            ch.terminal_reason = "creator_revoked"
            ch.content_removed_at = now
            ch.upload_code_hash = None
            ch.upload_claim_id = None
            medias = db.scalars(select(PhotoMedia).where(PhotoMedia.challenge_id == ch.id)).all()
            for m in medias:
                m.state = "delete_pending"
                purge_media_file(m.storage_key)
                m.state = "deleted"
                m.deleted_at = now

        db.commit()

    @staticmethod
    def revoke_all_barathon_photos(db: Session, barathon_id: int) -> None:
        """
        Appelé lors de l'arrêt, fin ou suppression d'un barathon :
        Annule tous les drafts et défis ouverts, et purge toutes les photos.
        """
        now = utc_now()
        challenges = db.scalars(
            select(PhotoChallenge).where(PhotoChallenge.barathon_id == barathon_id)
        ).all()
        for ch in challenges:
            if ch.state in ("draft", "published"):
                ch.state = "cancelled"
                ch.terminal_at = now
                ch.terminal_reason = "barathon_ended"
                ch.content_removed_at = now
                ch.upload_code_hash = None
                ch.upload_claim_id = None
            medias = db.scalars(select(PhotoMedia).where(PhotoMedia.challenge_id == ch.id)).all()
            for m in medias:
                m.state = "delete_pending"
                purge_media_file(m.storage_key)
                m.state = "deleted"
                m.deleted_at = now
        db.commit()

    @staticmethod
    def revoke_user_all_photos(db: Session, user_id: int) -> None:
        """Appelé lors de la suppression d'un compte utilisateur (RGPD /me)."""
        now = utc_now()
        audiences = db.scalars(
            select(PhotoAudience).where(
                PhotoAudience.user_id == user_id,
                PhotoAudience.revoked_at.is_(None),
            )
        ).all()
        for aud in audiences:
            aud.revoked_at = now

        user_challenges = db.scalars(
            select(PhotoChallenge).where(
                PhotoChallenge.creator_user_id == user_id,
                PhotoChallenge.state.in_(["draft", "published"]),
            )
        ).all()
        for ch in user_challenges:
            ch.state = "cancelled"
            ch.terminal_at = now
            ch.terminal_reason = "account_deleted"
            ch.content_removed_at = now
            ch.upload_code_hash = None
            ch.upload_claim_id = None
            medias = db.scalars(select(PhotoMedia).where(PhotoMedia.challenge_id == ch.id)).all()
            for m in medias:
                m.state = "delete_pending"
                purge_media_file(m.storage_key)
                m.state = "deleted"
                m.deleted_at = now
        db.commit()

    @staticmethod
    def get_state(
        db: Session,
        barathon: Barathon,
        current_user: User,
    ) -> PhotoMysteryStateResponse:
        """
        Calcule l'état personnalisé Photo Mystère pour l'utilisateur courant.
        """
        enabled = is_photo_enabled(barathon.id)
        if not enabled:
            return PhotoMysteryStateResponse(
                server_time=utc_now(),
                enabled=False,
                can_create=False,
                pending_count=0,
                unseen_results_count=0,
                items=[],
            )

        check_active_participant(db, barathon.id, current_user.id)

        if not check_eligibility(db, current_user, barathon.id):
            return PhotoMysteryStateResponse(
                server_time=utc_now(),
                enabled=False,
                can_create=False,
                pending_count=0,
                unseen_results_count=0,
                items=[],
            )

        # Clôturer d'abord les défis expirés pour ce barathon
        PhotoService.finalize_expired_challenges(db, barathon.id)

        # Récupérer les défis du barathon
        challenges = db.scalars(
            select(PhotoChallenge)
            .where(PhotoChallenge.barathon_id == barathon.id)
            .order_by(PhotoChallenge.created_at.desc())
        ).all()

        items: List[PhotoChallengeItemRead] = []
        pending_count = 0

        now = utc_now()

        for ch in challenges:
            if ch.state == "draft":
                if ch.creator_user_id == current_user.id:
                    if ch.draft_expires_at and ensure_utc(ch.draft_expires_at) <= now:
                        continue
                    has_media = db.scalar(
                        select(PhotoMedia.id).where(
                            PhotoMedia.challenge_id == ch.id,
                            PhotoMedia.state == "ready",
                        )
                    )
                    items.append(
                        PhotoChallengeItemRead(
                            id=ch.id,
                            version=ch.version,
                            state="draft",
                            question=ch.question,
                            options=ch.options,
                            correct_index=None,
                            expires_at=ch.draft_expires_at,
                            my_submission=None,
                            can_answer=False,
                            photo_available=bool(has_media),
                        )
                    )
                continue

            aud = db.scalar(
                select(PhotoAudience).where(
                    PhotoAudience.challenge_id == ch.id,
                    PhotoAudience.user_id == current_user.id,
                    PhotoAudience.revoked_at.is_(None),
                )
            )
            if not aud:
                continue

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

            can_answer = (
                ch.state == "published"
                and not aud.is_creator
                and my_submission is None
                and ch.expires_at is not None
                and now < ensure_utc(ch.expires_at)
            )

            if can_answer:
                pending_count += 1

            has_media = db.scalar(
                select(PhotoMedia.id).where(
                    PhotoMedia.challenge_id == ch.id,
                    PhotoMedia.state == "ready",
                )
            )

            is_closed = ch.state == "closed"
            result_read = None
            if is_closed and ch.results:
                res = ch.results
                result_read = PhotoResultRead(
                    closed_at=res.closed_at,
                    reason=res.reason,
                    expected_count=res.expected_count,
                    correct_count=res.correct_count,
                    incorrect_count=res.incorrect_count,
                    passed_count=res.passed_count,
                    missing_count=res.missing_count,
                    creator_dare=res.creator_dare,
                    my_dare_assigned=bool(aud.dare_assigned),
                )

            items.append(
                PhotoChallengeItemRead(
                    id=ch.id,
                    version=ch.version,
                    state=ch.state,
                    question=ch.question,
                    options=ch.options,
                    correct_index=ch.correct_index if is_closed else None,
                    expires_at=ch.expires_at,
                    my_submission=my_submission,
                    results=result_read,
                    can_answer=can_answer,
                    photo_available=bool(has_media),
                )
            )

        has_active_draft = any(
            c.state == "draft" and c.creator_user_id == current_user.id for c in challenges
        )
        has_published = any(c.state == "published" for c in challenges)
        can_create = (not has_active_draft) and (not has_published)

        return PhotoMysteryStateResponse(
            server_time=now,
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
        now = utc_now()
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        check_active_participant(db, barathon.id, creator.id)

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

        # Quota barathon (max 10 défis actifs)
        active_count = db.scalar(
            select(func.count(PhotoChallenge.id)).where(
                PhotoChallenge.barathon_id == barathon.id,
                PhotoChallenge.state.in_(["draft", "published"]),
            )
        ) or 0
        if active_count >= 10:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite de défis simultanés atteinte pour ce barathon (maximum 10).",
            )

        check_rate_limits(db, creator.id, "draft_create")

        existing_draft = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.creator_user_id == creator.id,
                PhotoChallenge.state == "draft",
                PhotoChallenge.draft_expires_at > now,
            )
        )
        if existing_draft:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vous avez déjà un défi en cours de création.",
            )

        existing_published = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.barathon_id == barathon.id,
                PhotoChallenge.state == "published",
            )
        )
        if existing_published:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un défi est déjà en cours dans ce barathon.",
            )

        raw_code = generate_secure_upload_code()
        code_hash = hashlib.sha256(raw_code.encode("utf-8")).hexdigest()

        code_expires = now + timedelta(minutes=15)
        draft_expires = now + timedelta(minutes=15)
        retention = now + timedelta(hours=24)

        part = get_participant_membership(db, barathon.id, creator.id)

        challenge = PhotoChallenge(
            id=uuid.uuid4(),
            barathon_id=barathon.id,
            creator_user_id=creator.id,
            creator_membership_id=part.id if part else None,
            state="draft",
            question=payload.question,
            options=payload.options,
            correct_index=payload.correct_index,
            create_key=idempotency_key,
            create_fingerprint=f"draft_{creator.id}_{int(now.timestamp())}",
            upload_code_hash=code_hash,
            code_expires_at=code_expires,
            notice_version=payload.notice_version,
            draft_expires_at=draft_expires,
            retention_until=retention,
        )
        db.add(challenge)

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

        challenge = db.scalar(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.upload_code_hash == code_hash,
                PhotoChallenge.state == "draft",
            )
            .with_for_update()
        )
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Code invalide ou expiré.",
            )

        # 1. Feature flag
        if not is_photo_enabled(challenge.barathon_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        # 2. Expirations
        if challenge.code_expires_at and ensure_utc(challenge.code_expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Le code d'upload a expiré.")
        if ensure_utc(challenge.draft_expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Le brouillon a expiré.")

        # 3. Vérification créateur toujours participant actif
        check_active_participant(db, challenge.barathon_id, challenge.creator_user_id)

        # 4. Consommation atomique du code et génération du nonce unique
        claim_nonce = uuid.uuid4()
        claim_expires = now + timedelta(minutes=5)
        challenge.upload_code_hash = None
        challenge.upload_claim_id = claim_nonce
        challenge.upload_claim_expires_at = claim_expires
        challenge.upload_claim_consumed_at = None
        db.commit()

        upload_token = create_access_token(
            data={
                "sub": f"upload:{challenge.creator_user_id}",
                "challenge_id": str(challenge.id),
                "jti": str(claim_nonce),
                "scope": "photo_upload",
            },
            expires_delta=timedelta(minutes=5),
        )

        return upload_token, challenge.id, claim_expires

    @staticmethod
    def upload_photo(
        db: Session,
        challenge_id: uuid.UUID,
        raw_bytes: bytes,
        auth_context: dict,
    ) -> Tuple[uuid.UUID, int, int]:
        """
        Réception, validation, nettoyage Pillow, chiffrement AES-GCM et enregistrement du média.
        Usage unique strict du jeton de capacité (anti-rejeu).
        """
        now = utc_now()

        challenge = db.scalar(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.state == "draft",
            )
            .with_for_update()
        )
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Défi introuvable ou plus en état de brouillon.",
            )

        # 1. Feature flag
        if not is_photo_enabled(challenge.barathon_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        # 2. Expiration brouillon
        if ensure_utc(challenge.draft_expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Le brouillon a expiré.")

        # 3. Vérification créateur toujours participant actif
        check_active_participant(db, challenge.barathon_id, challenge.creator_user_id)

        # 4. Validation capacité unique (jti)
        token_jti = auth_context.get("jti")
        if not token_jti or not challenge.upload_claim_id or str(challenge.upload_claim_id) != token_jti:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Jeton de capacité d'upload invalide, déjà consommé ou révoqué.",
            )
        if challenge.upload_claim_consumed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cette capacité d'upload a déjà été consommée.",
            )
        if challenge.upload_claim_expires_at and ensure_utc(challenge.upload_claim_expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="La capacité d'upload a expiré.")

        # Consommation atomique immédiate
        challenge.upload_claim_consumed_at = now
        challenge.upload_claim_id = None

        # 5. Traitement Pillow (nettoyage EXIF, redimensionnement <= 1600, JPEG <= 512 KiB)
        try:
            clean_jpeg, width, height = process_photo(raw_bytes)
        except ValueError as exc:
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

        # 6. Purge de tout ancien média attaché à ce brouillon
        old_medias = db.scalars(
            select(PhotoMedia).where(PhotoMedia.challenge_id == challenge.id)
        ).all()
        for om in old_medias:
            om.state = "delete_pending"
            purge_media_file(om.storage_key)
            om.state = "deleted"
            om.deleted_at = now

        # 7. Chiffrement et stockage AES-GCM (avec contrôle de capacité RAM)
        media_id = uuid.uuid4()
        try:
            storage_key, cipher_len = encrypt_and_store(media_id, clean_jpeg)
        except OSError as exc:
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            )

        purge_due = now + timedelta(hours=6)
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
        check_active_participant(db, barathon.id, user.id)

        if barathon.status != "started":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le barathon doit être actif pour publier un défi.",
            )

        check_rate_limits(db, user.id, "publish")

        now = utc_now()
        challenge = db.scalar(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
            .with_for_update()
        )
        if not challenge:
            raise HTTPException(status_code=404, detail="Défi introuvable.")

        if challenge.state != "draft":
            raise HTTPException(status_code=400, detail="Seul un brouillon peut être publié.")

        if challenge.creator_user_id != user.id:
            raise HTTPException(status_code=403, detail="Seul l'auteur peut publier ce défi.")

        media = db.scalar(
            select(PhotoMedia).where(
                PhotoMedia.challenge_id == challenge.id,
                PhotoMedia.state == "ready",
            )
        )
        if not media:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une photo doit être uploadée avant de publier le défi.",
            )

        existing_pub = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.barathon_id == barathon.id,
                PhotoChallenge.state == "published",
            )
        )
        if existing_pub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un autre défi est déjà publié et en cours.",
            )

        # Figer l'audience : tous les participants actifs éligibles au moment de la publication
        participants = db.scalars(
            select(BarathonParticipant).where(
                BarathonParticipant.barathon_id == barathon.id
            )
        ).all()

        audience_entries = []
        for p in participants:
            p_user = db.get(User, p.user_id)
            if not p_user or not check_eligibility(db, p_user, barathon.id):
                continue

            aud = PhotoAudience(
                id=uuid.uuid4(),
                challenge_id=challenge.id,
                user_id=p.user_id,
                membership_id=p.id,
                is_creator=(p.user_id == user.id),
            )
            audience_entries.append(aud)

        db.add_all(audience_entries)

        respondents = [a for a in audience_entries if not a.is_creator]
        expected_count = len(respondents)

        challenge.state = "published"
        challenge.published_at = now
        challenge.expires_at = now + timedelta(minutes=3)
        challenge.expected_count = expected_count
        challenge.version += 1

        rate_event = PhotoRateEvent(
            user_id=user.id,
            operation_id=challenge.id,
            kind="publish",
            occurred_at=now,
        )
        db.add(rate_event)
        db.commit()

        # Notification WS à l'audience
        for aud in audience_entries:
            try:
                await ws_manager.send_to_user(
                    aud.user_id,
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
            state="published",
            question=challenge.question,
            options=challenge.options,
            correct_index=None,
            expires_at=challenge.expires_at,
            my_submission=None,
            can_answer=False,
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
        now = utc_now()

        # 1. Feature flag
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        # 2. Participant actif
        check_active_participant(db, barathon.id, user.id)

        # 3. Verrouillage atomique du challenge pour sérialiser votes et clôture
        challenge = db.scalar(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
            .with_for_update()
        )
        if not challenge:
            raise HTTPException(status_code=404, detail="Défi introuvable.")

        # 4. Audience
        aud = db.scalar(
            select(PhotoAudience).where(
                PhotoAudience.challenge_id == challenge.id,
                PhotoAudience.user_id == user.id,
                PhotoAudience.revoked_at.is_(None),
            )
        )
        if not aud:
            raise HTTPException(status_code=403, detail="Vous ne faites pas partie de l'audience de ce défi.")

        if aud.is_creator:
            raise HTTPException(status_code=403, detail="L'auteur ne peut pas répondre à son propre défi.")

        # 5. Idempotence soumission (vérifiée avant l'état pour tolérer rejeux après clôture)
        existing_answer = db.scalar(
            select(PhotoAnswer).where(
                PhotoAnswer.challenge_id == challenge.id,
                PhotoAnswer.audience_id == aud.id,
            )
        )
        if existing_answer:
            if existing_answer.choice_index == payload.choice_index and existing_answer.passed == payload.passed:
                is_closed = challenge.state == "closed"
                return PhotoChallengeItemRead(
                    id=challenge.id,
                    version=challenge.version,
                    state=challenge.state,
                    question=challenge.question,
                    options=challenge.options,
                    correct_index=challenge.correct_index if is_closed else None,
                    expires_at=challenge.expires_at,
                    my_submission=PhotoSubmissionRead(
                        choice_index=existing_answer.choice_index,
                        passed=existing_answer.passed,
                        submitted_at=existing_answer.submitted_at,
                    ),
                    can_answer=False,
                    photo_available=True,
                )
            raise HTTPException(status_code=409, detail="Vous avez déjà répondu à ce défi.")

        if challenge.state != "published":
            raise HTTPException(status_code=409, detail=f"Ce défi n'est plus ouvert (état: {challenge.state}).")

        if challenge.expires_at and ensure_utc(challenge.expires_at) <= now:
            PhotoService.finalize_challenge(db, challenge, reason="deadline")
            raise HTTPException(status_code=409, detail="Le délai pour répondre est dépassé.")

        # 6. Validation du payload
        if not payload.passed:
            if payload.choice_index is None:
                raise HTTPException(status_code=400, detail="Veuillez choisir une option ou passer.")
            max_idx = len(challenge.options or []) - 1
            if payload.choice_index < 0 or payload.choice_index > max_idx:
                raise HTTPException(status_code=400, detail="Option invalide.")

        # 7. Enregistrement de la réponse
        answer = PhotoAnswer(
            challenge_id=challenge.id,
            audience_id=aud.id,
            choice_index=payload.choice_index if not payload.passed else None,
            passed=payload.passed,
            submitted_at=now,
        )
        db.add(answer)
        challenge.version += 1
        db.flush()

        # 8. Clôture automatique si tous les répondants attendus ont voté
        respondents_count = challenge.expected_count or max(1, len(challenge.audience) - 1)
        answers_count = db.scalar(
            select(func.count(PhotoAnswer.audience_id)).where(
                PhotoAnswer.challenge_id == challenge.id
            )
        ) or 0

        is_closed = False
        if answers_count >= respondents_count:
            PhotoService.finalize_challenge(db, challenge, reason="all_handled")
            is_closed = True
        else:
            db.commit()

        # 9. Notification WS
        for a in challenge.audience:
            try:
                await ws_manager.send_to_user(
                    a.user_id,
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
        """Clôture atomique du défi et calcul mathématique des résultats selon BIZ-04."""
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

        expected = challenge.expected_count or max(1, len(challenge.audience) - 1)
        missing_count = max(0, expected - len(answers))

        # Règle BIZ-04 : si aucune réponse choisie (uniquement Pass ou Missing) -> expired
        if correct_count + incorrect_count == 0:
            challenge.state = "expired"
            challenge.terminal_at = now
            challenge.terminal_reason = "no_submissions"
            for aud in challenge.audience:
                aud.dare_assigned = False
            db.commit()
            return

        challenge.state = "closed"
        challenge.terminal_at = now
        challenge.terminal_reason = reason

        # Calcul des gages selon BIZ-04 :
        # Si 100% des répondants attendus ont répondu correct -> gage créateur uniquement
        creator_dare = (correct_count == expected) and (expected > 0)

        for aud in challenge.audience:
            if aud.is_creator:
                aud.dare_assigned = creator_dare
            else:
                user_ans = next((a for a in answers if a.audience_id == aud.id), None)
                if creator_dare:
                    aud.dare_assigned = False
                elif user_ans and not user_ans.passed and user_ans.choice_index != correct_idx:
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
    def delete_challenge(
        db: Session,
        barathon: Barathon,
        challenge_id: uuid.UUID,
        user: User,
    ) -> None:
        """Retrait sécurisé d'un défi avec purge immédiate du média."""
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        check_active_participant(db, barathon.id, user.id)

        now = utc_now()
        ch = db.scalar(
            select(PhotoChallenge)
            .where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
            .with_for_update()
        )
        if not ch:
            return

        is_creator = ch.creator_user_id == user.id
        is_organizer = barathon.created_by_user_id == user.id or user.is_admin
        is_audience_member = db.scalar(
            select(PhotoAudience).where(
                PhotoAudience.challenge_id == ch.id,
                PhotoAudience.user_id == user.id,
                PhotoAudience.revoked_at.is_(None),
            )
        ) is not None

        if not (is_creator or is_organizer or is_audience_member):
            raise HTTPException(status_code=403, detail="Non autorisé à retirer ce défi.")

        ch.state = "cancelled"
        ch.terminal_at = now
        ch.terminal_reason = "deleted_by_user"
        ch.content_removed_at = now
        ch.upload_code_hash = None
        ch.upload_claim_id = None

        for aud in ch.audience:
            aud.revoked_at = now

        medias = db.scalars(
            select(PhotoMedia).where(PhotoMedia.challenge_id == ch.id)
        ).all()
        for media in medias:
            media.state = "delete_pending"
            purge_media_file(media.storage_key)
            media.state = "deleted"
            media.deleted_at = now

        db.commit()

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
        now = utc_now()

        # 1. Feature flag
        if not is_photo_enabled(barathon.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Photo Mystère est désactivé pour ce barathon.",
            )

        # 2. Participant actif
        check_active_participant(db, barathon.id, user.id)

        challenge = db.scalar(
            select(PhotoChallenge).where(
                PhotoChallenge.id == challenge_id,
                PhotoChallenge.barathon_id == barathon.id,
            )
        )
        if not challenge:
            raise HTTPException(status_code=404, detail="Défi introuvable.")

        # 3. Règle d'expiration immédiate
        if challenge.state == "draft":
            if challenge.creator_user_id != user.id:
                raise HTTPException(status_code=403, detail="Accès refusé.")
            if ensure_utc(challenge.draft_expires_at) <= now:
                raise HTTPException(status_code=410, detail="Brouillon expiré.")
        elif challenge.state == "published":
            if challenge.expires_at and ensure_utc(challenge.expires_at) <= now:
                PhotoService.finalize_challenge(db, challenge, reason="deadline")

        if challenge.state == "closed":
            if challenge.terminal_at and now > ensure_utc(challenge.terminal_at) + timedelta(minutes=15):
                raise HTTPException(status_code=404, detail="Photo expirée et purgée.")
        elif challenge.state in ("cancelled", "expired"):
            raise HTTPException(status_code=404, detail="Photo non disponible.")

        if challenge.retention_until and now > ensure_utc(challenge.retention_until):
            raise HTTPException(status_code=404, detail="Photo expirée.")

        # 4. Audience non révoquée (si pas draft auteur)
        if challenge.state != "draft":
            aud = db.scalar(
                select(PhotoAudience).where(
                    PhotoAudience.challenge_id == challenge.id,
                    PhotoAudience.user_id == user.id,
                    PhotoAudience.revoked_at.is_(None),
                )
            )
            if not aud:
                raise HTTPException(status_code=403, detail="Accès refusé.")

        # 5. Récupération média
        media = db.scalar(
            select(PhotoMedia).where(
                PhotoMedia.challenge_id == challenge.id,
                PhotoMedia.state == "ready",
            )
        )
        if not media or (media.purge_due_at and ensure_utc(media.purge_due_at) <= now):
            raise HTTPException(status_code=404, detail="Photo non disponible ou purgée.")

        try:
            return decrypt_media(media.id, media.storage_key)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Erreur lors du déchiffrement du média.",
            )
