import pytest
from datetime import datetime, timedelta, timezone
from app.models import Barathon, BarathonParticipant, BarathonStop


def create_sample_barathon(db_session, creator, participant=None):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name="Dynamic Stops Crawl",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
    )
    db_session.add(b)
    db_session.flush()

    # Creator participant
    p1 = BarathonParticipant(barathon_id=b.id, user_id=creator.id, role="creator")
    db_session.add(p1)

    if participant:
        p2 = BarathonParticipant(barathon_id=b.id, user_id=participant.id, role="participant")
        db_session.add(p2)

    s1 = BarathonStop(
        barathon_id=b.id,
        name="Bar Initial A",
        latitude=43.6000,
        longitude=1.4400,
        stop_order=1,
        is_completed=True,
    )
    s2 = BarathonStop(
        barathon_id=b.id,
        name="Bar Initial B",
        latitude=43.6020,
        longitude=1.4420,
        stop_order=2,
        is_completed=False,
    )
    s3 = BarathonStop(
        barathon_id=b.id,
        name="Bar Initial C",
        latitude=43.6040,
        longitude=1.4440,
        stop_order=3,
        is_completed=False,
    )
    db_session.add_all([s1, s2, s3])
    db_session.commit()
    db_session.refresh(b)
    return b


def test_replace_stop_success(client, db_session, test_user, test_user_2, user_auth_headers):
    barathon = create_sample_barathon(db_session, test_user, test_user_2)
    stop_to_replace = barathon.stops[1]  # Stop B (stop_order=2, is_completed=False)

    payload = {
        "name": "Bar de Remplacement",
        "latitude": 43.6025,
        "longitude": 1.4425,
        "stop_type": "bar",
        "reason": "fermé",
    }
    res = client.post(
        f"/barathons/{barathon.id}/stops/{stop_to_replace.id}/replace",
        json=payload,
        headers=user_auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["stops"]) == 3
    replaced = next(s for s in data["stops"] if s["id"] == stop_to_replace.id)
    assert replaced["name"] == "Bar de Remplacement"
    assert replaced["stop_order"] == 2
    assert replaced["is_completed"] is False


def test_replace_completed_stop_rejected(client, db_session, test_user, user_auth_headers):
    barathon = create_sample_barathon(db_session, test_user)
    completed_stop = barathon.stops[0]  # Stop A (is_completed=True)

    payload = {
        "name": "Bar Nouveau",
        "latitude": 43.6010,
        "longitude": 1.4410,
        "stop_type": "bar",
        "reason": "bondé",
    }
    res = client.post(
        f"/barathons/{barathon.id}/stops/{completed_stop.id}/replace",
        json=payload,
        headers=user_auth_headers,
    )
    assert res.status_code == 400
    assert "déjà terminée" in res.json()["detail"]


def test_replace_stop_forbidden_for_non_creator(client, db_session, test_user, test_user_2, user_2_auth_headers):
    barathon = create_sample_barathon(db_session, test_user, test_user_2)
    stop_to_replace = barathon.stops[1]

    payload = {
        "name": "Bar Pirate",
        "latitude": 43.6050,
        "longitude": 1.4450,
        "stop_type": "bar",
        "reason": "bondé",
    }
    # test_user_2 is a participant, not the creator
    res = client.post(
        f"/barathons/{barathon.id}/stops/{stop_to_replace.id}/replace",
        json=payload,
        headers=user_2_auth_headers,
    )
    assert res.status_code == 403
    assert "Maître du trajet" in res.json()["detail"]


def test_add_stop_at_end(client, db_session, test_user, user_auth_headers):
    barathon = create_sample_barathon(db_session, test_user)

    payload = {
        "name": "Bar Extra Final",
        "latitude": 43.6060,
        "longitude": 1.4460,
        "stop_type": "bar",
        "position": "at_end",
    }
    res = client.post(
        f"/barathons/{barathon.id}/stops/add",
        json=payload,
        headers=user_auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert len(data["stops"]) == 4
    stops_sorted = sorted(data["stops"], key=lambda s: s["stop_order"])
    assert stops_sorted[-1]["name"] == "Bar Extra Final"
    assert stops_sorted[-1]["stop_order"] == 4


def test_add_stop_before_and_after_current(client, db_session, test_user, user_auth_headers):
    barathon = create_sample_barathon(db_session, test_user)
    current_stop = barathon.stops[1]  # Stop order 2

    # 1. Insert before current stop (order 2) -> new stop gets 2, existing gets 3, etc.
    payload_before = {
        "name": "Bar Inséré Avant",
        "latitude": 43.6015,
        "longitude": 1.4415,
        "stop_type": "bar",
        "position": "before_current",
        "current_stop_id": current_stop.id,
    }
    res_before = client.post(
        f"/barathons/{barathon.id}/stops/add",
        json=payload_before,
        headers=user_auth_headers,
    )
    assert res_before.status_code == 201
    data_before = res_before.json()
    assert len(data_before["stops"]) == 4
    stops_order_map = {s["name"]: s["stop_order"] for s in data_before["stops"]}
    assert stops_order_map["Bar Initial A"] == 1
    assert stops_order_map["Bar Inséré Avant"] == 2
    assert stops_order_map["Bar Initial B"] == 3
    assert stops_order_map["Bar Initial C"] == 4

    # 2. Insert after "Bar Inséré Avant" (which is now order 2) -> gets order 3
    new_curr = next(s for s in data_before["stops"] if s["name"] == "Bar Inséré Avant")
    payload_after = {
        "name": "Bar Inséré Après",
        "latitude": 43.6018,
        "longitude": 1.4418,
        "stop_type": "bar",
        "position": "after_current",
        "current_stop_id": new_curr["id"],
    }
    res_after = client.post(
        f"/barathons/{barathon.id}/stops/add",
        json=payload_after,
        headers=user_auth_headers,
    )
    assert res_after.status_code == 201
    data_after = res_after.json()
    assert len(data_after["stops"]) == 5
    stops_order_map2 = {s["name"]: s["stop_order"] for s in data_after["stops"]}
    assert stops_order_map2["Bar Initial A"] == 1
    assert stops_order_map2["Bar Inséré Avant"] == 2
    assert stops_order_map2["Bar Inséré Après"] == 3
    assert stops_order_map2["Bar Initial B"] == 4
    assert stops_order_map2["Bar Initial C"] == 5
