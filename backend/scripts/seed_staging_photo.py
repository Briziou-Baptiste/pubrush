"""
Script d'initialisation de l'environnement de recette isolé pour Photo Mystère (PHOTO-001).
Génère des identifiants et clés cryptographiques aléatoires, crée les entités
synthétiques en base et sauvegarde la configuration dans un fichier local non-versionné (.env.staging).

Usage :
  PYTHONPATH=backend python3 backend/scripts/seed_staging_photo.py
"""

import os
import secrets
import stat
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import User, Barathon, BarathonParticipant, Role
from app.security import hash_password

STAGING_DB_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('USER', 'baptistebriziou')}@localhost:5432/pubrush_staging",
)


def seed_staging():
    print(f"Connexion à la base de staging : {STAGING_DB_URL}")
    engine = create_engine(STAGING_DB_URL)
    session = Session(bind=engine)

    creator_password = os.getenv("STAGING_CREATOR_PASSWORD") or secrets.token_urlsafe(18)
    guesser_password = os.getenv("STAGING_GUESSER_PASSWORD") or secrets.token_urlsafe(18)
    photo_aes_key = os.getenv("STAGING_PHOTO_AES_KEY") or secrets.token_hex(32)
    jwt_secret = os.getenv("STAGING_JWT_SECRET_KEY") or secrets.token_hex(32)

    # 1. Utilisateurs synthétiques
    u1 = session.scalar(select(User).where(User.username == "tester_creator"))
    if not u1:
        u1 = User(
            username="tester_creator",
            email="tester_creator@pubrush.staging.local",
            password_hash=hash_password(creator_password),
            is_guest=False,
        )
        session.add(u1)
        session.flush()
        print(f"Utilisateur créateur créé : {u1.username} (id={u1.id})")
    else:
        u1.password_hash = hash_password(creator_password)
        session.flush()
        print(f"Utilisateur créateur mis à jour : {u1.username} (id={u1.id})")

    u2 = session.scalar(select(User).where(User.username == "tester_guesser"))
    if not u2:
        u2 = User(
            username="tester_guesser",
            email="tester_guesser@pubrush.staging.local",
            password_hash=hash_password(guesser_password),
            is_guest=False,
        )
        session.add(u2)
        session.flush()
        print(f"Utilisateur joueur créé : {u2.username} (id={u2.id})")
    else:
        u2.password_hash = hash_password(guesser_password)
        session.flush()
        print(f"Utilisateur joueur mis à jour : {u2.username} (id={u2.id})")

    # 2. Barathon synthétique de recette
    now = datetime.now(timezone.utc)
    b = session.scalar(select(Barathon).where(Barathon.name == "Barathon Recette Staging"))
    if not b:
        b = Barathon(
            name="Barathon Recette Staging",
            start_datetime=now,
            has_started=True,
            status="started",
            travel_time_between_bars_minutes=10,
            max_time_in_bar_minutes=45,
            created_by_user_id=u1.id,
            join_code="STAG01",
        )
        session.add(b)
        session.flush()
        print(f"Barathon de recette créé : {b.name} (id={b.id}, code={b.join_code})")
    else:
        b.status = "started"
        b.has_started = True
        session.flush()
        print(f"Barathon de recette existant : {b.name} (id={b.id}, code={b.join_code})")

    # 3. Inscription des participants
    p1 = session.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == b.id,
            BarathonParticipant.user_id == u1.id,
        )
    )
    if not p1:
        p1 = BarathonParticipant(barathon_id=b.id, user_id=u1.id, role="creator")
        session.add(p1)

    p2 = session.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == b.id,
            BarathonParticipant.user_id == u2.id,
        )
    )
    if not p2:
        p2 = BarathonParticipant(barathon_id=b.id, user_id=u2.id, role="guest")
        session.add(p2)

    session.commit()

    # 4. Écriture sécurisée du fichier d'environnement local non-versionné (.env.staging)
    backend_dir = Path(__file__).resolve().parent.parent
    env_staging_path = backend_dir / ".env.staging"
    env_content = f"""# ENVIRONNEMENT DE STAGING ISOLÉ PUBRUSH (PHOTO-001)
# Généré automatiquement hors-git. Ne jamais commiter.
APP_ENV=staging
PORT=8000
DATABASE_URL={STAGING_DB_URL}
JWT_SECRET_KEY={jwt_secret}

# Feature flag Photo Mystère STRICTEMENT limité au barathon de test (ID={b.id})
PHOTO_MYSTERY_ENABLED=true
PHOTO_MYSTERY_ALLOWLIST={b.id}

# Clé de chiffrement AES-256 (32 octets aléatoires en hexadécimal)
PHOTO_AES_KEY={photo_aes_key}
PHOTO_STORAGE_DIR=/tmp/pubrush-photo-media-staging
PHOTO_STORAGE_MAX_BYTES=33554432

# Identifiants des comptes synthétiques de test
TESTER_CREATOR_USERNAME={u1.username}
TESTER_CREATOR_PASSWORD={creator_password}
TESTER_GUESSER_USERNAME={u2.username}
TESTER_GUESSER_PASSWORD={guesser_password}
TEST_BARATHON_ID={b.id}
TEST_BARATHON_JOIN_CODE={b.join_code}
"""
    env_staging_path.write_text(env_content, encoding="utf-8")
    os.chmod(env_staging_path, stat.S_IRUSR | stat.S_IWUSR)  # 0600 : lecture/écriture propriétaire uniquement

    print(f"\nConfiguration de staging générée dans : {env_staging_path} (mode 0600)")
    print("--- SYNTHÈSE DES IDENTIFIANTS GÉNÉRÉS ---")
    print(f"Barathon ID allowlisté    : {b.id} (code: {b.join_code})")
    print(f"Compte Créateur (iPhone)   : {u1.username}")
    print(f"Compte Joueur (Android)    : {u2.username}")
    print(f"Clé AES-256 (32 octets)    : {photo_aes_key[:8]}...[MASQUÉE]")
    print(f"Clé JWT                   : {jwt_secret[:8]}...[MASQUÉE]")
    print("------------------------------------------")

    session.close()


if __name__ == "__main__":
    seed_staging()
