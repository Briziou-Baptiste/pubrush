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


def test_admin_endpoints_security(client, user_auth_headers, admin_auth_headers, test_user_2):
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

