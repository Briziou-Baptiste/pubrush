"""BUGFIX-018 contract tests. All users and barathons live in fixture SQLite memory."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import Barathon, BarathonParticipant, BarathonParticipantRole, BarathonStop, Role, User


def fixture_barathon(db, creator, state="planned", done=0, total=2):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    barathon = Barathon(
        name="BUGFIX-018 isolated fixture", start_datetime=now + timedelta(days=1),
        has_started=state not in ("planned", "failed"), status=state,
        started_at=now if state not in ("planned", "failed") else None,
        ended_at=now if state in ("completed", "stopped", "failed") else None,
        travel_time_between_bars_minutes=10, max_time_in_bar_minutes=45,
        created_by_user_id=creator.id, join_code="RUSH-B018",
    )
    db.add(barathon)
    db.flush()
    db.add(BarathonParticipant(barathon_id=barathon.id, user_id=creator.id, role="creator"))
    for index in range(total):
        db.add(BarathonStop(barathon_id=barathon.id, name=f"Fixture {index}",
                            latitude=43.6, longitude=1.44, stop_order=index + 1,
                            is_completed=index < done))
    db.commit()
    return barathon


@pytest.mark.parametrize("state", ["planned", "started"])
def test_invite_second_participant_before_and_after_start(client, db_session, test_user, user_auth_headers, state):
    b = fixture_barathon(db_session, test_user, state)
    details = client.get(f"/barathons/{b.id}", headers=user_auth_headers).json()
    preview = client.get(f"/barathons/by-code/{details['join_code']}")
    assert preview.status_code == 200
    assert preview.json()["id"] == b.id
    assert preview.json()["status"] == state
    joined = client.post("/barathons/join-guest", json={"join_code": details["join_code"], "username": "FixtureGuest018"})
    assert joined.status_code == 201
    guest = joined.json()
    assert guest["barathon"]["id"] == b.id
    assert guest["user"]["id"] != test_user.id
    guest_details = client.get(f"/barathons/{b.id}", headers={"Authorization": f"Bearer {guest['access_token']}"})
    assert guest_details.status_code == 200
    assert guest_details.json()["status"] == state
    assert len(guest_details.json()["participants"]) == 2
    assert client.get("/barathons/my/upcoming" if state == "planned" else "/barathons/my/active", headers=user_auth_headers).status_code == 200


@pytest.mark.parametrize("state", ["completed", "stopped", "failed"])
def test_closed_invitation_does_not_create_guest_or_participant(client, db_session, test_user, state):
    fixture_barathon(db_session, test_user, state)
    response = client.post("/barathons/join-guest", json={"join_code": "RUSH-B018", "username": "ForbiddenGuest018"})
    assert response.status_code == 400
    assert db_session.scalar(select(User).where(User.username == "ForbiddenGuest018")) is None
    assert len(db_session.scalars(select(BarathonParticipant)).all()) == 1


def test_delete_confirmed_and_absent_from_lists_details_and_invitation(client, db_session, test_user, user_auth_headers):
    b = fixture_barathon(db_session, test_user)
    barathon_id = b.id
    assert client.delete(f"/barathons/{barathon_id}", headers=user_auth_headers).status_code == 204
    assert db_session.get(Barathon, barathon_id) is None
    assert db_session.scalars(select(BarathonParticipant)).all() == []
    assert db_session.scalars(select(BarathonStop)).all() == []
    for route in ("my/upcoming", "my/past"):
        response = client.get(f"/barathons/{route}", headers=user_auth_headers)
        assert response.status_code == 200
        assert all(row["id"] != barathon_id for row in response.json())
    assert client.get(f"/barathons/{barathon_id}", headers=user_auth_headers).status_code == 404
    assert client.get("/barathons/by-code/RUSH-B018").status_code == 404
    assert client.post("/barathons/join-guest", json={"join_code": "RUSH-B018", "username": "DeletedGuest018"}).status_code == 404
    assert client.delete(f"/barathons/{barathon_id}", headers=user_auth_headers).status_code == 404


def test_unauthorized_delete_is_not_confirmed_or_applied(client, db_session, test_user, user_2_auth_headers):
    b = fixture_barathon(db_session, test_user)
    assert client.delete(f"/barathons/{b.id}", headers=user_2_auth_headers).status_code == 403
    assert db_session.get(Barathon, b.id) is not None


@pytest.mark.parametrize("done,total", [(2, 2), (1, 2), (0, 0)])
def test_finish_records_lifecycle_without_rewriting_historical_stop_results(client, db_session, test_user, user_auth_headers, done, total):
    b = fixture_barathon(db_session, test_user, "started", done, total)
    response = client.post(f"/barathons/{b.id}/finish", headers=user_auth_headers)
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "completed"
    assert result["ended_at"] is not None
    assert sum(stop["is_completed"] for stop in result["stops"]) == done
    past = client.get("/barathons/my/past", headers=user_auth_headers).json()
    detail = client.get(f"/barathons/{b.id}", headers=user_auth_headers).json()
    assert past[0]["status"] == detail["status"] == "completed"
    assert past[0]["stops"] == detail["stops"]


def test_stop_is_interruption_even_with_all_stops_done(client, db_session, test_user, user_auth_headers):
    b = fixture_barathon(db_session, test_user, "started", done=2)
    response = client.post(f"/barathons/{b.id}/stop", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "stopped"
    detail = client.get(f"/barathons/{b.id}", headers=user_auth_headers).json()
    assert all(stop["is_completed"] for stop in detail["stops"])
    assert detail["status"] == "stopped"
    assert client.post(f"/barathons/{b.id}/finish", headers=user_auth_headers).status_code == 400


@pytest.mark.parametrize("role_name", ["Capitaine", "Maître du trajet", "Maître des comptes", None])
def test_finish_permissions_match_next_step_leadership(client, db_session, test_user, test_user_2, user_2_auth_headers, role_name):
    b = fixture_barathon(db_session, test_user, "started")
    db_session.add(BarathonParticipant(barathon_id=b.id, user_id=test_user_2.id, role="participant"))
    if role_name:
        role = Role(name=role_name, description="Fixture")
        db_session.add(role)
        db_session.flush()
        db_session.add(BarathonParticipantRole(barathon_id=b.id, user_id=test_user_2.id, role_id=role.id))
    db_session.commit()
    response = client.post(f"/barathons/{b.id}/finish", headers=user_2_auth_headers)
    allowed = role_name in ("Capitaine", "Maître du trajet")
    assert response.status_code == (200 if allowed else 403)
    db_session.refresh(b)
    assert b.status == ("completed" if allowed else "started")


@pytest.mark.parametrize("state", ["planned", "completed", "stopped", "failed"])
def test_finish_rejects_invalid_lifecycle(client, db_session, test_user, user_auth_headers, state):
    b = fixture_barathon(db_session, test_user, state)
    assert client.post(f"/barathons/{b.id}/finish", headers=user_auth_headers).status_code == 400
    db_session.refresh(b)
    assert b.status == state


def test_invitation_to_normal_completion_end_to_end(client, db_session, test_user, user_auth_headers):
    b = fixture_barathon(db_session, test_user)
    joined = client.post("/barathons/join-guest", json={"join_code": b.join_code, "username": "LifecycleGuest018"})
    assert joined.status_code == 201
    guest_headers = {"Authorization": f"Bearer {joined.json()['access_token']}"}
    assert client.post(f"/barathons/{b.id}/start", headers=user_auth_headers).status_code == 200
    detail = client.get(f"/barathons/{b.id}", headers=guest_headers).json()
    assert detail["status"] == "started"
    for stop in detail["stops"]:
        assert client.post(f"/barathons/{b.id}/stops/{stop['id']}/complete", headers=user_auth_headers).status_code == 200
    finished = client.post(f"/barathons/{b.id}/finish", headers=user_auth_headers)
    assert finished.status_code == 200
    assert finished.json()["status"] == "completed"
    assert all(stop["is_completed"] for stop in finished.json()["stops"])
    assert client.get(f"/barathons/{b.id}", headers=guest_headers).json()["status"] == "completed"
    assert client.post("/barathons/join-guest", json={"join_code": b.join_code, "username": "TooLate018"}).status_code == 400
    assert client.delete(f"/barathons/{b.id}", headers=user_auth_headers).status_code == 204
    assert client.get(f"/barathons/{b.id}", headers=guest_headers).status_code == 404
