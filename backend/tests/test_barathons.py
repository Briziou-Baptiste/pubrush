import pytest
from datetime import datetime, timedelta

def test_create_barathon_success(client, user_auth_headers, test_user_2):
    payload = {
        "name": "Super Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 15,
        "max_time_in_bar_minutes": 60,
        "participant_user_ids": [test_user_2.id],
        "stops": [
            {
                "name": "Bar 1",
                "stop_type": "bar",
                "latitude": 48.8566,
                "longitude": 2.3522,
                "stop_order": 1
            },
            {
                "name": "Bar 2",
                "stop_type": "food",
                "latitude": 48.8568,
                "longitude": 2.3524,
                "stop_order": 2
            }
        ]
    }
    response = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Super Barathon"
    assert len(data["stops"]) == 2
    assert len(data["participants"]) == 2 # Creator + test_user_2

def test_create_barathon_duplicate_stop_order(client, user_auth_headers):
    payload = {
        "name": "Super Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 15,
        "max_time_in_bar_minutes": 60,
        "participant_user_ids": [],
        "stops": [
            {
                "name": "Bar 1",
                "stop_type": "bar",
                "latitude": 48.8566,
                "longitude": 2.3522,
                "stop_order": 1
            },
            {
                "name": "Bar 2",
                "stop_type": "food",
                "latitude": 48.8568,
                "longitude": 2.3524,
                "stop_order": 1 # Duplicated!
            }
        ]
    }
    response = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "stop_order" in response.json()["detail"]

def test_create_barathon_invalid_dates(client, user_auth_headers):
    payload = {
        "name": "Super Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(hours=12)).isoformat(), # End before start!
        "travel_time_between_bars_minutes": 15,
        "max_time_in_bar_minutes": 60,
        "participant_user_ids": [],
        "stops": []
    }
    response = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "date de fin" in response.json()["detail"]

def test_create_barathon_missing_user(client, user_auth_headers):
    payload = {
        "name": "Super Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 15,
        "max_time_in_bar_minutes": 60,
        "participant_user_ids": [99999], # Non-existent user
        "stops": []
    }
    response = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "Utilisateurs introuvables" in response.json()["detail"]

def test_get_barathon_details_and_permissions(client, user_auth_headers, user_2_auth_headers, test_user_2):
    # 1. Create a barathon where test_user is the creator
    payload = {
        "name": "Excluding Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [],
        "stops": []
    }
    response = client.post("/barathons", json=payload, headers=user_auth_headers)
    barathon_id = response.json()["id"]

    # 2. Creator fetches details successfully
    response = client.get(f"/barathons/{barathon_id}", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Excluding Barathon"

    # 3. Third-party user (user 2) gets 403 Forbidden
    response = client.get(f"/barathons/{barathon_id}", headers=user_2_auth_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Accès interdit"

    # 4. Creator adds User 2
    add_payload = {"participant_user_ids": [test_user_2.id]}
    response = client.post(f"/barathons/{barathon_id}/participants", json=add_payload, headers=user_auth_headers)
    assert response.status_code == 200

    # 5. User 2 can now access it successfully
    response = client.get(f"/barathons/{barathon_id}", headers=user_2_auth_headers)
    assert response.status_code == 200

def test_start_and_finish_barathon(client, user_auth_headers, user_2_auth_headers, test_user_2):
    # 1. Create barathon
    payload = {
        "name": "Live Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [test_user_2.id],
        "stops": [
            {
                "name": "Bar 1",
                "stop_type": "bar",
                "latitude": 48.8566,
                "longitude": 2.3522,
                "stop_order": 1
            }
        ]
    }
    create_res = client.post("/barathons", json=payload, headers=user_auth_headers)
    barathon = create_res.json()
    barathon_id = barathon["id"]
    stop_id = barathon["stops"][0]["id"]

    # 2. Simple participant tries to start the barathon -> gets 403
    response = client.post(f"/barathons/{barathon_id}/start", headers=user_2_auth_headers)
    assert response.status_code == 403
    assert "Seul le créateur peut démarrer" in response.json()["detail"]

    # 3. Creator starts the barathon -> 200 OK
    response = client.post(f"/barathons/{barathon_id}/start", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "started"
    assert response.json()["has_started"] is True

    # 4. Retrieve active barathon
    response = client.get("/barathons/my/active", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json() is not None
    assert response.json()["id"] == barathon_id

    # 5. Complete a stop
    response = client.post(f"/barathons/{barathon_id}/stops/{stop_id}/complete", headers=user_2_auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["is_completed"] is True

    # 6. Finish the barathon
    response = client.post(f"/barathons/{barathon_id}/finish", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "completed"

    # 7. Active barathon is now None
    response = client.get("/barathons/my/active", headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json() is None

def test_assign_roles_and_start(client, user_auth_headers, test_user, test_user_2, test_roles):
    # 1. Create barathon with 2 participants
    payload = {
        "name": "Roleplay Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [test_user_2.id],
        "stops": []
    }
    create_res = client.post("/barathons", json=payload, headers=user_auth_headers)
    barathon_id = create_res.json()["id"]

    # 2. Get start config
    config_res = client.get(f"/barathons/{barathon_id}/start-config", headers=user_auth_headers)
    assert config_res.status_code == 200
    config_data = config_res.json()
    assert len(config_data["participants"]) == 2
    assert len(config_data["roles"]) == 3

    role_1_id = test_roles[0].id
    role_2_id = test_roles[1].id

    # 3. Assign roles and start
    assign_payload = {
        "assignments": [
            {"user_id": test_user.id, "role_id": role_1_id},
            {"user_id": test_user_2.id, "role_id": role_2_id}
        ]
    }
    response = client.post(f"/barathons/{barathon_id}/assign-roles-and-start", json=assign_payload, headers=user_auth_headers)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # 4. Check that roles were correctly assigned
    role_res = client.get(f"/barathons/{barathon_id}/my-role", headers=user_auth_headers)
    assert role_res.status_code == 200
    assert role_res.json()["role"] == test_roles[0].name
