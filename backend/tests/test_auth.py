import pytest

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
    assert response.json()["detail"] == "Email already registered"

def test_register_duplicate_username(client, test_user):
    payload = {
        "email": "distinctemail@pubrush.com",
        "username": test_user.username,
        "password": "somepassword123"
    }
    response = client.post("/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already taken"

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
