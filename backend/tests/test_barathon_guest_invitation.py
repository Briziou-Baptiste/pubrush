import pytest
from datetime import datetime, timedelta, timezone
from app.models import Barathon, BarathonParticipant, BarathonStop, User


def create_sample_barathon_with_code(db_session, creator, join_code="RUSH-TEST"):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name="Soirée Test Invitations",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        join_code=join_code,
    )
    db_session.add(b)
    db_session.flush()

    p = BarathonParticipant(barathon_id=b.id, user_id=creator.id, role="creator")
    db_session.add(p)

    s1 = BarathonStop(
        barathon_id=b.id,
        name="Bar Central",
        latitude=43.6000,
        longitude=1.4400,
        stop_order=1,
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(b)
    return b


def test_preview_by_code_success(client, db_session, test_user):
    barathon = create_sample_barathon_with_code(db_session, test_user, "RUSH-PREV")

    res = client.get("/barathons/by-code/rush-prev")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == barathon.id
    assert data["name"] == "Soirée Test Invitations"
    assert data["join_code"] == "RUSH-PREV"
    assert data["creator_username"] == test_user.username
    assert data["stops_count"] == 1
    assert data["participants_count"] == 1


def test_preview_by_code_not_found(client):
    res = client.get("/barathons/by-code/UNKNOWN-CODE")
    assert res.status_code == 404
    assert "introuvable" in res.json()["detail"]


def test_join_guest_success(client, db_session, test_user):
    barathon = create_sample_barathon_with_code(db_session, test_user, "RUSH-JOIN")

    payload = {
        "join_code": "RUSH-JOIN",
        "username": "InvitéCool",
    }
    res = client.post("/barathons/join-guest", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "InvitéCool"
    assert data["user"]["is_guest"] is True
    assert data["barathon"]["id"] == barathon.id

    # Verify guest is saved in DB and is in participants
    guest_user = db_session.query(User).filter_by(username="InvitéCool").first()
    assert guest_user is not None
    assert guest_user.is_guest is True

    participant = (
        db_session.query(BarathonParticipant)
        .filter_by(barathon_id=barathon.id, user_id=guest_user.id)
        .first()
    )
    assert participant is not None
    assert participant.role == "participant"


def test_join_guest_rejoin_same_barathon(client, db_session, test_user):
    barathon = create_sample_barathon_with_code(db_session, test_user, "RUSH-REJOIN")

    # 1. First join succeeds
    res1 = client.post("/barathons/join-guest", json={"join_code": "RUSH-REJOIN", "username": "Léa"})
    assert res1.status_code == 201
    assert "access_token" in res1.json()

    # 2. Re-join with same name in same barathon must fail with 409 Conflict (anti-usurpation)
    res2 = client.post("/barathons/join-guest", json={"join_code": "RUSH-REJOIN", "username": "Léa"})
    assert res2.status_code == 409
    assert res2.headers.get("X-Error-Code") == "GUEST_USERNAME_TAKEN"
    assert "Ce pseudo est déjà utilisé dans ce barathon." in res2.json()["detail"]

    # 3. Re-join with case-insensitive variant must also fail with 409 Conflict
    res3 = client.post("/barathons/join-guest", json={"join_code": "RUSH-REJOIN", "username": "léa"})
    assert res3.status_code == 409
    assert res3.headers.get("X-Error-Code") == "GUEST_USERNAME_TAKEN"
    assert "Ce pseudo est déjà utilisé dans ce barathon." in res3.json()["detail"]


def test_join_guest_completed_barathon_rejected(client, db_session, test_user):
    barathon = create_sample_barathon_with_code(db_session, test_user, "RUSH-END")
    barathon.status = "completed"
    db_session.commit()

    res = client.post("/barathons/join-guest", json={"join_code": "RUSH-END", "username": "Latecomer"})
    assert res.status_code == 400
    assert "terminé" in res.json()["detail"]
