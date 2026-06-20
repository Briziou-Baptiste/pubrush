import pytest
from unittest.mock import patch
from app.models import PasswordResetToken, User
from sqlalchemy import select

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_search_users(client, user_auth_headers, test_user_2):
    # Test searching for users by username prefix
    response = client.get("/users/search?q=test", headers=user_auth_headers)
    assert response.status_code == 200
    results = response.json()
    # Should find testuser and testuser2
    assert len(results) >= 2
    usernames = [u["username"] for u in results]
    assert "testuser" in usernames
    assert "testuser2" in usernames

    # Prefix mismatch
    response = client.get("/users/search?q=nonexistent", headers=user_auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 0

def test_get_roles(client, user_auth_headers, test_roles):
    response = client.get("/roles", headers=user_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    role_names = [r["name"] for r in data]
    assert "Capitaine" in role_names
    assert "Trésorier" in role_names
    assert "Sam" in role_names

@patch("app.main.send_reset_code_email")
def test_password_reset_flow(mock_send_email, client, db_session, test_user):
    mock_send_email.return_value = True

    # 1. Request password reset
    payload_req = {"email": test_user.email}
    response = client.post("/forgot-password/request", json=payload_req)
    assert response.status_code == 200
    assert "code de réinitialisation" in response.json()["message"]
    assert mock_send_email.called

    # 2. Extract code from SQLite
    token_entry = db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.email == test_user.email)
    )
    assert token_entry is not None
    code = token_entry.token

    # 3. Confirm password reset with incorrect code -> 400
    payload_confirm_fail = {
        "email": test_user.email,
        "code": "000000",
        "new_password": "newsecurepassword123"
    }
    response = client.post("/forgot-password/reset", json=payload_confirm_fail)
    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"]

    # 4. Confirm password reset with correct code
    payload_confirm_success = {
        "email": test_user.email,
        "code": code,
        "new_password": "newsecurepassword123"
    }
    response = client.post("/forgot-password/reset", json=payload_confirm_success)
    assert response.status_code == 200
    assert "succès" in response.json()["message"]

    # 5. Token is deleted from DB
    deleted_token = db_session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.email == test_user.email)
    )
    assert deleted_token is None

    # 6. Try to login with new password
    payload_login = {
        "email": test_user.email,
        "password": "newsecurepassword123"
    }
    response = client.post("/login", json=payload_login)
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_admin_endpoints_security(client, user_auth_headers, admin_auth_headers, test_user, test_user_2):
    # 1. Access without token -> 401
    response = client.get("/admin/stats")
    assert response.status_code == 401

    # 2. Access with standard user token -> 403
    response = client.get("/admin/stats", headers=user_auth_headers)
    assert response.status_code == 403

    # 3. Access with admin token -> 200
    response = client.get("/admin/stats", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_barathons" in data

    # 4. Get all users -> 200
    response = client.get("/admin/users", headers=admin_auth_headers)
    assert response.status_code == 200
    users_list = response.json()
    assert len(users_list) >= 2

    # 5. Toggle admin role -> 200
    response = client.put(f"/admin/users/{test_user_2.id}/toggle-admin", headers=admin_auth_headers)
    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["is_admin"] is True

    # Toggle back
    response = client.put(f"/admin/users/{test_user_2.id}/toggle-admin", headers=admin_auth_headers)
    assert response.status_code == 200
    updated_user = response.json()
    assert updated_user["is_admin"] is False

    # 6. Create, update, link and delete Partner Event and Map Filter
    # Standard user cannot create event -> 403
    payload_event = {
        "name": "Soirée Test",
        "code": "TEST1234",
        "description": "Description test",
        "is_active": True
    }
    response = client.post("/admin/partner-events", json=payload_event, headers=user_auth_headers)
    assert response.status_code == 403

    # Admin can create event -> 200
    response = client.post("/admin/partner-events", json=payload_event, headers=admin_auth_headers)
    assert response.status_code == 200
    event_data = response.json()
    assert event_data["name"] == "Soirée Test"
    event_id = event_data["id"]

    # Standard user can fetch active partner events list -> 200
    response = client.get("/partner-events", headers=user_auth_headers)
    assert response.status_code == 200
    events_list = response.json()
    assert len(events_list) >= 1
    assert any(e["id"] == event_id for e in events_list)

    # Admin can create private event -> 200
    payload_event_private = {
        "name": "Soirée Privée",
        "code": "PVT2026",
        "description": "Description privée",
        "is_active": True,
        "requires_ticket": True
    }
    response = client.post("/admin/partner-events", json=payload_event_private, headers=admin_auth_headers)
    assert response.status_code == 200
    event_pvt = response.json()
    assert event_pvt["requires_ticket"] is True
    pvt_event_id = event_pvt["id"]

    # Standard user can fetch active partner events list -> 200 (shows is_unlocked == False for the private one)
    response = client.get("/partner-events", headers=user_auth_headers)
    assert response.status_code == 200
    events_list_2 = response.json()
    matching_events = [e for e in events_list_2 if e["id"] == pvt_event_id]
    assert len(matching_events) == 1
    assert matching_events[0]["is_unlocked"] is False

    # Admin generates tickets -> 200
    response = client.post(f"/admin/partner-events/{pvt_event_id}/tickets/generate", json={"count": 5}, headers=admin_auth_headers)
    assert response.status_code == 200
    tickets = response.json()
    assert len(tickets) == 5
    ticket_code = tickets[0]["ticket_code"]

    # Admin can list tickets -> 200
    response = client.get(f"/admin/partner-events/{pvt_event_id}/tickets", headers=admin_auth_headers)
    assert response.status_code == 200
    tickets_list = response.json()
    assert len(tickets_list) == 5
    assert any(t["ticket_code"] == ticket_code and t["is_used"] is False for t in tickets_list)

    # Standard user redeems ticket -> 200
    response = client.post("/partner-events/redeem-ticket", json={"ticket_code": ticket_code}, headers=user_auth_headers)
    assert response.status_code == 200
    redeem_data = response.json()
    assert redeem_data["is_unlocked"] is True

    # Standard user fetches active partner events list -> 200 (shows is_unlocked == True now!)
    response = client.get("/partner-events", headers=user_auth_headers)
    assert response.status_code == 200
    events_list_3 = response.json()
    matching_events_3 = [e for e in events_list_3 if e["id"] == pvt_event_id]
    assert len(matching_events_3) == 1
    assert matching_events_3[0]["is_unlocked"] is True

    # Admin lists tickets again -> shows ticket is used by the test user
    response = client.get(f"/admin/partner-events/{pvt_event_id}/tickets", headers=admin_auth_headers)
    assert response.status_code == 200
    tickets_list_2 = response.json()
    used_tickets = [t for t in tickets_list_2 if t["ticket_code"] == ticket_code]
    assert len(used_tickets) == 1
    assert used_tickets[0]["is_used"] is True
    assert used_tickets[0]["used_by_username"] == test_user.username

    # Test GET /partner-events/validate endpoint (requires ticket since pvt_event requires ticket)
    # The user has redeemed the ticket so validation should succeed
    response = client.get(f"/partner-events/validate?code={event_pvt['code']}", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["code"] == event_pvt['code']

    # Test POST /partner-events/{event_id}/join endpoint for private event
    # Sould succeed since user redeemed ticket
    response = client.post(f"/partner-events/{pvt_event_id}/join", headers=user_auth_headers)
    assert response.status_code == 200

    # Let's create a public event to test join without ticket
    payload_event_pub = {
        "name": "Evenement Public",
        "code": "PUB_EVENT_123",
        "description": "Un event public",
        "is_active": True,
        "requires_ticket": False
    }
    response = client.post("/admin/partner-events", json=payload_event_pub, headers=admin_auth_headers)
    assert response.status_code == 200
    pub_event_id = response.json()["id"]

    # Test join public event -> 200
    response = client.post(f"/partner-events/{pub_event_id}/join", headers=user_auth_headers)
    assert response.status_code == 200

    # Clean up events
    response = client.delete(f"/admin/partner-events/{pvt_event_id}", headers=admin_auth_headers)
    assert response.status_code == 200
    response = client.delete(f"/admin/partner-events/{pub_event_id}", headers=admin_auth_headers)
    assert response.status_code == 200


    # Admin can create map filter -> 200
    payload_filter = {
        "key": "test_filter",
        "label": "Filtre Test",
        "icon": "test_icon",
        "osm_query": "node(area.searchArea);",
        "is_global": False
    }
    response = client.post("/admin/map-filters", json=payload_filter, headers=admin_auth_headers)
    assert response.status_code == 200
    filter_data = response.json()
    assert filter_data["key"] == "test_filter"
    filter_id = filter_data["id"]

    # Admin can link filter to event -> 200
    response = client.post(f"/admin/partner-events/{event_id}/filters/{filter_id}", headers=admin_auth_headers)
    assert response.status_code == 200
    link_data = response.json()
    assert len(link_data["filters"]) == 1

    # Admin can delete filter -> 200
    response = client.delete(f"/admin/map-filters/{filter_id}", headers=admin_auth_headers)
    assert response.status_code == 200

    # Admin can delete event -> 200
    response = client.delete(f"/admin/partner-events/{event_id}", headers=admin_auth_headers)
    assert response.status_code == 200


def test_admin_stats_endpoints(client, admin_auth_headers, user_auth_headers, db_session, test_user):
    # Test GET /admin/stats/users-registration
    response = client.get("/admin/stats/users-registration?period=day", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        # Check that formatting is XX/XX (digit/digit)
        assert "/" in data[0]["label"]
        parts = data[0]["label"].split("/")
        assert len(parts) == 2
        assert parts[0].isdigit() and parts[1].isdigit()

    response = client.get("/admin/stats/users-registration?period=month", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        # Check that formatting is XX/XX (digit/digit)
        assert "/" in data[0]["label"]
        parts = data[0]["label"].split("/")
        assert len(parts) == 2
        assert parts[0].isdigit() and parts[1].isdigit()

    # Test GET /admin/stats/app-usage
    response = client.get("/admin/stats/app-usage?period=day", headers=admin_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "/" in data[0]["label"]

    # Test GET /admin/partner-events/{event_id}/stats
    # Create a test event first
    payload_event = {
        "name": "Event Stats Test",
        "code": "STATSTEST",
        "description": "Desc",
        "is_active": True
    }
    resp = client.post("/admin/partner-events", json=payload_event, headers=admin_auth_headers)
    assert resp.status_code == 200
    event_id = resp.json()["id"]

    # Join the event to record stats
    response = client.post(f"/partner-events/{event_id}/join", headers=user_auth_headers)
    assert response.status_code == 200

    response = client.get(f"/admin/partner-events/{event_id}/stats", headers=admin_auth_headers)
    assert response.status_code == 200
    event_stats = response.json()
    assert isinstance(event_stats, list)
    assert len(event_stats) > 0
    assert "/" in event_stats[0]["label"]
    parts = event_stats[0]["label"].split("/")
    assert len(parts) == 2
    assert parts[0].isdigit() and parts[1].isdigit()

    # Clean up
    client.delete(f"/admin/partner-events/{event_id}", headers=admin_auth_headers)


