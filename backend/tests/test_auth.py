import pytest
from datetime import datetime, timedelta

def test_register_success(client):
    payload = {
        "email": "newuser@pubrush.com",
        "username": "newuser",
        "password": "strongpassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert "id" in data
    assert "password_hash" not in data

def test_register_duplicate_email(client, test_user):
    payload = {
        "email": test_user.email,
        "username": "distinctusername",
        "password": "somepassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Cette adresse email est déjà enregistrée."

def test_register_duplicate_username(client, test_user):
    payload = {
        "email": "distinctemail@pubrush.com",
        "username": test_user.username,
        "password": "somepassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Ce nom d'utilisateur est déjà pris."

def test_login_success(client, test_user):
    payload = {
        "email": test_user.email,
        "password": "password123"
    }
    response = client.post("/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_unknown_user(client):
    payload = {
        "email": "unknown@pubrush.com",
        "password": "password123"
    }
    response = client.post("/login", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Utilisateur inconnu"

def test_login_wrong_password(client, test_user):
    payload = {
        "email": test_user.email,
        "password": "wrongpassword"
    }
    response = client.post("/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Mauvais mot de passe"

def test_me_success(client, user_auth_headers, test_user):
    response = client.get("/me", headers=user_auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert data["username"] == test_user.username

def test_me_unauthorized(client):
    response = client.get("/me")
    assert response.status_code == 401


def test_change_password_success(client, user_auth_headers, test_user):
    payload = {
        "old_password": "password123",
        "new_password": "newpassword123"
    }
    response = client.post("/change-password", json=payload, headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Votre mot de passe a été modifié avec succès."

    # Now verify login with new password works
    login_payload = {
        "email": test_user.email,
        "password": "newpassword123"
    }
    response = client.post("/login", json=login_payload)
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_change_password_wrong_old(client, user_auth_headers):
    payload = {
        "old_password": "wrongpassword",
        "new_password": "newpassword123"
    }
    response = client.post("/change-password", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "L'ancien mot de passe est incorrect."


def test_change_password_unauthorized(client):
    payload = {
        "old_password": "password123",
        "new_password": "newpassword123"
    }
    response = client.post("/change-password", json=payload)
    assert response.status_code == 401


def test_update_username_success(client, user_auth_headers, test_user):
    payload = {"username": "newusername"}
    response = client.put("/me", json=payload, headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "newusername"


def test_update_username_duplicate(client, user_auth_headers, test_user_2):
    payload = {"username": test_user_2.username}
    response = client.put("/me", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Ce nom d'utilisateur est déjà pris."


def test_register_duplicate_username_case_insensitive(client, test_user):
    payload = {
        "email": "anotherdistinctemail@pubrush.com",
        "username": test_user.username.upper(),
        "password": "somepassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Ce nom d'utilisateur est déjà pris."


def test_register_duplicate_email_case_insensitive(client, test_user):
    payload = {
        "email": test_user.email.upper(),
        "username": "anotherdistinctusername",
        "password": "somepassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Cette adresse email est déjà enregistrée."


def test_update_username_duplicate_case_insensitive(client, user_auth_headers, test_user_2):
    payload = {"username": test_user_2.username.upper()}
    response = client.put("/me", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Ce nom d'utilisateur est déjà pris."


def test_update_username_case_change(client, user_auth_headers, test_user):
    payload = {"username": test_user.username.upper()}
    response = client.put("/me", json=payload, headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == test_user.username.upper()


def test_delete_account_solo_barathon(client, user_auth_headers, test_user, db_session):
    from app.models import Barathon
    # Create a barathon where test_user is the creator and ONLY participant
    payload = {
        "name": "Solo Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [],
        "stops": []
    }
    res = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert res.status_code == 201
    barathon_id = res.json()["id"]

    # Delete User account
    del_res = client.delete("/me", headers=user_auth_headers)
    assert del_res.status_code == 200

    # Verify user is deleted
    login_payload = {
        "email": test_user.email,
        "password": "password123"
    }
    login_res = client.post("/login", json=login_payload)
    assert login_res.status_code == 404

    # Verify barathon is deleted as well (since they were the only participant)
    db_session.expire_all()
    barathon_db = db_session.get(Barathon, barathon_id)
    assert barathon_db is None


def test_delete_account_shared_barathon(client, user_auth_headers, test_user, test_user_2, db_session):
    from app.models import Barathon
    # Create a barathon where test_user is the creator, and test_user_2 is a participant
    payload = {
        "name": "Shared Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [test_user_2.id],
        "stops": []
    }
    res = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert res.status_code == 201
    barathon_id = res.json()["id"]

    # Delete User account
    del_res = client.delete("/me", headers=user_auth_headers)
    assert del_res.status_code == 200

    # Verify user is deleted
    login_payload = {
        "email": test_user.email,
        "password": "password123"
    }
    login_res = client.post("/login", json=login_payload)
    assert login_res.status_code == 404

    # Verify barathon is NOT deleted (since test_user_2 was also a participant)
    db_session.expire_all()
    barathon_db = db_session.get(Barathon, barathon_id)
    assert barathon_db is not None
    # Verify creator has been reassigned to test_user_2
    assert barathon_db.created_by_user_id == test_user_2.id


def test_get_my_stats(client, user_auth_headers, test_user, test_user_2, db_session):
    from app.models import Barathon, BarathonParticipant, BarathonStop
    # 1. Fetch stats initially -> all should be 0
    res = client.get("/me/stats", headers=user_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["barathons_created"] == 0
    assert data["barathons_completed"] == 0
    assert data["bars_visited"] == 0

    # 2. Create one barathon (created_by test_user, status planned, has 2 stops)
    barathon = Barathon(
        name="Stats test",
        start_datetime=datetime.utcnow() + timedelta(days=1),
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=30,
        created_by_user_id=test_user.id,
        status="planned"
    )
    db_session.add(barathon)
    db_session.commit()
    db_session.refresh(barathon)

    # Add participants
    p1 = BarathonParticipant(barathon_id=barathon.id, user_id=test_user.id, role="creator")
    db_session.add(p1)

    # Add stops
    s1 = BarathonStop(barathon_id=barathon.id, name="Stop 1", latitude=48.0, longitude=2.0, stop_order=1, is_completed=True)
    s2 = BarathonStop(barathon_id=barathon.id, name="Stop 2", latitude=48.1, longitude=2.1, stop_order=2, is_completed=False)
    db_session.add(s1)
    db_session.add(s2)
    db_session.commit()

    # Fetch stats now -> created = 1, completed = 0 (planned is not completed), visited = 1
    res = client.get("/me/stats", headers=user_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["barathons_created"] == 1
    assert data["barathons_completed"] == 0
    assert data["bars_visited"] == 1

    # 3. Change barathon status to completed
    barathon.status = "completed"
    db_session.commit()

    # Fetch stats -> created = 1, completed = 1, visited = 1
    res = client.get("/me/stats", headers=user_auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["barathons_created"] == 1
    assert data["barathons_completed"] == 1
    assert data["bars_visited"] == 1
