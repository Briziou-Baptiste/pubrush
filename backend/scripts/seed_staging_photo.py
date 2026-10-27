"""
Script d'initialisation de l'environnement de recette isolé pour Photo Mystère (PHOTO-001).
Crée les utilisateurs synthétiques et le barathon de test allowlisté.
Usage :
  PYTHONPATH=backend python3 backend/scripts/seed_staging_photo.py
"""

import os
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db import Base
from app.models import User, Barathon, BarathonParticipant, Role
from app.security import hash_password

STAGING_DB_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('USER', 'baptistebriziou')}@localhost:5432/pubrush_test",
)


def seed_staging():
    print(f"Connexion à la base de staging : {STAGING_DB_URL}")
    engine = create_engine(STAGING_DB_URL)
    session = Session(bind=engine)

    # 1. Utilisateurs synthétiques
    u1 = session.scalar(select(User).where(User.username == "tester_creator"))
    if not u1:
        u1 = User(
            username="tester_creator",
            email="tester_creator@pubrush.test",
            password_hash=hash_password("Recette2026!"),
            is_guest=False,
        )
        session.add(u1)
        session.flush()
        print(f"Utilisateur créateur créé : {u1.username} (id={u1.id})")
    else:
        print(f"Utilisateur créateur existant : {u1.username} (id={u1.id})")

    u2 = session.scalar(select(User).where(User.username == "tester_guesser"))
    if not u2:
        u2 = User(
            username="tester_guesser",
            email="tester_guesser@pubrush.test",
            password_hash=hash_password("Recette2026!"),
            is_guest=False,
        )
        session.add(u2)
        session.flush()
        print(f"Utilisateur joueur créé : {u2.username} (id={u2.id})")
    else:
        print(f"Utilisateur joueur existant : {u2.username} (id={u2.id})")

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
            join_code="RECET1",
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
    print("\n--- SYNTHÈSE DE L'ENVIRONNEMENT DE RECETTE ---")
    print(f"Barathon ID à allowlister : PHOTO_MYSTERY_ALLOWLIST={b.id}")
    print(f"Compte Créateur (iPhone)  : tester_creator / Recette2026!")
    print(f"Compte Joueur (Android)   : tester_guesser / Recette2026!")
    print(f"Code d'invitation barathon : {b.join_code}")
    session.close()


if __name__ == "__main__":
    seed_staging()
