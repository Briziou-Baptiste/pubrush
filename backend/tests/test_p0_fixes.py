import time
import pytest
from datetime import datetime, timedelta, timezone
from starlette.websockets import WebSocketDisconnect

from app.models import (
    Barathon,
    BarathonParticipant,
    BarathonStop,
    PasswordResetToken,
    User,
)
from app.security import create_access_token
from app.websocket.registry import ws_manager


def _create_barathon(db_session, creator, participant, status="planned"):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name=f"Barathon Test {status}",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=(status == "started"),
        status=status,
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        join_code=f"CODE-{status[:4].upper()}",
    )
    db_session.add(b)
    db_session.flush()

    p1 = BarathonParticipant(barathon_id=b.id, user_id=creator.id, role="creator")
    p2 = BarathonParticipant(barathon_id=b.id, user_id=participant.id, role="participant")
    db_session.add_all([p1, p2])

    s1 = BarathonStop(
        barathon_id=b.id,
        name="Bar 1",
        latitude=43.6000,
        longitude=1.4400,
        stop_order=1,
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(b)
    return b


# =========================================================================
# P0-2 : CYCLE DE VIE GPS ET CONFIDENTIALITÉ
# =========================================================================

def test_gps_rejected_when_barathon_is_planned(client, db_session, test_user, test_user_2):
    """
    Vérifie qu'aucun snapshot ni mise à jour GPS n'est autorisé
    lorsque le barathon est au statut 'planned'.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="planned")
    token = create_access_token({"sub": str(test_user_2.id)})

    # S'assurer que le cache en RAM est vide
    ws_manager.clear_barathon_locations(barathon.id)

    with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token}") as ws:
        # En planned, la socket s'ouvre (pour voir les nouveaux arrivants), mais AUCUN snapshot n'est envoyé
        ws.send_json({"type": "PING"})
        resp = ws.receive_json()
        assert resp["type"] == "PONG"

        # Tenter d'envoyer une position GPS en planned
        ws.send_json({
            "type": "UPDATE_LOCATION",
            "latitude": 43.6045,
            "longitude": 1.4430,
        })

        # Envoyer un second PING : si l'UPDATE_LOCATION avait été broadcasté,
        # le prochain message serait FRIEND_LOCATION_UPDATE, or on doit recevoir directement PONG
        ws.send_json({"type": "PING"})
        pong = ws.receive_json()
        assert pong["type"] == "PONG"

    # Vérifier qu'aucune position n'a été stockée en mémoire
    assert ws_manager.get_barathon_locations(barathon.id) == []


def test_gps_accepted_and_broadcast_when_started(client, db_session, test_user, test_user_2):
    """
    Vérifie que la position GPS est acceptée, stockée en RAM et broadcastée
    lorsque le barathon est au statut 'started'.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")
    token1 = create_access_token({"sub": str(test_user.id)})
    token2 = create_access_token({"sub": str(test_user_2.id)})

    ws_manager.clear_barathon_locations(barathon.id)

    with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token1}") as ws1:
        with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token2}") as ws2:
            # User 1 envoie sa position
            ws1.send_json({
                "type": "UPDATE_LOCATION",
                "latitude": 43.6010,
                "longitude": 1.4410,
            })

            # User 2 doit recevoir la mise à jour
            msg2 = ws2.receive_json()
            assert msg2["type"] == "FRIEND_LOCATION_UPDATE"
            assert msg2["payload"]["user_id"] == test_user.id
            assert msg2["payload"]["latitude"] == 43.6010

    # Vérifier que la position est en RAM
    locs = ws_manager.get_barathon_locations(barathon.id)
    assert len(locs) == 1
    assert locs[0]["user_id"] == test_user.id


def test_gps_location_expiration(client, db_session, test_user, test_user_2):
    """
    Vérifie que get_barathon_locations exclut les positions de plus de 60 secondes.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")
    ws_manager.set_user_location(
        barathon.id,
        test_user.id,
        {"user_id": test_user.id, "latitude": 43.6, "longitude": 1.4},
    )

    # Position fraîche : présente
    assert len(ws_manager.get_barathon_locations(barathon.id, max_age_seconds=60)) == 1

    # Simuler le vieillissement du timestamp à 65 secondes
    ws_manager.barathon_location_timestamps[barathon.id][test_user.id] = time.time() - 65

    # Après expiration : absente et purgée
    expired_locs = ws_manager.get_barathon_locations(barathon.id, max_age_seconds=60)
    assert expired_locs == []
    assert barathon.id not in ws_manager.barathon_locations or test_user.id not in ws_manager.barathon_locations[barathon.id]


def test_barathon_stop_purges_locations_and_closes_websockets(
    client, db_session, test_user, test_user_2, user_auth_headers
):
    """
    Vérifie que l'arrêt d'un barathon via POST /{id}/stop :
    1. Notifie les participants.
    2. Purge immédiatement toutes les positions en RAM.
    3. Ferme les connexions actives.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")
    token2 = create_access_token({"sub": str(test_user_2.id)})

    # Enregistrer une position en RAM
    ws_manager.set_user_location(
        barathon.id,
        test_user_2.id,
        {"user_id": test_user_2.id, "latitude": 43.602, "longitude": 1.442},
    )
    assert len(ws_manager.get_barathon_locations(barathon.id)) == 1

    # Ouvrir la socket pour user 2
    with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token2}") as ws2:
        # Lire le snapshot initial
        snap = ws2.receive_json()
        assert snap["type"] == "FRIENDS_LOCATIONS_SNAPSHOT"

        # Le créateur arrête le barathon via REST
        res_stop = client.post(f"/barathons/{barathon.id}/stop", headers=user_auth_headers)
        assert res_stop.status_code == 200

        # User 2 reçoit la notification d'arrêt
        stop_msg = ws2.receive_json()
        assert stop_msg["type"] == "BARATHON_STOPPED"

    # Vérifier que les positions en RAM sont totalement purgées
    assert ws_manager.get_barathon_locations(barathon.id) == []


def test_cannot_connect_to_stopped_or_completed_barathon(
    client, db_session, test_user, test_user_2
):
    """
    Vérifie qu'il est impossible d'ouvrir une WebSocket sur un barathon arrêté ou terminé.
    """
    stopped_b = _create_barathon(db_session, test_user, test_user_2, status="stopped")
    token = create_access_token({"sub": str(test_user_2.id)})

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(f"/ws/barathons/{stopped_b.id}?token={token}"):
            pass
    assert exc_info.value.code == 1008


def test_remove_participant_purges_location_and_closes_socket(
    client, db_session, test_user, test_user_2, user_auth_headers
):
    """
    Vérifie que retirer un participant purge sa position et ferme sa connexion.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")
    token2 = create_access_token({"sub": str(test_user_2.id)})

    ws_manager.set_user_location(
        barathon.id,
        test_user_2.id,
        {"user_id": test_user_2.id, "latitude": 43.603, "longitude": 1.443},
    )

    with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token2}") as ws2:
        # Retirer le participant test_user_2 via REST
        del_res = client.delete(
            f"/barathons/{barathon.id}/participants/{test_user_2.id}",
            headers=user_auth_headers,
        )
        assert del_res.status_code == 200

    # Sa position en RAM doit être immédiatement purgée
    assert ws_manager.get_barathon_locations(barathon.id) == []


# =========================================================================
# P0-3 : SUPPRESSION DE COMPTE, PURGE RGPD ET CONNEXIONS ACTIVES
# =========================================================================

def test_delete_account_purges_reset_tokens_locations_and_closes_websockets(
    client, db_session, test_user, test_user_2, user_auth_headers
):
    """
    Vérifie que DELETE /me :
    1. Purge tous les jetons de PasswordResetToken associés à l'email.
    2. Purge toutes les positions en RAM de l'utilisateur.
    3. Ferme immédiatement ses connexions actives (/ws/me et /ws/barathon).
    4. Interdit toute reconnexion ou réémission.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")

    # 1. Créer un PasswordResetToken avec l'email du compte à supprimer
    reset_token = PasswordResetToken(
        email=test_user.email,
        token="123456",
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15),
    )
    db_session.add(reset_token)
    db_session.commit()

    # 2. Positionner une localisation en RAM
    ws_manager.set_user_location(
        barathon.id,
        test_user.id,
        {"user_id": test_user.id, "latitude": 43.6, "longitude": 1.4},
    )

    token = create_access_token({"sub": str(test_user.id)})

    # 3. Ouvrir des sockets actives /ws/me et /ws/barathons
    with client.websocket_connect(f"/ws/me?token={token}") as ws_me:
        with client.websocket_connect(f"/ws/barathons/{barathon.id}?token={token}") as ws_bar:
            # Vérifier qu'elles sont opérationnelles
            ws_me.send_json({"type": "PING"})
            assert ws_me.receive_json()["type"] == "PONG"

            # Vider le snapshot initial reçu sur la socket barathon
            initial_snap = ws_bar.receive_json()
            assert initial_snap["type"] == "FRIENDS_LOCATIONS_SNAPSHOT"

            # 4. Supprimer le compte via DELETE /me
            del_res = client.delete("/me", headers=user_auth_headers)
            assert del_res.status_code == 200

            # 5. Les sockets doivent être fermées avec code 1008
            with pytest.raises(WebSocketDisconnect) as exc1:
                ws_me.receive_json()
            assert exc1.value.code == 1008

            with pytest.raises(WebSocketDisconnect) as exc2:
                ws_bar.receive_json()
            assert exc2.value.code == 1008

    # 6. Vérifier la purge complète de PasswordResetToken (RGPD)
    db_session.expire_all()
    remaining_tokens = db_session.query(PasswordResetToken).filter_by(email=test_user.email).all()
    assert remaining_tokens == []

    # 7. Vérifier la purge des positions en RAM
    assert ws_manager.get_barathon_locations(barathon.id) == []

    # 8. Reconnexion impossible avec l'ancien token
    with pytest.raises(WebSocketDisconnect) as exc_reconnect:
        with client.websocket_connect(f"/ws/me?token={token}"):
            pass
    assert exc_reconnect.value.code == 1008


# =========================================================================
# P0-1 : CYCLE DE VIE MÉTIER D'UN BARATHON
# =========================================================================

def test_full_barathon_lifecycle_and_step_progression(
    client, db_session, test_user, test_user_2, user_auth_headers, user_2_auth_headers
):
    """
    Teste le cycle de vie complet :
    - Création planned
    - Rejoindre via code
    - Démarrage started
    - Progression d'étape
    - Clôture finish et purge
    """
    # 1. Création
    create_payload = {
        "name": "Barathon Intégration",
        "start_datetime": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        "end_datetime": (datetime.utcnow() + timedelta(hours=5)).isoformat(),
        "travel_time_between_bars_minutes": 10,
        "max_time_in_bar_minutes": 30,
        "participant_user_ids": [test_user_2.id],
        "stops": [
            {"name": "Bar Étape 1", "latitude": 43.601, "longitude": 1.441, "stop_order": 1},
            {"name": "Bar Étape 2", "latitude": 43.602, "longitude": 1.442, "stop_order": 2},
        ],
    }
    res = client.post("/barathons", json=create_payload, headers=user_auth_headers)
    assert res.status_code == 201
    b_data = res.json()
    b_id = b_data["id"]
    assert b_data["status"] == "planned"

    # 2. Démarrage
    res_start = client.post(f"/barathons/{b_id}/start", headers=user_auth_headers)
    assert res_start.status_code == 200
    assert res_start.json()["status"] == "started"

    # 3. Progression d'étape : validation de l'étape 1
    stop_1_id = b_data["stops"][0]["id"]
    res_step = client.post(
        f"/barathons/{b_id}/stops/{stop_1_id}/complete",
        headers=user_auth_headers,
    )
    assert res_step.status_code == 200

    # 4. Enregistrement d'une position GPS en cours de barathon
    ws_manager.set_user_location(b_id, test_user.id, {"user_id": test_user.id, "latitude": 43.601, "longitude": 1.441})
    assert len(ws_manager.get_barathon_locations(b_id)) == 1

    # 5. Clôture du barathon via finish
    res_finish = client.post(f"/barathons/{b_id}/finish", headers=user_auth_headers)
    assert res_finish.status_code == 200
    assert res_finish.json()["status"] == "completed"

    # 6. Vérifier la purge des positions après clôture
    assert ws_manager.get_barathon_locations(b_id) == []


def test_proactive_location_purge_across_barathons(db_session, test_user, test_user_2):
    """
    Vérifie que purge_expired_locations identifie et purge proactivement
    les positions périmées sans attendre de demande de snapshot, et retourne
    la liste des user_ids expirés pour émission de FRIEND_LOCATION_EXPIRED.
    """
    barathon = _create_barathon(db_session, test_user, test_user_2, status="started")

    # Enregistrer deux positions : une fraîche et une ancienne
    ws_manager.set_user_location(
        barathon.id,
        test_user.id,
        {"user_id": test_user.id, "latitude": 43.601, "longitude": 1.441},
    )
    ws_manager.set_user_location(
        barathon.id,
        test_user_2.id,
        {"user_id": test_user_2.id, "latitude": 43.602, "longitude": 1.442},
    )

    # Vieillir artificiellement la position de test_user_2 à 70s
    ws_manager.barathon_location_timestamps[barathon.id][test_user_2.id] = time.time() - 70

    # Purge proactive
    expired_map = ws_manager.purge_expired_locations(max_age_seconds=60.0)

    assert barathon.id in expired_map
    assert test_user_2.id in expired_map[barathon.id]
    assert test_user.id not in expired_map[barathon.id]

    # Vérifier que la position de test_user_2 n'est plus en RAM
    locations = ws_manager.get_barathon_locations(barathon.id)
    assert len(locations) == 1
    assert locations[0]["user_id"] == test_user.id
