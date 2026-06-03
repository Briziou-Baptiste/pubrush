import pytest
from datetime import datetime, timedelta

def test_expense_lifecycle(client, user_auth_headers, user_2_auth_headers, test_user, test_user_2):
    # 1. Create a barathon with test_user and test_user_2
    payload = {
        "name": "Financial Barathon",
        "start_datetime": (datetime.utcnow() + timedelta(days=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(days=1, hours=4)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [test_user_2.id],
        "stops": []
    }
    create_res = client.post("/barathons", json=payload, headers=user_auth_headers)
    barathon_id = create_res.json()["id"]

    # 2. Try to add an expense while barathon is PLANNED -> gets 400
    expense_payload = {
        "payer_user_id": test_user.id,
        "amount": 30.0,
        "description": "Première tournée",
        "beneficiary_user_ids": [test_user.id, test_user_2.id]
    }
    response = client.post(f"/barathons/{barathon_id}/expenses", json=expense_payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "en cours" in response.json()["detail"]

    # 3. Start the barathon
    client.post(f"/barathons/{barathon_id}/start", headers=user_auth_headers)

    # 4. Try to add expense with an invalid beneficiary (who is not a participant) -> gets 400
    invalid_expense_payload = {
        "payer_user_id": test_user.id,
        "amount": 30.0,
        "description": "Tricherie",
        "beneficiary_user_ids": [test_user.id, 99999]
    }
    response = client.post(f"/barathons/{barathon_id}/expenses", json=invalid_expense_payload, headers=user_auth_headers)
    assert response.status_code == 400
    assert "ne participent pas" in response.json()["detail"]

    # 5. Add a valid expense 1: test_user pays 30.0 for test_user + test_user_2
    response = client.post(f"/barathons/{barathon_id}/expenses", json=expense_payload, headers=user_auth_headers)
    assert response.status_code == 201
    assert response.json()["amount"] == 30.0
    assert response.json()["payer_user_id"] == test_user.id

    # 6. Add a valid expense 2: test_user_2 pays 10.0 for test_user_2 only
    expense_payload_2 = {
        "payer_user_id": test_user_2.id,
        "amount": 10.0,
        "description": "Snack perso",
        "beneficiary_user_ids": [test_user_2.id]
    }
    response = client.post(f"/barathons/{barathon_id}/expenses", json=expense_payload_2, headers=user_2_auth_headers)
    assert response.status_code == 201

    # 7. Get expenses report and verify balance calculations
    report_res = client.get(f"/barathons/{barathon_id}/expenses", headers=user_auth_headers)
    assert report_res.status_code == 200
    report_data = report_res.json()
    assert len(report_data["expenses"]) == 2
    
    balances = report_data["balances"]
    assert len(balances) == 2

    # Map balances by user_id for easy assertion
    balances_map = {b["user_id"]: b for b in balances}

    # test_user balance: paid 30.0, debt 15.0 -> balance = +15.0
    assert balances_map[test_user.id]["paid_amount"] == 30.0
    assert balances_map[test_user.id]["debt_amount"] == 15.0
    assert balances_map[test_user.id]["balance"] == 15.0

    # test_user_2 balance: paid 10.0, debt 25.0 -> balance = -15.0
    assert balances_map[test_user_2.id]["paid_amount"] == 10.0
    assert balances_map[test_user_2.id]["debt_amount"] == 25.0
    assert balances_map[test_user_2.id]["balance"] == -15.0

    # 8. Test /barathons/my/balances for test_user
    bal_res_1 = client.get("/barathons/my/balances", headers=user_auth_headers)
    assert bal_res_1.status_code == 200
    bal_data_1 = bal_res_1.json()
    assert len(bal_data_1) == 1
    assert bal_data_1[0]["barathon_id"] == barathon_id
    assert bal_data_1[0]["barathon_name"] == "Financial Barathon"
    assert bal_data_1[0]["balance"] == 15.0
    assert bal_data_1[0]["status"] == "started"

    # 9. Test /barathons/my/balances for test_user_2
    bal_res_2 = client.get("/barathons/my/balances", headers=user_2_auth_headers)
    assert bal_res_2.status_code == 200
    bal_data_2 = bal_res_2.json()
    assert len(bal_data_2) == 1
    assert bal_data_2[0]["barathon_id"] == barathon_id
    assert bal_data_2[0]["barathon_name"] == "Financial Barathon"
    assert bal_data_2[0]["balance"] == -15.0
    assert bal_data_2[0]["status"] == "started"

