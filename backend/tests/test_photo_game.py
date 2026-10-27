import io
import os
import uuid
import pytest
from PIL import Image

from app.models import Barathon, BarathonParticipant, Role, User, PhotoSecureGuest
from app.photo_models import PhotoChallenge, PhotoAudience, PhotoAnswer, PhotoResult, PhotoMedia
from app.security import create_access_token, hash_password


def create_test_jpeg():
    img = Image.new("RGB", (200, 200), (255, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def photo_users(db_session):
    users = []
    for i in range(1, 5):
        u = User(
            email=f"photo_user_{i}@pubrush.test",
            username=f"Player_{i}",
            password_hash=hash_password("Password123!"),
            is_admin=False,
            is_guest=False,
        )
        db_session.add(u)
        users.append(u)
    db_session.commit()
    for u in users:
        db_session.refresh(u)
    return users


from datetime import datetime, timedelta, timezone

@pytest.fixture
def active_photo_barathon(db_session, photo_users):
    creator = photo_users[0]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name="Tournoi Photo Mystère",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        join_code="PHOTO99",
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)

    # Add all photo_users as participants
    for u in photo_users:
        part = BarathonParticipant(
            barathon_id=b.id,
            user_id=u.id,
            role="creator" if u.id == creator.id else "participant",
        )
        db_session.add(part)
    db_session.commit()
    db_session.refresh(b)
    return b


def test_photo_mystery_disabled_by_default(client, active_photo_barathon, photo_users):
    """Vérifie que sans variables d'environnement, Photo Mystère est désactivé."""
    os.environ.pop("PHOTO_MYSTERY_ENABLED", None)
    os.environ.pop("PHOTO_MYSTERY_ALLOWLIST", None)

    token = create_access_token({"sub": str(photo_users[0].id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/barathons/{active_photo_barathon.id}/photo-mystery", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is False
    assert data["can_create"] is False
    assert data["items"] == []


def test_photo_mystery_enabled_with_allowlist(client, active_photo_barathon, photo_users):
    """Vérifie l'activation avec flag et allowlist."""
    os.environ["PHOTO_MYSTERY_ENABLED"] = "true"
    os.environ["PHOTO_MYSTERY_ALLOWLIST"] = str(active_photo_barathon.id)

    token = create_access_token({"sub": str(photo_users[0].id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/barathons/{active_photo_barathon.id}/photo-mystery", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["enabled"] is True
    assert data["can_create"] is True
    assert data["items"] == []


def test_photo_full_game_lifecycle(client, active_photo_barathon, photo_users, db_session):
    """
    Scénario bout-en-bout complet :
    1. Création de draft par l'auteur (Player_1)
    2. Récupération du code d'upload (10 caractères)
    3. Échange atomique du code contre un jeton de capacité
    4. Upload de la photo avec ce jeton
    5. Publication du défi (l'audience est figée)
    6. Vérification de la protection de la bonne réponse
    7. Soumissions des répondants (Player_2 correct, Player_3 incorrect, Player_4 passe)
    8. Clôture automatique et calcul des résultats (gage assigné au joueur incorrect)
    9. Déchiffrement et consultation de la photo par un membre autorisé
    """
    os.environ["PHOTO_MYSTERY_ENABLED"] = "true"
    os.environ["PHOTO_MYSTERY_ALLOWLIST"] = str(active_photo_barathon.id)

    creator = photo_users[0]
    p2 = photo_users[1]
    p3 = photo_users[2]
    p4 = photo_users[3]

    creator_token = create_access_token({"sub": str(creator.id)})
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # 1. Création du draft
    draft_payload = {
        "question": "Quel est ce cocktail ?",
        "options": ["Mojito", "Margarita", "Cosmopolitan"],
        "correct_index": 0,
        "notice_version": "photo-private-2026-10-v1",
    }
    res_draft = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges",
        json=draft_payload,
        headers=creator_headers,
    )
    assert res_draft.status_code == 201
    draft_data = res_draft.json()
    challenge_id = draft_data["id"]
    upload_code = draft_data["upload_code"]
    assert len(upload_code) == 10

    # 2. Échange atomique du code contre une capacité d'upload
    res_claim = client.post("/photo-mystery/claim-upload", json={"code": upload_code})
    assert res_claim.status_code == 200
    claim_data = res_claim.json()
    upload_token = claim_data["upload_token"]
    assert claim_data["challenge_id"] == challenge_id

    # Rejeu du même code doit échouer (usage unique)
    res_claim_reuse = client.post("/photo-mystery/claim-upload", json={"code": upload_code})
    assert res_claim_reuse.status_code == 404

    # 3. Upload de la photo avec le token de capacité
    jpeg_bytes = create_test_jpeg()
    res_upload = client.post(
        "/photo-mystery/upload",
        files={"file": ("photo.jpg", jpeg_bytes, "image/jpeg")},
        headers={"Authorization": f"Bearer {upload_token}"},
    )
    assert res_upload.status_code == 201
    assert res_upload.json()["status"] == "ready"

    # 4. Publication par l'auteur
    res_publish = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/publish",
        json={"notice_version": "photo-private-2026-10-v1"},
        headers=creator_headers,
    )
    assert res_publish.status_code == 200
    publish_data = res_publish.json()
    assert publish_data["state"] == "published"
    assert publish_data["correct_index"] is None  # Protégé !

    # 5. Vérification de l'état vu par un répondant (Player_2)
    p2_token = create_access_token({"sub": str(p2.id)})
    p2_headers = {"Authorization": f"Bearer {p2_token}"}

    res_p2_state = client.get(f"/barathons/{active_photo_barathon.id}/photo-mystery", headers=p2_headers)
    assert res_p2_state.status_code == 200
    state_data = res_p2_state.json()
    assert state_data["pending_count"] == 1
    ch_item = state_data["items"][0]
    assert ch_item["can_answer"] is True
    assert ch_item["correct_index"] is None  # Absolument non divulgué

    # 6. L'auteur tente de répondre -> refusé (403)
    res_author_answer = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": 0, "passed": False},
        headers=creator_headers,
    )
    assert res_author_answer.status_code == 403

    # 7. Player_2 répond correctement (index 0)
    res_ans_p2 = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": 0, "passed": False},
        headers=p2_headers,
    )
    assert res_ans_p2.status_code == 200
    assert res_ans_p2.json()["can_answer"] is False

    # Idempotence : Player_2 soumet à nouveau la même réponse -> 200
    res_ans_p2_replay = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": 0, "passed": False},
        headers=p2_headers,
    )
    assert res_ans_p2_replay.status_code == 200

    # Player_2 soumet un choix différent -> 409 Conflict
    res_ans_p2_conflict = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": 1, "passed": False},
        headers=p2_headers,
    )
    assert res_ans_p2_conflict.status_code == 409

    # 8. Player_3 répond incorrectement (index 1)
    p3_token = create_access_token({"sub": str(p3.id)})
    res_ans_p3 = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": 1, "passed": False},
        headers={"Authorization": f"Bearer {p3_token}"},
    )
    assert res_ans_p3.status_code == 200

    # 9. Player_4 passe le défi
    p4_token = create_access_token({"sub": str(p4.id)})
    res_ans_p4 = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/answer",
        json={"choice_index": None, "passed": True},
        headers={"Authorization": f"Bearer {p4_token}"},
    )
    assert res_ans_p4.status_code == 200
    # Tous les répondants ont voté : le défi est maintenant clôturé automatiquement
    closed_data = res_ans_p4.json()
    assert closed_data["state"] == "closed"
    assert closed_data["correct_index"] == 0  # Révélé après clôture

    # 10. Consultation des résultats par Player_3 (qui s'est trompé)
    res_p3_final = client.get(f"/barathons/{active_photo_barathon.id}/photo-mystery", headers={"Authorization": f"Bearer {p3_token}"})
    final_item = res_p3_final.json()["items"][0]
    assert final_item["state"] == "closed"
    assert final_item["results"]["correct_count"] == 1
    assert final_item["results"]["incorrect_count"] == 1
    assert final_item["results"]["passed_count"] == 1
    assert final_item["results"]["creator_dare"] is False
    assert final_item["results"]["my_dare_assigned"] is True  # Player_3 a un gage car réponse fausse !

    # Consultation de la photo déchiffrée par un participant autorisé
    res_photo = client.get(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/photo",
        headers=p2_headers,
    )
    assert res_photo.status_code == 200
    assert res_photo.headers["Content-Type"] == "image/jpeg"
    assert "no-store" in res_photo.headers["Cache-Control"]
    assert len(res_photo.content) > 0

    # Consultation de la photo par un étranger (non participant) -> 403
    stranger = User(
        email="stranger@pubrush.test",
        username="Stranger",
        password_hash=hash_password("Pass123!"),
        is_guest=False,
    )
    db_session.add(stranger)
    db_session.commit()
    stranger_token = create_access_token({"sub": str(stranger.id)})
    res_photo_stranger = client.get(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges/{challenge_id}/photo",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert res_photo_stranger.status_code == 403


def test_legacy_guest_forbidden(client, active_photo_barathon, db_session):
    """Un invité ancien (sans enregistrement photo_secure_guests) est rejeté."""
    os.environ["PHOTO_MYSTERY_ENABLED"] = "true"
    os.environ["PHOTO_MYSTERY_ALLOWLIST"] = str(active_photo_barathon.id)

    legacy_guest = User(
        email="guest_old@guest.pubrush.internal",
        username="OldGuest",
        password_hash=hash_password("Pass123!"),
        is_guest=True,
    )
    db_session.add(legacy_guest)
    db_session.commit()
    part = BarathonParticipant(barathon_id=active_photo_barathon.id, user_id=legacy_guest.id, role="participant")
    db_session.add(part)
    db_session.commit()

    guest_token = create_access_token({"sub": str(legacy_guest.id)})
    headers = {"Authorization": f"Bearer {guest_token}"}

    # Tentative de créer un draft
    res = client.post(
        f"/barathons/{active_photo_barathon.id}/photo-mystery/challenges",
        json={"question": "Test ?", "options": ["A", "B"], "correct_index": 0},
        headers=headers,
    )
    assert res.status_code == 403
    assert "non éligible" in res.json()["detail"]
