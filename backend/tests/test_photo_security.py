import io
import logging
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select

from app.core.logging_filter import SensitiveDataFilter, setup_logging_filters
from app.models import Barathon, BarathonParticipant, BarathonStop, PhotoSecureGuest, User


def create_test_barathon(db_session, creator, join_code="TEST-SEC"):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    b = Barathon(
        name="Soirée Sécurité Photo",
        start_datetime=now,
        end_datetime=now + timedelta(hours=4),
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        join_code=join_code,
    )
    db_session.add(b)
    db_session.flush()

    p = BarathonParticipant(barathon_id=b.id, user_id=creator.id, role="creator")
    db_session.add(p)

    s1 = BarathonStop(
        barathon_id=b.id,
        name="Bar Test",
        latitude=43.6000,
        longitude=1.4400,
        stop_order=1,
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(b)
    return b


def test_guest_rejoin_refused_with_409_and_error_code(client, db_session, test_user):
    """
    Vérifie qu'un invité ne peut JAMAIS réémettre un JWT sur code + pseudo (refus de réémission).
    Une collision de pseudo au sein du barathon doit renvoyer 409 Conflict avec X-Error-Code: GUEST_USERNAME_TAKEN.
    """
    barathon = create_test_barathon(db_session, test_user, "SEC-CODE-01")

    # 1. Première inscription réussie
    res1 = client.post(
        "/barathons/join-guest",
        json={"join_code": "SEC-CODE-01", "username": "Alice"},
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert "access_token" in data1
    assert data1["user"]["username"] == "Alice"
    assert data1["user"]["is_guest"] is True

    # 2. Tentative de réémission avec le même pseudo : refus 409
    res2 = client.post(
        "/barathons/join-guest",
        json={"join_code": "SEC-CODE-01", "username": "Alice"},
    )
    assert res2.status_code == 409
    assert res2.headers.get("X-Error-Code") == "GUEST_USERNAME_TAKEN"
    assert "Ce pseudo est déjà utilisé dans ce barathon." in res2.json()["detail"]

    # 3. Tentative avec variante de casse ("alice" au lieu de "Alice") : refus 409
    res3 = client.post(
        "/barathons/join-guest",
        json={"join_code": "SEC-CODE-01", "username": "alice"},
    )
    assert res3.status_code == 409
    assert res3.headers.get("X-Error-Code") == "GUEST_USERNAME_TAKEN"
    assert "Ce pseudo est déjà utilisé dans ce barathon." in res3.json()["detail"]

    # 4. Tentative avec le pseudo du créateur (utilisateur normal) : refus 409
    res4 = client.post(
        "/barathons/join-guest",
        json={"join_code": "SEC-CODE-01", "username": test_user.username},
    )
    assert res4.status_code == 409
    assert res4.headers.get("X-Error-Code") == "GUEST_USERNAME_TAKEN"
    assert "Ce pseudo est déjà utilisé dans ce barathon." in res4.json()["detail"]


def test_guest_enrolled_in_photo_secure_guests(client, db_session, test_user):
    """
    Vérifie que tout nouvel invité créé via le flux sécurisé est inscrit
    dans la table photo_secure_guests avec (user_id, barathon_id, created_at).
    """
    barathon = create_test_barathon(db_session, test_user, "SEC-CODE-02")

    res = client.post(
        "/barathons/join-guest",
        json={"join_code": "SEC-CODE-02", "username": "BobSecure"},
    )
    assert res.status_code == 201
    guest_id = res.json()["user"]["id"]

    # Vérification directe en base
    secure_guest = db_session.scalar(
        select(PhotoSecureGuest).where(PhotoSecureGuest.user_id == guest_id)
    )
    assert secure_guest is not None
    assert secure_guest.user_id == guest_id
    assert secure_guest.barathon_id == barathon.id
    assert secure_guest.created_at is not None

    # Le créateur enregistré (non invité) ne doit pas être dans photo_secure_guests
    creator_entry = db_session.scalar(
        select(PhotoSecureGuest).where(PhotoSecureGuest.user_id == test_user.id)
    )
    assert creator_entry is None


def test_sensitive_data_filter_redaction_unit():
    """
    Vérifie le caviardage effectif des tokens et secrets par SensitiveDataFilter.redact
    avec des jetons synthétiques marqués.
    """
    synth_token = "JWT_SYNTHETIC_SECRET_TOKEN_A1B2C3D4E5"
    synth_access = "ACCESS_SYNTHETIC_SECRET_TOKEN_987654"
    synth_code = "CODE_SYNTHETIC_SECRET_KLMNOP1234"
    synth_bearer = "BEARER_SYNTHETIC_SECRET_ZXCVBNM098"

    # token=...
    res_token = SensitiveDataFilter.redact(f"GET /ws/me?token={synth_token}&lang=fr")
    assert synth_token not in res_token
    assert "token=[REDACTED]&lang=fr" in res_token

    # access_token=...
    res_access = SensitiveDataFilter.redact(f"api_call?access_token={synth_access}&v=1")
    assert synth_access not in res_access
    assert "access_token=[REDACTED]&v=1" in res_access

    # code=...
    res_code = SensitiveDataFilter.redact(f"POST /claim?code={synth_code}&draft=1")
    assert synth_code not in res_code
    assert "code=[REDACTED]&draft=1" in res_code

    # Authorization: Bearer ...
    res_auth = SensitiveDataFilter.redact(f"Authorization: Bearer {synth_bearer}")
    assert synth_bearer not in res_auth
    assert "Authorization: Bearer [REDACTED]" in res_auth

    # Bearer sans préfixe Authorization:
    res_bearer = SensitiveDataFilter.redact(f"Header Bearer {synth_bearer} accepted")
    assert synth_bearer not in res_bearer
    assert "Bearer [REDACTED]" in res_bearer


def test_sensitive_data_filter_logging_integration():
    """
    Vérifie l'intégration complète du filtre avec le système standard de logging Python.
    Aucun secret synthétique marqué ne doit sortir dans les messages formatés.
    """
    synth_jwt = "JWT_SYNTHETIC_LOG_TEST_TOKEN_XYZ123"
    synth_code = "CODE_SYNTHETIC_LOG_SECRET_456"

    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    formatter = logging.Formatter("%(levelname)s: %(message)s")
    handler.setFormatter(formatter)

    test_logger = logging.getLogger("test.security.filter")
    test_logger.setLevel(logging.DEBUG)
    test_logger.addHandler(handler)
    test_logger.addFilter(SensitiveDataFilter())

    # Log avec format string (%s)
    test_logger.info("Tentative de connexion avec token=%s", synth_jwt)
    # Log avec message préformaté
    test_logger.info("URL appelée: /claim?code=%s&attempt=1", synth_code)
    test_logger.warning("Authorization: Bearer %s expired", synth_jwt)

    log_output = stream.getvalue()

    # Vérifier l'absence totale de tokens en clair
    assert synth_jwt not in log_output
    assert synth_code not in log_output

    # Vérifier la présence des caviardages [REDACTED]
    assert "token=[REDACTED]" in log_output
    assert "code=[REDACTED]" in log_output
    assert "Authorization: Bearer [REDACTED]" in log_output


def test_setup_logging_filters_targets():
    """
    Vérifie que setup_logging_filters attache bien le filtre aux loggers requis :
    root, uvicorn, uvicorn.access, uvicorn.error.
    """
    setup_logging_filters()

    target_loggers = [
        logging.getLogger(),
        logging.getLogger("uvicorn"),
        logging.getLogger("uvicorn.access"),
        logging.getLogger("uvicorn.error"),
    ]

    for l in target_loggers:
        has_filter = any(isinstance(f, SensitiveDataFilter) for f in l.filters)
        assert has_filter is True, f"Logger {l.name} doit avoir SensitiveDataFilter"
