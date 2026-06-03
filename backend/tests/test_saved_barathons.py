import pytest
from datetime import datetime, timedelta

def test_saved_barathons_lifecycle(client, user_auth_headers, user_2_auth_headers, test_user, test_user_2):
    # 1. Créer un barathon avec 2 stops
    payload = {
        "name": "Barathon Historique",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 12,
        "max_time_in_bar_minutes": 45,
        "participant_user_ids": [test_user_2.id],
        "stops": [
            {
                "name": "Le Comptoir",
                "stop_type": "bar",
                "latitude": 48.85,
                "longitude": 2.35,
                "stop_order": 1
            },
            {
                "name": "Pizzeria Napoli",
                "stop_type": "food",
                "latitude": 48.86,
                "longitude": 2.36,
                "stop_order": 2
            }
        ]
    }
    create_res = client.post("/barathons", json=payload, headers=user_auth_headers)
    assert create_res.status_code == 201
    barathon_id = create_res.json()["id"]

    # 2. Essayer de sauvegarder un barathon PLANNED -> 400 Bad Request
    save_payload = {"name": "Mon trajet favori"}
    response = client.post(f"/barathons/{barathon_id}/save", json=save_payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "Seuls les barathons passés" in response.json()["detail"]

    # 3. Démarrer et arrêter le barathon pour le mettre dans un statut passé ("stopped")
    client.post(f"/barathons/{barathon_id}/start", headers=user_auth_headers)
    client.post(f"/barathons/{barathon_id}/stop", headers=user_auth_headers)

    # 4. Sauvegarder le barathon passé en tant que test_user
    response = client.post(f"/barathons/{barathon_id}/save", json=save_payload, headers=user_auth_headers)
    assert response.status_code == 201
    saved_data = response.json()
    assert saved_data["name"] == "Mon trajet favori"
    assert saved_data["travel_time_between_bars_minutes"] == 12
    assert saved_data["max_time_in_bar_minutes"] == 45
    assert len(saved_data["stops"]) == 2
    assert saved_data["stops"][0]["name"] == "Le Comptoir"
    assert saved_data["stops"][1]["name"] == "Pizzeria Napoli"
    saved_id = saved_data["id"]

    # 5. Lister ses barathons enregistrés
    list_res = client.get("/saved-barathons", headers=user_auth_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) == 1
    assert list_data[0]["id"] == saved_id
    assert list_data[0]["name"] == "Mon trajet favori"

    # 6. Essayer de supprimer le barathon enregistré de test_user avec le compte de test_user_2 -> 403 Forbidden
    delete_res_403 = client.delete(f"/saved-barathons/{saved_id}", headers=user_2_auth_headers)
    assert delete_res_403.status_code == 403

    # 7. Supprimer son propre barathon enregistré -> 204 No Content
    delete_res = client.delete(f"/saved-barathons/{saved_id}", headers=user_auth_headers)
    assert delete_res.status_code == 204

    # 8. Vérifier que la liste est vide
    list_res_after = client.get("/saved-barathons", headers=user_auth_headers)
    assert len(list_res_after.json()) == 0
