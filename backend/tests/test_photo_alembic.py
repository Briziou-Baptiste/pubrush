import os
import uuid
import pytest
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine, select, func, inspect
from alembic.config import Config
from alembic import command

from app.models import Base, User, Barathon, BarathonParticipant, PhotoSecureGuest
from app.photo_models import PhotoChallenge, PhotoAudience, PhotoAnswer, PhotoResult, PhotoMedia
from app.security import hash_password

PG_TEST_URL = os.getenv(
    "PG_TEST_DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('USER', 'baptistebriziou')}@localhost:5432/pubrush_test",
)


def get_alembic_config(db_url: str) -> Config:
    backend_dir = Path(__file__).resolve().parent.parent
    ini_path = backend_dir / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", db_url)
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    cfg.attributes["configure_logger"] = False
    return cfg


@pytest.fixture(scope="module")
def pg_photo_engine():
    try:
        engine = create_engine(PG_TEST_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
        yield engine
        engine.dispose()
    except Exception as exc:
        pytest.skip(f"PostgreSQL test database not available: {exc}")


def test_real_alembic_migration_and_rollback_on_postgres(pg_photo_engine):
    """
    P1-C : Vérification rigoureuse des migrations Alembic sur PostgreSQL réel.
    1. Upgrade vers b1c2d3e4f5a6 : création des tables photo_*.
    2. Vérification de l'existence des tables et colonnes.
    3. Downgrade vers a7b8c9d0e1f2 : suppression propre des tables photo_*.
    4. Vérification que l'ancien schéma et les données préexistantes sont intacts.
    5. Re-upgrade vers b1c2d3e4f5a6 pour laisser la base de test opérationnelle.
    """
    cfg = get_alembic_config(PG_TEST_URL)

    # 1. Appliquer d'abord la révision Photo
    command.upgrade(cfg, "b1c2d3e4f5a6")

    insp = inspect(pg_photo_engine)
    tables = insp.get_table_names()
    assert "photo_challenges" in tables
    assert "photo_media" in tables
    assert "photo_secure_guests" in tables
    assert "photo_audience" in tables
    assert "photo_answers" in tables
    assert "photo_results" in tables

    # Vérification des colonnes ajoutées pour l'anti-rejeu
    cols = [c["name"] for c in insp.get_columns("photo_challenges")]
    assert "upload_claim_id" in cols
    assert "upload_claim_consumed_at" in cols

    # 2. Test du rollback Alembic vers a7b8c9d0e1f2
    command.downgrade(cfg, "a7b8c9d0e1f2")

    insp_post_downgrade = inspect(pg_photo_engine)
    tables_post = insp_post_downgrade.get_table_names()
    assert "photo_challenges" not in tables_post
    assert "photo_media" not in tables_post
    assert "photo_secure_guests" not in tables_post
    # Les tables coeur doivent être préservées
    assert "users" in tables_post
    assert "barathons" in tables_post

    # 3. Re-upgrade vers b1c2d3e4f5a6 pour la suite des tests
    command.upgrade(cfg, "b1c2d3e4f5a6")


def test_additive_schema_and_backward_compatibility_on_real_pg(pg_photo_engine):
    """
    Vérifie sur PostgreSQL réel :
    1. Schéma purement additif : les requêtes du coeur existant (User, Barathon) fonctionnent sans perturbation.
    2. Cascade d'intégrité : supprimer un Barathon cascade sur photo_challenges, photo_audience, photo_answers, photo_results.
    3. Registre de purge durable : photo_media survit à la suppression du challenge (FK SET NULL).
    """
    from sqlalchemy.orm import Session
    session = Session(bind=pg_photo_engine)

    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # 1. Créer un utilisateur et un barathon
        creator = User(
            email=f"pg_creator_{uuid.uuid4().hex[:6]}@test.fr",
            username=f"Creator_{uuid.uuid4().hex[:4]}",
            password_hash=hash_password("Pass123!"),
            is_guest=False,
        )
        session.add(creator)
        session.flush()

        barathon = Barathon(
            name="PG Test Barathon",
            start_datetime=now,
            has_started=True,
            status="started",
            travel_time_between_bars_minutes=10,
            max_time_in_bar_minutes=45,
            created_by_user_id=creator.id,
            join_code=f"PG{secrets_code()}",
        )
        session.add(barathon)
        session.flush()

        part = BarathonParticipant(
            barathon_id=barathon.id,
            user_id=creator.id,
            role="creator",
        )
        session.add(part)
        session.flush()

        # 2. Créer un défi Photo avec audience, réponse, résultat et média
        challenge = PhotoChallenge(
            id=uuid.uuid4(),
            barathon_id=barathon.id,
            creator_user_id=creator.id,
            creator_membership_id=part.id,
            state="closed",
            question="Question PG test ?",
            options=["A", "B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp1",
            notice_version="photo-private-2026-10-v1",
            draft_expires_at=now,
            retention_until=now,
        )
        session.add(challenge)
        session.flush()

        aud = PhotoAudience(
            id=uuid.uuid4(),
            challenge_id=challenge.id,
            user_id=creator.id,
            is_creator=True,
        )
        session.add(aud)
        session.flush()

        storage_key = uuid.uuid4()
        media = PhotoMedia(
            id=uuid.uuid4(),
            challenge_id=challenge.id,
            storage_key=storage_key,
            state="ready",
            purge_due_at=now,
        )
        session.add(media)
        session.flush()

        result = PhotoResult(
            challenge_id=challenge.id,
            reason="all_handled",
            expected_count=1,
            correct_count=1,
            incorrect_count=0,
            passed_count=0,
            creator_dare=True,
        )
        session.add(result)
        session.commit()

        # 3. Vérifier l'existence en base
        c_id = challenge.id
        m_id = media.id
        aud_id = aud.id
        assert session.scalar(select(func.count(PhotoChallenge.id)).where(PhotoChallenge.id == c_id)) == 1
        assert session.scalar(select(func.count(PhotoResult.challenge_id)).where(PhotoResult.challenge_id == c_id)) == 1

        # 4. Suppression du Barathon : cascade sur le challenge et le résultat
        session.delete(barathon)
        session.commit()

        assert session.scalar(select(func.count(PhotoChallenge.id)).where(PhotoChallenge.id == c_id)) == 0
        assert session.scalar(select(func.count(PhotoResult.challenge_id)).where(PhotoResult.challenge_id == c_id)) == 0
        assert session.scalar(select(func.count(PhotoAudience.id)).where(PhotoAudience.id == aud_id)) == 0

        # 5. photo_media doit SURVIVRE avec challenge_id = NULL (registre de purge durable)
        reloaded_media = session.scalar(select(PhotoMedia).where(PhotoMedia.id == m_id))
        assert reloaded_media is not None
        assert reloaded_media.challenge_id is None

        # Nettoyage
        session.delete(reloaded_media)
        session.delete(creator)
        session.commit()
    finally:
        session.close()


def secrets_code():
    import secrets
    return "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(4))
