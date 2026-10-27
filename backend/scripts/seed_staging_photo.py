"""
Script d'initialisation de l'environnement de recette isolé pour Photo Mystère (PHOTO-001).
Génère des identifiants et clés cryptographiques aléatoires, crée les entités
synthétiques en base et sauvegarde la configuration dans un fichier local non-versionné (.env.staging).

Usage :
  PYTHONPATH=backend PYTHON_DOTENV_DISABLED=1 STAGING_DATABASE_URL="postgresql+psycopg://photo_staging:<pass>@127.0.0.1:15432/pubrush_photo_staging" python3 backend/scripts/seed_staging_photo.py
"""

import os
import sys

# P1-C: Empêcher strictement le chargement de .env ordinaire
os.environ["PYTHON_DOTENV_DISABLED"] = "1"

# P1-2: Rendre le seed importable indépendamment du répertoire courant et de PYTHONPATH
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import secrets
import stat
import uuid
from datetime import datetime, timezone
from sqlalchemy.engine import make_url
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Validation stricte de STAGING_DATABASE_URL avant toute tentative de connexion
staging_db_url_env = os.getenv("STAGING_DATABASE_URL")
if not staging_db_url_env or not staging_db_url_env.strip():
    raise RuntimeError(
        "CRITICAL ERROR: STAGING_DATABASE_URL est obligatoire. "
        "Le repli vers DATABASE_URL ou .env est strictement interdit pour isoler le staging."
    )

parsed_url = make_url(staging_db_url_env.strip())

# P1-3: Refuser tout paramètre de query (?host=..., ?port=..., etc.)
if parsed_url.query:
    raise RuntimeError(
        "Cible interdite: les paramètres de query URL (?...) sont strictement interdits pour le staging."
    )

# P1-3: Vérification obligatoire du pilote/driver
if parsed_url.drivername != "postgresql+psycopg":
    raise RuntimeError(
        f"Cible interdite: driver '{parsed_url.drivername}'. Seul 'postgresql+psycopg' est autorisé."
    )

# P1-3: Vérification obligatoire du nom de base
if parsed_url.database != "pubrush_photo_staging":
    raise RuntimeError(
        f"Cible interdite: base '{parsed_url.database}'. Seule la base dédiée 'pubrush_photo_staging' est autorisée."
    )

# P1-3: Vérification obligatoire de l'utilisateur
if parsed_url.username != "photo_staging":
    raise RuntimeError(
        f"Cible interdite: utilisateur '{parsed_url.username}'. Seul l'utilisateur dédié 'photo_staging' est autorisé."
    )

# P1-3: Vérification stricte des hôtes et des ports (pas de port absent sur localhost/127.0.0.1)
if parsed_url.host in ("127.0.0.1", "localhost"):
    if parsed_url.port != 15432:
        raise RuntimeError(
            f"Cible interdite: port '{parsed_url.port}'. Le port hôte réservé au staging doit être exactement 15432."
        )
elif parsed_url.host == "db-photo":
    if parsed_url.port not in (5432, None):
        raise RuntimeError(
            f"Cible interdite: port '{parsed_url.port}'. Le port du conteneur db-photo doit être 5432."
        )
else:
    raise RuntimeError(
        f"Cible interdite: hôte '{parsed_url.host}'. Seuls '127.0.0.1', 'localhost' ou 'db-photo' sont autorisés."
    )

# P1-1: Conserver le vrai mot de passe dans DATABASE_URL sans le masquer par ***
os.environ["DATABASE_URL"] = parsed_url.render_as_string(hide_password=False)

from app.models import User, Barathon, BarathonParticipant
from app.security import hash_password


def seed_staging():
    # Affichage sécurisé de la cible expurgée (sans mot de passe)
    safe_target = f"{parsed_url.username}@{parsed_url.host}:{parsed_url.port}/{parsed_url.database}"
    print(f"Connexion validée à la base de staging dédiée : {safe_target}")

    # P1-1: Passer directement l'objet URL à create_engine pour préserver le mot de passe réel
    engine = create_engine(parsed_url)
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
        print(f"Utilisateur créateur synthétique créé : {u1.username} (id={u1.id})")
    else:
        u1.password_hash = hash_password(creator_password)
        session.flush()
        print(f"Utilisateur créateur synthétique mis à jour : {u1.username} (id={u1.id})")

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
        print(f"Utilisateur joueur synthétique créé : {u2.username} (id={u2.id})")
    else:
        u2.password_hash = hash_password(guesser_password)
        session.flush()
        print(f"Utilisateur joueur synthétique mis à jour : {u2.username} (id={u2.id})")

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

    # 4. Écriture sécurisée du fichier d'environnement local non-versionné (.env.staging) avec umask 077
    env_staging_path = Path(os.getenv("STAGING_ENV_FILE") or (backend_dir / ".env.staging"))

    # P1-1: URL interne au conteneur Docker backend-photo construite avec parsed_url.set()
    container_url = parsed_url.set(host="db-photo", port=5432)
    container_db_url = container_url.render_as_string(hide_password=False)
    host_db_url = parsed_url.render_as_string(hide_password=False)

    env_content = f"""# ENVIRONNEMENT DE STAGING ISOLÉ PUBRUSH (PHOTO-001)
# Généré automatiquement hors-git. Ne jamais commiter. Permissions 0600.
APP_ENV=staging
PYTHON_DOTENV_DISABLED=1
PORT=8000
DATABASE_URL={container_db_url}
HOST_DATABASE_URL={host_db_url}
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
TESTER_CREATOR_EMAIL={u1.email}
TESTER_CREATOR_PASSWORD={creator_password}
TESTER_GUESSER_USERNAME={u2.username}
TESTER_GUESSER_EMAIL={u2.email}
TESTER_GUESSER_PASSWORD={guesser_password}
TEST_BARATHON_ID={b.id}
TEST_BARATHON_JOIN_CODE={b.join_code}
"""
    # Écriture atomique avec permissions 0600 dès la création (umask 077)
    old_umask = os.umask(0o077)
    try:
        temp_file = env_staging_path.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(env_content)
        os.replace(temp_file, env_staging_path)
    finally:
        os.umask(old_umask)

    print(f"\nConfiguration de staging générée dans : {env_staging_path} (mode 0600)")
    print("--- SYNTHÈSE DES IDENTIFIANTS GÉNÉRÉS (SANS SECRETS) ---")
    print(f"Cible base de données    : {safe_target}")
    print(f"Barathon ID allowlisté    : {b.id} (code: {b.join_code})")
    print(f"Compte Créateur           : {u1.username} ({u1.email})")
    print(f"Compte Joueur             : {u2.username} ({u2.email})")
    print("Secrets et mots de passe  : [ENREGISTRÉS STRICTEMENT DANS .env.staging (0600)]")
    print("---------------------------------------------------------")

    session.close()


if __name__ == "__main__":
    seed_staging()
