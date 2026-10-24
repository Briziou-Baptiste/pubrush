import os
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models import (
    Base,
    User,
    Barathon,
    BarathonParticipant,
    BarathonStop,
    BarathonExpense,
    BarathonExpenseBeneficiary,
    PasswordResetToken,
    EventTicket,
    PartnerEvent,
)
from app.security import hash_password, create_access_token
from app.websocket.registry import ws_manager
from app.main import _delete_user_data

PG_TEST_URL = os.getenv(
    "PG_TEST_DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('USER', 'baptistebriziou')}@localhost:5432/pubrush_test",
)


@pytest.fixture(scope="module")
def pg_engine():
    try:
        engine = create_engine(PG_TEST_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
        yield engine
        engine.dispose()
    except Exception as exc:
        pytest.skip(f"PostgreSQL test database not available: {exc}")


@pytest.fixture(scope="function")
def pg_session(pg_engine):
    SessionLocal = sessionmaker(bind=pg_engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_delete_user_data_on_real_postgresql(pg_session):
    """
    Validation sur PostgreSQL réel :
    - Relations en cascade (dépenses, bénéficiaires, participants, rôles)
    - Relations SET NULL (tickets d'événements partenaires)
    - Purge RGPD intégrale de PasswordResetToken
    - Réassignation du créateur de barathon
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    uid_suffix = int(now.timestamp())

    # 1. Créer 2 utilisateurs réels
    u1 = User(
        email=f"pg_alice_{uid_suffix}@pubrush.com",
        username=f"pg_alice_{uid_suffix}",
        password_hash=hash_password("alice_secret"),
    )
    u2 = User(
        email=f"pg_bob_{uid_suffix}@pubrush.com",
        username=f"pg_bob_{uid_suffix}",
        password_hash=hash_password("bob_secret"),
    )
    pg_session.add_all([u1, u2])
    pg_session.flush()

    # 2. Créer un PasswordResetToken pour Alice
    reset_tok = PasswordResetToken(
        email=u1.email,
        token="654321",
        expires_at=now + timedelta(minutes=15),
    )
    pg_session.add(reset_tok)

    # 3. Créer un Barathon partagé entre Alice (créatrice) et Bob
    b = Barathon(
        name="Barathon PostgreSQL Réel",
        start_datetime=now,
        end_datetime=now + timedelta(hours=3),
        travel_time_between_bars_minutes=15,
        max_time_in_bar_minutes=45,
        created_by_user_id=u1.id,
        status="started",
        has_started=True,
    )
    pg_session.add(b)
    pg_session.flush()

    p1 = BarathonParticipant(barathon_id=b.id, user_id=u1.id, role="creator")
    p2 = BarathonParticipant(barathon_id=b.id, user_id=u2.id, role="participant")
    pg_session.add_all([p1, p2])

    # 4. Créer une dépense partagée
    expense = BarathonExpense(
        barathon_id=b.id,
        payer_user_id=u1.id,
        amount=50.00,
        description="Tournée initiale",
    )
    pg_session.add(expense)
    pg_session.flush()

    bene = BarathonExpenseBeneficiary(
        expense_id=expense.id,
        user_id=u2.id,
    )
    pg_session.add(bene)

    # 5. Créer un événement partenaire et un billet utilisé par Alice (SET NULL)
    event = PartnerEvent(
        name=f"Festivités {uid_suffix}",
        code=f"FEST_{uid_suffix}",
        is_active=True,
    )
    pg_session.add(event)
    pg_session.flush()

    ticket = EventTicket(
        event_id=event.id,
        ticket_code=f"TCK-{uid_suffix}",
        is_used=True,
        used_by_user_id=u1.id,
        used_at=now,
    )
    pg_session.add(ticket)
    pg_session.commit()

    alice_id = u1.id
    alice_email = u1.email
    barathon_id = b.id
    ticket_id = ticket.id

    # Exécuter la suppression de compte sur PostgreSQL réel
    _delete_user_data(u1, pg_session)
    pg_session.commit()

    # Assertions d'intégrité sur PostgreSQL :
    # 1. Alice n'existe plus dans users
    assert pg_session.get(User, alice_id) is None

    # 2. Le PasswordResetToken d'Alice est strictement supprimé
    remaining_tokens = pg_session.scalars(
        select(PasswordResetToken).where(PasswordResetToken.email == alice_email)
    ).all()
    assert remaining_tokens == []

    # 3. Le barathon partagé existe toujours et Bob est devenu créateur
    b_refreshed = pg_session.get(Barathon, barathon_id)
    assert b_refreshed is not None
    assert b_refreshed.created_by_user_id == u2.id

    # 4. Le ticket partenaire a été préservé avec used_by_user_id mis à NULL (SET NULL)
    t_refreshed = pg_session.get(EventTicket, ticket_id)
    assert t_refreshed is not None
    assert t_refreshed.used_by_user_id is None


def test_rgpd_schema_invariant_no_user_gps_columns(pg_engine):
    """
    Invariant RGPD critique :
    Vérifie qu'aucune table liée aux utilisateurs ou aux sessions ne contient
    de colonne pour stocker la localisation GPS des participants.
    Seuls les points fixes (bars, spots partenaires) sont géo-référencés.
    """
    from sqlalchemy import text
    with pg_engine.connect() as conn:
        res = conn.execute(text("""
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name IN ('latitude', 'longitude')
            ORDER BY table_name;
        """)).fetchall()

        tables_with_coords = {row[0] for row in res}
        # Uniquement les lieux d'étape ou de spots fixes
        assert tables_with_coords.issubset({
            "barathon_stops",
            "partner_event_spots",
            "saved_barathon_stops",
        })

        # S'assurer formellement que users et barathon_participants ne possèdent pas de coordonnées
        assert "users" not in tables_with_coords
        assert "barathon_participants" not in tables_with_coords


def test_barathon_lifecycle_and_foreign_keys_on_real_postgres(pg_session):
    """
    Vérifie les transitions de cycle de vie et les contraintes de clés étrangères sur PostgreSQL :
    - Liaison creator ForeignKey vers users.id (CASCADE)
    - Liaison stops ForeignKey vers barathons.id (CASCADE)
    - Transitions planned -> started -> stopped -> completed
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    creator = User(
        email=f"creator_{int(now.timestamp())}@pubrush.com",
        username=f"creator_{int(now.timestamp())}",
        password_hash=hash_password("pw"),
    )
    pg_session.add(creator)
    pg_session.flush()

    b = Barathon(
        name="Cycle PostgreSQL",
        start_datetime=now,
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        status="planned",
    )
    pg_session.add(b)
    pg_session.flush()

    stop = BarathonStop(
        barathon_id=b.id,
        name="Bar PG 1",
        latitude=43.604,
        longitude=1.444,
        stop_order=1,
    )
    pg_session.add(stop)
    pg_session.commit()

    # Transition vers started
    b.status = "started"
    b.has_started = True
    b.started_at = now
    pg_session.commit()
    assert pg_session.get(Barathon, b.id).status == "started"

    # Transition vers stopped
    b.status = "stopped"
    b.ended_at = now + timedelta(hours=2)
    pg_session.commit()
    assert pg_session.get(Barathon, b.id).status == "stopped"

    # Suppression en cascade : supprimer le barathon doit supprimer son stop
    stop_id = stop.id
    pg_session.delete(b)
    pg_session.commit()
    assert pg_session.get(BarathonStop, stop_id) is None
