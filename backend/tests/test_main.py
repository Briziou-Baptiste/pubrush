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
