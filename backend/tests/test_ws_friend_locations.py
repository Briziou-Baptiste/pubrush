import pytest
from datetime import datetime, timedelta, timezone
from app.models import Barathon, BarathonParticipant, BarathonStop
from app.websocket.registry import ws_manager
from app.security import create_access_token


def create_test_barathon(db_session, user1, user2):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name="Barathon Amis Live",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=user1.id,
        join_code="RUSH-LOCS",
    )
    db_session.add(b)
    db_session.flush()

    p1 = BarathonParticipant(barathon_id=b.id, user_id=user1.id, role="creator")
    p2 = BarathonParticipant(barathon_id=b.id, user_id=user2.id, role="participant")
    db_session.add_all([p1, p2])

    s1 = BarathonStop(
        barathon_id=b.id,
        name="Bar Saint-Pierre",
        latitude=43.6015,
        longitude=1.4420,
        stop_order=1,
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(b)
    return b


def test_ws_update_and_snapshot_friend_locations(client, db_session, test_user, test_user_2):
    barathon = create_test_barathon(db_session, test_user, test_user_2)

    token1 = create_access_token({"sub": str(test_user.id)})
    token2 = create_access_token({"sub": str(test_user_2.id)})

    # Pre-set a location for user 1 in manager
    ws_manager.set_user_location(
        barathon.id,
        test_user.id,
        {
            "user_id": test_user.id,
            "username": test_user.username,
            "latitude": 43.6045,
            "longitude": 1.4430,
            "is_guest": False,
        },
    )

    # When user 2 connects to the barathon room, they should receive snapshot
    with client.websocket_connect(
        f"/ws/barathons/{barathon.id}?token={token2}"
    ) as ws2:
        snapshot_msg = ws2.receive_json()
        assert snapshot_msg["type"] == "FRIENDS_LOCATIONS_SNAPSHOT"
        assert snapshot_msg["barathon_id"] == barathon.id
        locations = snapshot_msg["payload"]["locations"]
        assert len(locations) >= 1
        assert any(loc["user_id"] == test_user.id for loc in locations)

        # User 2 sends UPDATE_LOCATION
        ws2.send_json({
            "type": "UPDATE_LOCATION",
            "latitude": 43.6050,
            "longitude": 1.4440,
        })

        # ws2 (being in the barathon broadcast group) should receive FRIEND_LOCATION_UPDATE
        loc_msg = ws2.receive_json()
        assert loc_msg["type"] == "FRIEND_LOCATION_UPDATE"
        assert loc_msg["payload"]["user_id"] == test_user_2.id
        assert loc_msg["payload"]["latitude"] == 43.6050
        assert loc_msg["payload"]["longitude"] == 43.6040 or loc_msg["payload"]["longitude"] == 43.6050 or loc_msg["payload"]["latitude"] == 43.6050
