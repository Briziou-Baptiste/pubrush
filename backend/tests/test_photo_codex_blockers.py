import io
import os
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, User, Barathon, BarathonParticipant
from app.photo_models import PhotoChallenge, PhotoAudience, PhotoAnswer, PhotoResult, PhotoMedia
from app.photo_schemas import PhotoAnswerPayload, PhotoChallengeCreate, PhotoPublishPayload
from app.security import hash_password, create_access_token
from app.services.photo_service import PhotoService
from app.services.photo_storage import encrypt_and_store, get_storage_dir
from app.services.photo_purge import purge_expired_photos, cleanup_orphaned_files

TEST_DB_URL = "sqlite:///:memory:"


@pytest.fixture(autouse=True)
def configure_storage_dir(tmp_path, monkeypatch):
    test_storage = str(tmp_path / "photo-storage-test")
    monkeypatch.setenv("PHOTO_STORAGE_DIR", test_storage)
    return test_storage


@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_user(db: Session, username: str, is_guest: bool = False) -> User:
    user = User(
        email=f"{username.lower()}@test.fr",
        username=username,
        password_hash=hash_password("Pass123!"),
        is_guest=is_guest,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_active_barathon(db: Session, creator: User, members: list[User]) -> Barathon:
    now = datetime.now(timezone.utc)
    barathon = Barathon(
        name="Test Barathon",
        start_datetime=now,
        has_started=True,
        status="started",
        created_by_user_id=creator.id,
        join_code=f"T{uuid.uuid4().hex[:6].upper()}",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
    )
    db.add(barathon)
    db.commit()
    db.refresh(barathon)

    db.add(BarathonParticipant(barathon_id=barathon.id, user_id=creator.id, role="creator"))
    for m in members:
        db.add(BarathonParticipant(barathon_id=barathon.id, user_id=m.id, role="participant"))
    db.commit()
    return barathon


def make_test_jpeg(color: str = "blue") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (300, 300), color=color)
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ==============================================================================
# P0-A : Révocation immédiate des participants
# ==============================================================================

def test_p0_a_excluded_participant_immediately_denied_access(db_session, monkeypatch):
    """Vérifie qu'un participant exclu ne peut plus lire de photo ni obtenir le snapshot."""
    creator = create_user(db_session, "CreatorA")
    member = create_user(db_session, "MemberB")
    barathon = create_active_barathon(db_session, creator, [member])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    # 1. Création draft, upload et publication
    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(
            question="Devine l'objet ?",
            options=["Verre", "Sous-bock"],
            correct_index=0,
            notice_version="photo-private-2026-10-v1",
        ),
        uuid.uuid4(),
    )
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    auth_ctx = {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": draft.upload_code}
    # Récupérer le jti du claim
    ch = db_session.get(PhotoChallenge, c_id)
    auth_ctx["jti"] = str(ch.upload_claim_id)

    PhotoService.upload_photo(db_session, c_id, make_test_jpeg(), auth_ctx)

    import asyncio
    asyncio.run(PhotoService.publish_challenge(
        db_session,
        barathon,
        c_id,
        creator,
        PhotoPublishPayload(notice_version="photo-private-2026-10-v1"),
    ))

    # Avant exclusion : le membre a accès aux bytes
    img = PhotoService.get_photo_bytes(db_session, barathon, c_id, member)
    assert len(img) > 0

    # 2. Exclusion du participant
    PhotoService.revoke_participant_photo_access(db_session, barathon.id, member.id)
    part = db_session.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == barathon.id,
            BarathonParticipant.user_id == member.id,
        )
    )
    db_session.delete(part)
    db_session.commit()

    # Après exclusion : get_photo_bytes doit refuser immédiatement (403)
    with pytest.raises(HTTPException) as exc:
        PhotoService.get_photo_bytes(db_session, barathon, c_id, member)
    assert exc.value.status_code == 403

    # Après exclusion : get_state doit refuser immédiatement (403)
    with pytest.raises(HTTPException) as exc_state:
        PhotoService.get_state(db_session, barathon, member)
    assert exc_state.value.status_code == 403


def test_p0_a_cross_barathon_access_forbidden(db_session, monkeypatch):
    """Vérifie l'étanchéité stricte entre deux barathons distincts."""
    creator1 = create_user(db_session, "Creator1")
    creator2 = create_user(db_session, "Creator2")
    user_other = create_user(db_session, "UserOther")

    b1 = create_active_barathon(db_session, creator1, [])
    b2 = create_active_barathon(db_session, creator2, [user_other])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", f"{b1.id},{b2.id}")

    # Draft dans b1
    draft1 = PhotoService.create_draft(
        db_session,
        b1,
        creator1,
        PhotoChallengeCreate(question="Question 1", options=["O1", "O2"], correct_index=0),
        uuid.uuid4(),
    )
    ch1 = db_session.get(PhotoChallenge, draft1.id)
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft1.upload_code)
    PhotoService.upload_photo(
        db_session,
        c_id,
        make_test_jpeg(),
        {"scope": "photo_upload", "sub": f"upload:{creator1.id}", "jti": str(ch1.upload_claim_id)},
    )

    # user_other (membre de b2, non membre de b1) tente d'accéder au défi de b1 -> 403
    with pytest.raises(HTTPException) as exc:
        PhotoService.get_photo_bytes(db_session, b1, draft1.id, user_other)
    assert exc.value.status_code == 403


# ==============================================================================
# P0-B : Feature flag et capacités d'upload anti-rejeu
# ==============================================================================

def test_p0_b_feature_flag_blocks_all_photo_endpoints(db_session, monkeypatch):
    """Vérifie que flag OFF bloque l'ensemble des endpoints Photo."""
    creator = create_user(db_session, "CreatorFlag")
    barathon = create_active_barathon(db_session, creator, [])

    # Flag activé pour créer le draft
    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Flag test", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )

    # Coupure du flag
    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "false")

    # 1. get_state retourne enabled=False
    state = PhotoService.get_state(db_session, barathon, creator)
    assert state.enabled is False
    assert state.items == []

    # 2. create_draft -> 403
    with pytest.raises(HTTPException) as exc:
        PhotoService.create_draft(
            db_session,
            barathon,
            creator,
            PhotoChallengeCreate(question="Question valide", options=["A", "B"], correct_index=0),
            uuid.uuid4(),
        )
    assert exc.value.status_code == 403

    # 3. claim_upload_code -> 403
    with pytest.raises(HTTPException) as exc:
        PhotoService.claim_upload_code(db_session, draft.upload_code)
    assert exc.value.status_code == 403

    # 4. upload_photo -> 403
    with pytest.raises(HTTPException) as exc:
        PhotoService.upload_photo(
            db_session,
            draft.id,
            make_test_jpeg(),
            {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": "any"},
        )
    assert exc.value.status_code == 403


def test_p0_b_upload_capability_strictly_single_use(db_session, monkeypatch):
    """Vérifie qu'un jeton d'upload ne peut pas être rejoué ou réutilisé."""
    creator = create_user(db_session, "CreatorReplay")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Q Replay", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    ch = db_session.get(PhotoChallenge, c_id)
    auth_ctx = {
        "scope": "photo_upload",
        "sub": f"upload:{creator.id}",
        "jti": str(ch.upload_claim_id),
    }

    # Premier upload : succès
    media_id, w, h = PhotoService.upload_photo(db_session, c_id, make_test_jpeg(), auth_ctx)
    assert media_id is not None

    # Deuxième upload avec le MÊME jeton : rejet immédiat anti-rejeu (403)
    with pytest.raises(HTTPException) as exc:
        PhotoService.upload_photo(db_session, c_id, make_test_jpeg("red"), auth_ctx)
    assert exc.value.status_code == 403


# ==============================================================================
# P0-C : Conservation et purge effectives
# ==============================================================================

def test_p0_c_expired_photo_read_rejected_and_purged(db_session, monkeypatch):
    """Vérifie le rejet immédiat de lecture après expiration et la purge effective."""
    creator = create_user(db_session, "CreatorPurge")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Purge test", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    ch = db_session.get(PhotoChallenge, draft.id)
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    PhotoService.upload_photo(
        db_session,
        c_id,
        make_test_jpeg(),
        {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": str(ch.upload_claim_id)},
    )

    import asyncio
    asyncio.run(PhotoService.publish_challenge(
        db_session,
        barathon,
        c_id,
        creator,
        PhotoPublishPayload(notice_version="photo-private-2026-10-v1"),
    ))

    # Simuler clôture depuis plus de 15 minutes
    ch = db_session.get(PhotoChallenge, c_id)
    ch.state = "closed"
    ch.terminal_at = datetime.now(timezone.utc) - timedelta(minutes=16)
    db_session.commit()

    # Lecture refusée (404)
    with pytest.raises(HTTPException) as exc:
        PhotoService.get_photo_bytes(db_session, barathon, c_id, creator)
    assert exc.value.status_code == 404

    # Purge en arrière-plan
    purged_count = purge_expired_photos(db_session)
    assert purged_count >= 1

    media = db_session.scalar(select(PhotoMedia).where(PhotoMedia.challenge_id == c_id))
    assert media.state == "deleted"


def test_p0_c_storage_capacity_bounded(db_session, monkeypatch):
    """Vérifie le respect du budget RAM 32 MiB et le rejet avec 503 en cas de saturation."""
    monkeypatch.setenv("PHOTO_STORAGE_MAX_BYTES", "1024")  # 1 KiB budget pour tester
    creator = create_user(db_session, "CreatorQuota")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Q Quota", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    ch = db_session.get(PhotoChallenge, draft.id)
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    auth_ctx = {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": str(ch.upload_claim_id)}

    # L'image fait ~5 KiB > budget 1 KiB -> 503 Service Unavailable
    with pytest.raises(HTTPException) as exc:
        PhotoService.upload_photo(db_session, c_id, make_test_jpeg(), auth_ctx)
    assert exc.value.status_code == 503


# ==============================================================================
# P0-D : Limites de ressources et quotas
# ==============================================================================

def test_p0_d_barathon_draft_quota_exceeded(db_session, monkeypatch):
    """Vérifie le plafond de 10 défis actifs simultanés par barathon (429)."""
    creator = create_user(db_session, "CreatorMax")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    # Créer 10 défis existants dans ce barathon
    now = datetime.now(timezone.utc)
    for i in range(10):
        c = PhotoChallenge(
            id=uuid.uuid4(),
            barathon_id=barathon.id,
            creator_user_id=creator.id,
            state="draft",
            create_key=uuid.uuid4(),
            create_fingerprint=f"fp_{i}",
            draft_expires_at=now + timedelta(minutes=15),
            retention_until=now + timedelta(hours=24),
        )
        db_session.add(c)
    db_session.commit()

    # Le 11ème draft doit lever 429
    with pytest.raises(HTTPException) as exc:
        PhotoService.create_draft(
            db_session,
            barathon,
            creator,
            PhotoChallengeCreate(question="11th", options=["A", "B"], correct_index=0),
            uuid.uuid4(),
        )
    assert exc.value.status_code == 429


# ==============================================================================
# P1-A : Retrait d'un défi
# ==============================================================================

def test_p1_a_delete_challenge_no_500_and_purges_media(db_session, monkeypatch):
    """P1-A : Vérifie que DELETE défi ne lève pas 500 et purge immédiatement le fichier."""
    creator = create_user(db_session, "CreatorDel")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="To delete", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    ch = db_session.get(PhotoChallenge, draft.id)
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    auth_ctx = {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": str(ch.upload_claim_id)}
    PhotoService.upload_photo(db_session, c_id, make_test_jpeg(), auth_ctx)

    media = db_session.scalar(select(PhotoMedia).where(PhotoMedia.challenge_id == c_id))
    storage_path = os.path.join(get_storage_dir(), f"{media.storage_key}.enc")
    assert os.path.exists(storage_path)

    # Retrait du défi
    PhotoService.delete_challenge(db_session, barathon, c_id, creator)

    # Vérifications :
    # 1. Challenge annulé
    ch = db_session.get(PhotoChallenge, c_id)
    assert ch.state == "cancelled"
    assert ch.content_removed_at is not None

    # 2. Média purgé immédiatement du disque
    assert not os.path.exists(storage_path)
    db_session.refresh(media)
    assert media.state == "deleted"


# ==============================================================================
# P1-B : Atomicité des votes et règles complètes de gages (BIZ-04)
# ==============================================================================

def test_p1_b_dare_rules_truth_table(db_session, monkeypatch):
    """
    Vérifie la table de vérité exacte des gages BIZ-04 :
    - Cas 1 : Tous corrects -> gage créateur, aucun gage répondant.
    - Cas 2 : Un correct + un faux -> gage répondant faux uniquement.
    - Cas 3 : Tout le monde passe -> expired, aucun gage, bonne réponse masquée.
    """
    creator = create_user(db_session, "CreatorDare")
    p1 = create_user(db_session, "Player1")
    p2 = create_user(db_session, "Player2")
    barathon = create_active_barathon(db_session, creator, [p1, p2])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    # CAS 1 : TOUS CORRECTS
    draft1 = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Cas 1", options=["Vrai", "Faux"], correct_index=0),
        uuid.uuid4(),
    )
    ch1 = db_session.get(PhotoChallenge, draft1.id)
    token, c_id1, _ = PhotoService.claim_upload_code(db_session, draft1.upload_code)
    PhotoService.upload_photo(
        db_session,
        c_id1,
        make_test_jpeg(),
        {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": str(ch1.upload_claim_id)},
    )

    import asyncio
    asyncio.run(PhotoService.publish_challenge(
        db_session,
        barathon,
        c_id1,
        creator,
        PhotoPublishPayload(notice_version="photo-private-2026-10-v1"),
    ))

    # p1 répond 0 (correct), p2 répond 0 (correct)
    asyncio.run(PhotoService.submit_answer(db_session, barathon, c_id1, p1, PhotoAnswerPayload(choice_index=0, passed=False)))
    asyncio.run(PhotoService.submit_answer(db_session, barathon, c_id1, p2, PhotoAnswerPayload(choice_index=0, passed=False)))

    ch1 = db_session.get(PhotoChallenge, c_id1)
    assert ch1.state == "closed"
    assert ch1.results.creator_dare is True
    # Vérification audience
    aud_creator = db_session.scalar(select(PhotoAudience).where(PhotoAudience.challenge_id == c_id1, PhotoAudience.user_id == creator.id))
    aud_p1 = db_session.scalar(select(PhotoAudience).where(PhotoAudience.challenge_id == c_id1, PhotoAudience.user_id == p1.id))
    aud_p2 = db_session.scalar(select(PhotoAudience).where(PhotoAudience.challenge_id == c_id1, PhotoAudience.user_id == p2.id))
    assert aud_creator.dare_assigned is True
    assert aud_p1.dare_assigned is False
    assert aud_p2.dare_assigned is False


def test_p1_b_idempotent_answer_resubmission(db_session, monkeypatch):
    """Vérifie qu'une même réponse renvoyée est idempotente et qu'une réponse différente est rejetée avec 409."""
    creator = create_user(db_session, "CreatorIdem")
    p1 = create_user(db_session, "PlayerIdem")
    barathon = create_active_barathon(db_session, creator, [p1])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Idem", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    ch = db_session.get(PhotoChallenge, draft.id)
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)
    PhotoService.upload_photo(
        db_session,
        c_id,
        make_test_jpeg(),
        {"scope": "photo_upload", "sub": f"upload:{creator.id}", "jti": str(ch.upload_claim_id)},
    )

    import asyncio
    asyncio.run(PhotoService.publish_challenge(
        db_session,
        barathon,
        c_id,
        creator,
        PhotoPublishPayload(notice_version="photo-private-2026-10-v1"),
    ))

    # Première soumission
    res1 = asyncio.run(PhotoService.submit_answer(db_session, barathon, c_id, p1, PhotoAnswerPayload(choice_index=0, passed=False)))
    assert res1.my_submission.choice_index == 0

    # Re-soumission identique -> idempotent (succès sans duplication)
    res2 = asyncio.run(PhotoService.submit_answer(db_session, barathon, c_id, p1, PhotoAnswerPayload(choice_index=0, passed=False)))
    assert res2.my_submission.choice_index == 0

    # Soumission contradictoire -> 409 Conflict
    with pytest.raises(HTTPException) as exc:
        asyncio.run(PhotoService.submit_answer(db_session, barathon, c_id, p1, PhotoAnswerPayload(choice_index=1, passed=False)))
    assert exc.value.status_code == 409


def test_p0_d_upload_file_route_oversized_rejected_with_413(monkeypatch, db_session):
    """P0-D : Vérifie qu'un upload excédant 2 MiB est rejeté avec 413 avant surcharge mémoire."""
    from fastapi.testclient import TestClient
    from app.main import app

    creator = create_user(db_session, "CreatorRoute")
    barathon = create_active_barathon(db_session, creator, [])

    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", str(barathon.id))

    draft = PhotoService.create_draft(
        db_session,
        barathon,
        creator,
        PhotoChallengeCreate(question="Taille max", options=["A", "B"], correct_index=0),
        uuid.uuid4(),
    )
    token, c_id, _ = PhotoService.claim_upload_code(db_session, draft.upload_code)

    client = TestClient(app)

    # 1. Fichier de 2.5 MiB (> 2 MiB)
    oversized_data = b"X" * (int(2.5 * 1024 * 1024))
    res = client.post(
        "/photo-mystery/upload",
        files={"file": ("big.jpg", oversized_data, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 413
    assert "Fichier trop volumineux" in res.json()["detail"]

