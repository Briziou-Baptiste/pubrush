import asyncio
import hashlib
import io
import os
import secrets
import struct
import tempfile
import threading
import time
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Tuple

import httpx
import pytest
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from PIL import Image
from sqlalchemy import create_engine, func, inspect, select
from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.models import Barathon, BarathonParticipant, User
from app.photo_models import (
    PhotoAnswer,
    PhotoAudience,
    PhotoChallenge,
    PhotoMedia,
    PhotoResult,
)
from app.photo_schemas import PhotoAnswerPayload
from app.security import create_access_token, hash_password
from app.services import photo_storage
from app.services.photo_processor import MAX_RAW_SIZE, process_photo
from app.services.photo_purge import cleanup_orphaned_files, reconcile_photo_storage
from app.services.photo_service import PhotoService
from app.services.photo_storage import decrypt_media, encrypt_and_store, get_storage_dir

PG_TEST_URL = os.getenv(
    "PG_TEST_DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('USER', 'baptistebriziou')}@localhost:5432/pubrush_test",
)


def get_alembic_config(db_url: str) -> Config:
    backend_dir = Path(__file__).resolve().parent.parent
    ini_path = backend_dir / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", db_url)
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    cfg.attributes["configure_logger"] = False
    return cfg


@pytest.fixture(scope="module")
def pg_photo_engine():
    """Engine connecté à PostgreSQL réel avec un pool adapté pour les tests concurrents."""
    try:
        engine = create_engine(PG_TEST_URL, pool_size=15, max_overflow=10, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
        yield engine
        engine.dispose()
    except Exception as exc:
        pytest.skip(f"Base PostgreSQL de test non disponible : {exc}")


@pytest.fixture(autouse=True)
def setup_adversarial_env(tmp_path, monkeypatch):
    """Isole le stockage sur disque et active le Feature Flag globalement."""
    test_storage = str(tmp_path / "photo-storage-adversarial")
    monkeypatch.setenv("PHOTO_STORAGE_DIR", test_storage)
    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", "*")
    return test_storage


def create_adversarial_barathon(
    engine, participant_count: int = 1
) -> Tuple[int, int, list[int], list[int]]:
    """Crée un créateur, un barathon démarré, et N participants sur PostgreSQL réel."""
    with Session(bind=engine) as s:
        now = datetime.now(timezone.utc)
        uid = uuid.uuid4().hex[:6]

        creator = User(
            username=f"adv_cr_{uid}",
            email=f"adv_cr_{uid}@test.fr",
            password_hash=hash_password("Pass123!"),
            is_guest=False,
        )
        s.add(creator)
        s.flush()

        barathon = Barathon(
            name=f"Barathon Adverse {uid}",
            start_datetime=now,
            has_started=True,
            status="started",
            travel_time_between_bars_minutes=10,
            max_time_in_bar_minutes=45,
            created_by_user_id=creator.id,
            join_code=f"AD{uid}".upper(),
        )
        s.add(barathon)
        s.flush()

        p_creator = BarathonParticipant(
            barathon_id=barathon.id,
            user_id=creator.id,
            role="creator",
        )
        s.add(p_creator)
        s.flush()

        participant_user_ids = []
        participant_membership_ids = []
        for i in range(participant_count):
            p_user = User(
                username=f"adv_p{i}_{uid}",
                email=f"adv_p{i}_{uid}@test.fr",
                password_hash=hash_password("Pass123!"),
                is_guest=False,
            )
            s.add(p_user)
            s.flush()

            p_part = BarathonParticipant(
                barathon_id=barathon.id,
                user_id=p_user.id,
                role="participant",
            )
            s.add(p_part)
            s.flush()
            participant_user_ids.append(p_user.id)
            participant_membership_ids.append(p_part.id)

        s.commit()
        return (
            barathon.id,
            creator.id,
            p_creator.id,
            participant_user_ids,
            participant_membership_ids,
        )


def make_test_jpeg(color: str = "blue", size: Tuple[int, int] = (200, 200)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format="JPEG")
    return buf.getvalue()


def craft_png_bomb(width: int = 10000, height: int = 10000) -> bytes:
    """Génère un micro-payload PNG déclarant des dimensions géantes (100 Mpx)."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data)
    ihdr = struct.pack(">I", 13) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)

    raw_scanlines = b"\x00" * (width * 3 + 1) * 10
    idat_data = zlib.compress(raw_scanlines)
    idat_crc = zlib.crc32(b"IDAT" + idat_data)
    idat = struct.pack(">I", len(idat_data)) + b"IDAT" + idat_data + struct.pack(">I", idat_crc)

    iend_crc = zlib.crc32(b"IEND")
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)
    return sig + ihdr + idat + iend


# ==============================================================================
# ATTAQUE 1 : COURSE CONCURRENTE MULTI-THREAD SUR POSTGRESQL RÉEL
# ==============================================================================


def test_adversarial_race_claim_upload_code_multi_threaded(pg_photo_engine):
    """
    Attaque 1.1 : Course concurrente sur claim_upload_code.
    5 threads simultanés attaquent avec le même code d'upload à 10 caractères.
    Vérification :
    - Exactement UN SEUL gagne (200 / token d'upload émis).
    - Les 4 autres sont rejetés avec HTTP 404 sans deadlock ni corruption.
    - L'état en base est strict : upload_code_hash est None, upload_claim_id est unique.
    """
    b_id, c_id, p_c_id, _, _ = create_adversarial_barathon(pg_photo_engine, 0)

    now = datetime.now(timezone.utc)
    upload_code = f"C{uuid.uuid4().hex[:9].upper()}"
    code_hash = hashlib.sha256(upload_code.encode("utf-8")).hexdigest()

    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="draft",
            question="Course Code ?",
            options=["A", "B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_race_claim",
            upload_code_hash=code_hash,
            code_expires_at=now + timedelta(minutes=10),
            draft_expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
        )
        s.add(challenge)
        s.commit()
        challenge_id = challenge.id

    barrier = threading.Barrier(5)
    results = []
    lock = threading.Lock()

    def worker():
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            token, c_returned, exp = PhotoService.claim_upload_code(s, upload_code)
            with lock:
                results.append(("SUCCESS", token, c_returned))
        except HTTPException as exc:
            with lock:
                results.append(("HTTPException", exc.status_code, exc.detail))
        except Exception as exc:
            with lock:
                results.append(("UNEXPECTED", type(exc).__name__, str(exc)))
        finally:
            s.close()

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 5

    successes = [r for r in results if r[0] == "SUCCESS"]
    not_founds = [r for r in results if r[0] == "HTTPException" and r[1] == 404]
    unexpected = [r for r in results if r[0] == "UNEXPECTED"]

    # Invariants stricts
    assert len(unexpected) == 0, f"Erreurs inattendues / deadlocks détectés: {unexpected}"
    assert len(successes) == 1, f"Attendu 1 seul vainqueur, obtenu {len(successes)}"
    assert len(not_founds) == 4, f"Attendu 4 rejets 404, obtenu {len(not_founds)}"

    # Vérification en base PostgreSQL
    with Session(bind=pg_photo_engine) as s:
        c = s.get(PhotoChallenge, challenge_id)
        assert c.upload_code_hash is None
        assert c.upload_claim_id is not None
        assert c.upload_claim_consumed_at is None


def test_adversarial_race_upload_photo_multi_threaded(pg_photo_engine):
    """
    Attaque 1.2 : Course concurrente sur upload_photo.
    5 threads simultanés envoient une photo avec le même jeton de capacité (même jti).
    Vérification :
    - Exactement UN SEUL gagne (201 / média créé).
    - Les 4 autres sont rejetés avec HTTP 403 (jeton consommé/invalide).
    - Aucun média fantôme en base de données (exactement 1 média actif 'ready').
    - Aucun fichier orphelin sur disque (exactement 1 fichier chiffré .enc).
    """
    b_id, c_id, p_c_id, _, _ = create_adversarial_barathon(pg_photo_engine, 0)

    now = datetime.now(timezone.utc)
    claim_id = uuid.uuid4()

    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="draft",
            question="Course Upload ?",
            options=["A", "B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_race_upload",
            upload_claim_id=claim_id,
            upload_claim_expires_at=now + timedelta(minutes=5),
            upload_claim_consumed_at=None,
            draft_expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
        )
        s.add(challenge)
        s.commit()
        challenge_id = challenge.id

    jpeg_data = make_test_jpeg(color="red", size=(300, 300))
    auth_context = {
        "sub": f"upload:{c_id}",
        "challenge_id": str(challenge_id),
        "jti": str(claim_id),
        "scope": "photo_upload",
    }

    barrier = threading.Barrier(5)
    results = []
    lock = threading.Lock()

    def worker():
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            res = PhotoService.upload_photo(s, challenge_id, jpeg_data, auth_context)
            with lock:
                results.append(("SUCCESS", res[0]))
        except HTTPException as exc:
            with lock:
                results.append(("HTTPException", exc.status_code, exc.detail))
        except Exception as exc:
            with lock:
                results.append(("UNEXPECTED", type(exc).__name__, str(exc)))
        finally:
            s.close()

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(results) == 5

    successes = [r for r in results if r[0] == "SUCCESS"]
    forbidden = [r for r in results if r[0] == "HTTPException" and r[1] == 403]
    unexpected = [r for r in results if r[0] == "UNEXPECTED"]

    assert len(unexpected) == 0, f"Erreurs inattendues / deadlocks: {unexpected}"
    assert len(successes) == 1, f"Attendu 1 seul gagnant, obtenu {len(successes)}"
    assert len(forbidden) == 4, f"Attendu 4 rejets 403, obtenu {len(forbidden)}"

    # Vérification absence de média fantôme en base
    with Session(bind=pg_photo_engine) as s:
        medias = s.scalars(
            select(PhotoMedia).where(PhotoMedia.challenge_id == challenge_id)
        ).all()
        assert len(medias) == 1
        assert medias[0].state == "ready"

    # Vérification sur disque : un seul fichier .enc
    storage_dir = get_storage_dir()
    enc_files = [f for f in os.listdir(storage_dir) if f.endswith(".enc")]
    assert len(enc_files) == 1, f"Attendu 1 fichier sur disque, trouvé {enc_files}"


def test_adversarial_race_last_answer_and_atomic_closure(pg_photo_engine):
    """
    Attaque 1.3 : Course sur la dernière réponse disponible.
    3 participants distincts de l'audience votent simultanément pour compléter l'audience attendue (expected_count=3).
    Vérification :
    - Les 3 réponses sont traitées et enregistrées de manière sérialisée (with_for_update).
    - La clôture s'exécute de façon atomique et UNIQUE : PhotoResult n'est créé qu'une seule fois.
    - Aucun crash d'intégrité (UniqueConstraint sur PhotoResult.challenge_id) ni deadlock PostgreSQL.
    """
    b_id, c_id, p_c_id, p_uids, p_mids = create_adversarial_barathon(
        pg_photo_engine, participant_count=3
    )

    now = datetime.now(timezone.utc)
    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="published",
            question="Question Clôture Atomique ?",
            options=["Choix 0", "Choix 1", "Choix 2"],
            correct_index=1,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_race_close",
            draft_expires_at=now + timedelta(minutes=10),
            expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
            expected_count=3,
        )
        s.add(challenge)
        s.flush()

        # Audiences : 1 créateur + 3 votants
        s.add(
            PhotoAudience(
                challenge_id=challenge.id,
                user_id=c_id,
                membership_id=p_c_id,
                is_creator=True,
            )
        )
        for uid_p, mid_p in zip(p_uids, p_mids):
            s.add(
                PhotoAudience(
                    challenge_id=challenge.id,
                    user_id=uid_p,
                    membership_id=mid_p,
                    is_creator=False,
                )
            )
        s.commit()
        challenge_id = challenge.id

    barrier = threading.Barrier(3)
    results = []
    lock = threading.Lock()

    def worker(u_id: int, choice_index: int):
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            b = s.get(Barathon, b_id)
            u = s.get(User, u_id)
            payload = PhotoAnswerPayload(choice_index=choice_index, passed=False)
            res = asyncio.run(PhotoService.submit_answer(s, b, challenge_id, u, payload))
            with lock:
                results.append(("SUCCESS", res.state))
        except HTTPException as exc:
            with lock:
                results.append(("HTTPException", exc.status_code, exc.detail))
        except Exception as exc:
            with lock:
                results.append(("UNEXPECTED", type(exc).__name__, str(exc)))
        finally:
            s.close()

    threads = [
        threading.Thread(target=worker, args=(p_uids[0], 1)),  # correct
        threading.Thread(target=worker, args=(p_uids[1], 1)),  # correct
        threading.Thread(target=worker, args=(p_uids[2], 0)),  # incorrect
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    unexpected = [r for r in results if r[0] == "UNEXPECTED"]
    assert len(unexpected) == 0, f"Crash inattendu ou deadlock : {unexpected}"

    successes = [r for r in results if r[0] == "SUCCESS"]
    assert len(successes) == 3, f"Tous les 3 votes doivent être enregistrés: {results}"

    # Vérification atomique de la clôture en base
    with Session(bind=pg_photo_engine) as s:
        c = s.get(PhotoChallenge, challenge_id)
        assert c.state == "closed"
        assert c.terminal_reason == "all_handled"

        # PhotoResult inséré EXACTEMENT une fois
        results_in_db = s.scalars(
            select(PhotoResult).where(PhotoResult.challenge_id == challenge_id)
        ).all()
        assert len(results_in_db) == 1
        res_record = results_in_db[0]
        assert res_record.expected_count == 3
        assert res_record.correct_count == 2
        assert res_record.incorrect_count == 1
        assert res_record.creator_dare is False

        # Réponses enregistrées
        answers = s.scalars(
            select(PhotoAnswer).where(PhotoAnswer.challenge_id == challenge_id)
        ).all()
        assert len(answers) == 3


def test_adversarial_race_duplicate_answer_same_user(pg_photo_engine):
    """
    Attaque 1.3b : Rejeu concurrent massif (4 threads) de la réponse d'un MÊME utilisateur.
    Vérification :
    - Exactement UNE seule ligne est insérée dans photo_answers.
    - Les requêtes concurrentes s'exécutent sans UniqueConstraint crash ni corruption.
    """
    b_id, c_id, p_c_id, p_uids, p_mids = create_adversarial_barathon(
        pg_photo_engine, participant_count=2
    )

    now = datetime.now(timezone.utc)
    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="published",
            question="Rejeu Concurrent ?",
            options=["Opt A", "Opt B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_rejeu",
            draft_expires_at=now + timedelta(minutes=10),
            expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
            expected_count=2,
        )
        s.add(challenge)
        s.flush()
        s.add(
            PhotoAudience(
                challenge_id=challenge.id,
                user_id=c_id,
                membership_id=p_c_id,
                is_creator=True,
            )
        )
        s.add(
            PhotoAudience(
                challenge_id=challenge.id,
                user_id=p_uids[0],
                membership_id=p_mids[0],
                is_creator=False,
            )
        )
        s.commit()
        challenge_id = challenge.id

    target_user_id = p_uids[0]
    barrier = threading.Barrier(4)
    results = []
    lock = threading.Lock()

    def worker():
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            b = s.get(Barathon, b_id)
            u = s.get(User, target_user_id)
            payload = PhotoAnswerPayload(choice_index=0, passed=False)
            res = asyncio.run(PhotoService.submit_answer(s, b, challenge_id, u, payload))
            with lock:
                results.append(("SUCCESS", res.state))
        except HTTPException as exc:
            with lock:
                results.append(("HTTPException", exc.status_code, exc.detail))
        except Exception as exc:
            with lock:
                results.append(("UNEXPECTED", type(exc).__name__, str(exc)))
        finally:
            s.close()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    unexpected = [r for r in results if r[0] == "UNEXPECTED"]
    assert len(unexpected) == 0, f"Erreurs d'intégrité ou deadlock: {unexpected}"

    # Vérification en base : exactement 1 réponse
    with Session(bind=pg_photo_engine) as s:
        answers_count = s.scalar(
            select(func.count(PhotoAnswer.audience_id)).where(
                PhotoAnswer.challenge_id == challenge_id
            )
        )
        assert answers_count == 1


def test_adversarial_race_participant_revocation_vs_vote(pg_photo_engine):
    """
    Attaque 1.4 : Course concurrente entre la révocation d'un participant et son vote.
    Thread A : révoque le participant (exclusion / départ).
    Thread B : le participant tente de voter simultanément.
    Vérification :
    - Aucune exception DB non gérée, aucun deadlock PostgreSQL.
    - Si la révocation passe en premier : le vote est immédiatement rejeté avec HTTP 403.
    - Si le vote passe en premier : la réponse est enregistrée puis l'audience est marquée revoked_at.
    - L'invariant strict est vérifié : aucun vote n'est enregistré avec audience révoquée.
    """
    b_id, c_id, p_c_id, p_uids, p_mids = create_adversarial_barathon(
        pg_photo_engine, participant_count=1
    )

    now = datetime.now(timezone.utc)
    voter_user_id = p_uids[0]
    voter_mid = p_mids[0]

    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="published",
            question="Course Révocation vs Vote ?",
            options=["A", "B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_race_rev",
            draft_expires_at=now + timedelta(minutes=10),
            expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
            expected_count=1,
        )
        s.add(challenge)
        s.flush()
        s.add(
            PhotoAudience(
                challenge_id=challenge.id,
                user_id=c_id,
                membership_id=p_c_id,
                is_creator=True,
            )
        )
        s.add(
            PhotoAudience(
                challenge_id=challenge.id,
                user_id=voter_user_id,
                membership_id=voter_mid,
                is_creator=False,
            )
        )
        s.commit()
        challenge_id = challenge.id

    barrier = threading.Barrier(2)
    race_outcomes = {}

    def worker_revoke():
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            PhotoService.revoke_participant_photo_access(s, b_id, voter_user_id)
            race_outcomes["revoke"] = ("SUCCESS",)
        except Exception as exc:
            race_outcomes["revoke"] = ("ERROR", type(exc).__name__, str(exc))
        finally:
            s.close()

    def worker_vote():
        s = Session(bind=pg_photo_engine)
        try:
            barrier.wait()
            b = s.get(Barathon, b_id)
            u = s.get(User, voter_user_id)
            payload = PhotoAnswerPayload(choice_index=0, passed=False)
            res = asyncio.run(PhotoService.submit_answer(s, b, challenge_id, u, payload))
            race_outcomes["vote"] = ("SUCCESS", res.state)
        except HTTPException as exc:
            race_outcomes["vote"] = ("HTTPException", exc.status_code, exc.detail)
        except Exception as exc:
            race_outcomes["vote"] = ("ERROR", type(exc).__name__, str(exc))
        finally:
            s.close()

    t_revoke = threading.Thread(target=worker_revoke)
    t_vote = threading.Thread(target=worker_vote)
    t_revoke.start()
    t_vote.start()
    t_revoke.join()
    t_vote.join()

    # Zéro deadlock / exception technique
    assert race_outcomes["revoke"][0] == "SUCCESS"
    assert race_outcomes["vote"][0] in ("SUCCESS", "HTTPException")

    with Session(bind=pg_photo_engine) as s:
        aud = s.scalar(
            select(PhotoAudience).where(
                PhotoAudience.challenge_id == challenge_id,
                PhotoAudience.user_id == voter_user_id,
            )
        )
        assert aud is not None
        assert aud.revoked_at is not None  # L'audience doit TOUJOURS finir révoquée

        ans = s.scalar(
            select(PhotoAnswer).where(
                PhotoAnswer.challenge_id == challenge_id,
                PhotoAnswer.audience_id == aud.id,
            )
        )

        if race_outcomes["vote"][0] == "HTTPException":
            assert ans is None, "Aucune réponse ne doit subsister si le vote a été rejeté !"
            assert race_outcomes["vote"][1] == 403


# ==============================================================================
# ATTAQUE 2 : SATURATION ET CONTOURNEMENT MULTIPART
# ==============================================================================


@pytest.mark.anyio
async def test_adversarial_chunked_upload_stream_exceeding_2mib_blocked_with_413():
    """
    Attaque 2.1 : Upload sans Content-Length (Transfer-Encoding: chunked / stream) avec 3 MiB.
    Le client omet sciemment l'en-tête Content-Length et streame 3 MiB en morceaux de 64 KiB.
    Vérification :
    - La boucle de streaming serveur bloque immédiatement à 2 MiB.
    - Code retour HTTP 413 "Fichier trop volumineux (maximum 2 MiB).".
    """
    valid_token = create_access_token(
        data={
            "sub": "upload:9999",
            "challenge_id": str(uuid.uuid4()),
            "jti": str(uuid.uuid4()),
            "scope": "photo_upload",
        }
    )

    boundary = f"----AdversarialBoundary{uuid.uuid4().hex}"
    part_head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="chunked_attack.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8")
    part_foot = f"\r\n--{boundary}--\r\n".encode("utf-8")

    async def stream_3mib_chunks():
        yield part_head
        # 3 MiB = 48 morceaux de 64 KiB
        for _ in range(48):
            yield b"A" * (64 * 1024)
        yield part_foot

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        res = await client.post(
            "/photo-mystery/upload",
            content=stream_3mib_chunks(),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Authorization": f"Bearer {valid_token}",
            },
        )
        assert res.status_code == 413
        assert "Fichier trop volumineux" in res.json()["detail"]


def test_adversarial_decompression_bomb_pillow_rejected():
    """
    Attaque 2.2 : Bombe de décompression Pillow.
    Envoi d'un micro-PNG déclarant 10000x10000 px (100 Mpx), dépassant MAX_IMAGE_PIXELS (6 Mpx).
    Vérification :
    - process_photo lève immédiatement ValueError("Image suspecte ou trop volumineuse (bombe de décompression)").
    - Aucune saturation de RAM ni blocage CPU.
    """
    bomb_bytes = craft_png_bomb(width=10000, height=10000)
    assert len(bomb_bytes) < 1024  # Moins de 1 Ko sur le réseau !

    t0 = time.time()
    with pytest.raises(ValueError, match="bombe de décompression"):
        process_photo(bomb_bytes)
    duration = time.time() - t0

    # L'exécution doit être quasi instantanée (< 100 ms)
    assert duration < 0.2, f"Le contrôle a pris trop de temps ({duration:.3f}s), risque de DoS !"


def test_adversarial_corrupted_pseudo_jpeg_upload_cleans_up(pg_photo_engine):
    """
    Attaque 2.3 : Envoi d'un pseudo-JPEG corrompu (octets magiques valides suivis de bruit).
    Vérification :
    - Rejet immédiat avec HTTP 400.
    - Aucun fichier .enc résiduel ni .tmp_* n'est créé ou persiste sur disque.
    """
    b_id, c_id, p_c_id, _, _ = create_adversarial_barathon(pg_photo_engine, 0)

    now = datetime.now(timezone.utc)
    claim_id = uuid.uuid4()

    with Session(bind=pg_photo_engine) as s:
        challenge = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="draft",
            question="Corrupted Upload ?",
            options=["A", "B"],
            correct_index=0,
            create_key=uuid.uuid4(),
            create_fingerprint="fp_corrupt",
            upload_claim_id=claim_id,
            upload_claim_expires_at=now + timedelta(minutes=5),
            upload_claim_consumed_at=None,
            draft_expires_at=now + timedelta(minutes=10),
            retention_until=now + timedelta(hours=1),
        )
        s.add(challenge)
        s.commit()
        challenge_id = challenge.id

    # JPEG Header valide (FF D8 FF) suivi de 64 Ko de bruit aléatoire corrompu
    corrupted_data = b"\xff\xd8\xff" + os.urandom(64 * 1024)

    auth_context = {
        "sub": f"upload:{c_id}",
        "challenge_id": str(challenge_id),
        "jti": str(claim_id),
        "scope": "photo_upload",
    }

    storage_dir = get_storage_dir()
    initial_files = set(os.listdir(storage_dir))

    with Session(bind=pg_photo_engine) as s:
        with pytest.raises(HTTPException) as exc_info:
            PhotoService.upload_photo(s, challenge_id, corrupted_data, auth_context)
        assert exc_info.value.status_code == 400

    # Vérification stricte du disque : aucun nouveau fichier .enc ni .tmp_*
    final_files = set(os.listdir(storage_dir))
    diff_files = final_files - initial_files
    assert len(diff_files) == 0, f"Fichiers orphelins résiduels détectés sur disque : {diff_files}"


# ==============================================================================
# ATTAQUE 3 : PURGE & CRASH / RESTART
# ==============================================================================


def test_adversarial_process_restart_with_new_aes_key_and_orphaned_cleanup(
    pg_photo_engine, monkeypatch
):
    """
    Attaque 3.1 : Simulation d'un crash / redémarrage de conteneur avec nouvelle clé AES éphémère.
    1. Des fichiers sont chiffrés et stockés avec la clé K1.
    2. Le conteneur redémarre : la clé éphémère change en mémoire vive (K2).
    3. Tentative de déchiffrement : rejet propre avec ValueError sans crash.
    4. Réconciliation initiale du conteneur (reconcile_photo_storage + cleanup_orphaned_files).
    5. Vérification : tous les fichiers orphelins, indéchiffrables ou expirés sont purgés.
    """
    storage_dir = get_storage_dir()

    # 1. Chiffrement avec clé initiale K1
    media_uuid = uuid.uuid4()
    jpeg_bytes = make_test_jpeg(color="purple")
    storage_key1, _ = encrypt_and_store(media_uuid, jpeg_bytes)

    assert os.path.isfile(os.path.join(storage_dir, f"{storage_key1}.enc"))

    # Vérification déchiffrement OK avec clé K1
    decrypted = decrypt_media(media_uuid, storage_key1)
    assert decrypted.startswith(b"\xff\xd8\xff")

    # 2. Simulation d'un fichier orphelin inconnu et d'un vieux temporaire abandonné
    orphaned_key = uuid.uuid4()
    with open(os.path.join(storage_dir, f"{orphaned_key}.enc"), "wb") as f:
        f.write(b"PRP1" + os.urandom(60))

    abandoned_tmp = os.path.join(storage_dir, f".tmp_{uuid.uuid4().hex}_leak")
    with open(abandoned_tmp, "w") as f:
        f.write("temporary leak")
    mtime_old = time.time() - 25 * 60
    os.utime(abandoned_tmp, (mtime_old, mtime_old))

    # 3. Crash / Redémarrage du conteneur : régénération de la clé éphémère
    new_ephemeral_key = secrets.token_bytes(32)
    monkeypatch.setattr(photo_storage, "_EPHEMERAL_PROCESS_KEY", new_ephemeral_key)
    monkeypatch.delenv("PHOTO_AES_KEY", raising=False)

    # 4. Le fichier storage_key1 devient indéchiffrable par la nouvelle instance
    with pytest.raises(ValueError, match="Échec du déchiffrement"):
        decrypt_media(media_uuid, storage_key1)

    # 5. Création en base d'un enregistrement expiré pour storage_key1
    now = datetime.now(timezone.utc)
    with Session(bind=pg_photo_engine) as s:
        b_id, c_id, p_c_id, _, _ = create_adversarial_barathon(pg_photo_engine, 0)
        ch = PhotoChallenge(
            barathon_id=b_id,
            creator_user_id=c_id,
            creator_membership_id=p_c_id,
            state="expired",
            question="Crash Challenge",
            options=["A", "B"],
            create_key=uuid.uuid4(),
            create_fingerprint="fp_crash",
            draft_expires_at=now - timedelta(minutes=20),
            retention_until=now - timedelta(minutes=10),
            terminal_at=now - timedelta(minutes=20),
        )
        s.add(ch)
        s.flush()

        media_rec = PhotoMedia(
            id=media_uuid,
            challenge_id=ch.id,
            storage_key=storage_key1,
            state="delete_pending",
            purge_due_at=now - timedelta(minutes=5),
        )
        s.add(media_rec)
        s.commit()

        # 6. Exécution de la réconciliation au démarrage du pod
        purged_count = reconcile_photo_storage(s)
        assert purged_count >= 1

    # 7. Nettoyage orphelins : aucun des deux fichiers orphelins ne doit subsister
    cleanup_orphaned_files(known_storage_keys=set())

    assert not os.path.exists(os.path.join(storage_dir, f"{storage_key1}.enc"))
    assert not os.path.exists(os.path.join(storage_dir, f"{orphaned_key}.enc"))
    assert not os.path.exists(abandoned_tmp)


# ==============================================================================
# ATTAQUE 4 : MIGRATION ALEMBIC & ROLLBACK SUR POSTGRESQL RÉEL
# ==============================================================================


def test_adversarial_alembic_full_upgrade_downgrade_upgrade_cycle(pg_photo_engine):
    """
    Attaque 4.1 : Cycle complet Alembic sur PostgreSQL réel.
    Upgrade b1c2d3e4f5a6 -> Downgrade a7b8c9d0e1f2 -> Upgrade b1c2d3e4f5a6.
    Vérification :
    - Application stricte des DDL (tables photo_*, index, contraintes).
    - Downgrade propre sans résidus ni corruption des tables coeur (users, barathons).
    - Ré-upgrade laissant la base dans un état opérationnel final.
    """
    cfg = get_alembic_config(PG_TEST_URL)

    # 1. Étape 1 : Upgrade vers b1c2d3e4f5a6
    command.upgrade(cfg, "b1c2d3e4f5a6")

    insp = inspect(pg_photo_engine)
    tables = insp.get_table_names()
    for table_name in [
        "photo_challenges",
        "photo_media",
        "photo_audience",
        "photo_answers",
        "photo_results",
        "photo_secure_guests",
        "photo_rate_events",
    ]:
        assert table_name in tables, f"Table {table_name} manquante après upgrade !"

    # Vérification des colonnes anti-rejeu et sécurité
    ch_cols = {c["name"]: c for c in insp.get_columns("photo_challenges")}
    assert "upload_claim_id" in ch_cols
    assert "upload_claim_consumed_at" in ch_cols
    assert "upload_claim_expires_at" in ch_cols
    assert "upload_code_hash" in ch_cols

    # 2. Étape 2 : Rollback vers a7b8c9d0e1f2
    command.downgrade(cfg, "a7b8c9d0e1f2")

    insp_post_down = inspect(pg_photo_engine)
    tables_post_down = insp_post_down.get_table_names()

    for table_name in [
        "photo_challenges",
        "photo_media",
        "photo_audience",
        "photo_answers",
        "photo_results",
        "photo_secure_guests",
        "photo_rate_events",
    ]:
        assert (
            table_name not in tables_post_down
        ), f"Table {table_name} encore présente après downgrade !"

    # Les tables coeur doivent être parfaitement préservées
    assert "users" in tables_post_down
    assert "barathons" in tables_post_down
    assert "barathon_participants" in tables_post_down

    # 3. Étape 3 : Ré-upgrade vers b1c2d3e4f5a6 pour rétablir la base opérationnelle
    command.upgrade(cfg, "b1c2d3e4f5a6")

    insp_final = inspect(pg_photo_engine)
    tables_final = insp_final.get_table_names()
    assert "photo_challenges" in tables_final
    assert "photo_media" in tables_final


# ==============================================================================
# ATTAQUE 5 : VALIDATIONS SCHÉMAS, LOGGING JSON, AUTHENTIFICATION ET IDEMPOTENCE
# ==============================================================================


def test_adversarial_correct_index_bounds_validation():
    """
    VULN-06 : Vérifie qu'un créateur ne peut pas truquer le jeu avec un correct_index
    hors bornes par rapport au nombre d'options.
    """
    from app.photo_schemas import PhotoChallengeCreate
    from pydantic import ValidationError

    # Cas 1 : 2 options, correct_index = 2 (invalide car indices 0 et 1)
    with pytest.raises(ValidationError) as exc:
        PhotoChallengeCreate(
            question="Qui a bu le dernier verre ?",
            options=["Alice", "Bob"],
            correct_index=2,
        )
    assert "L'index de la bonne réponse doit être compris entre 0 et le nombre d'options moins 1" in str(exc.value)

    # Cas 2 : correct_index = 3 avec 3 options
    with pytest.raises(ValidationError):
        PhotoChallengeCreate(
            question="Qui a bu le dernier verre ?",
            options=["Alice", "Bob", "Charlie"],
            correct_index=3,
        )

    # Cas 3 : correct_index valide
    valid = PhotoChallengeCreate(
        question="Qui a bu le dernier verre ?",
        options=["Alice", "Bob"],
        correct_index=1,
    )
    assert valid.correct_index == 1


def test_adversarial_sensitive_data_filter_json_and_traceback():
    """
    VULN-07 : Vérifie que le caviardage s'applique aux structures JSON et aux traces d'exception.
    """
    import logging
    from app.core.logging_filter import SensitiveDataFilter

    filt = SensitiveDataFilter()

    # 1. Caviardage JSON
    json_text = '{"code": "ABCDEF1234", "upload_token": "secret_jwt_token_here", "other": 123}'
    redacted_json = filt.redact(json_text)
    assert 'ABCDEF1234' not in redacted_json
    assert 'secret_jwt_token_here' not in redacted_json
    assert '"code": "[REDACTED]"' in redacted_json
    assert '"upload_token": "[REDACTED]"' in redacted_json

    # 2. Caviardage record.exc_text
    record = logging.LogRecord(
        name="test",
        level=logging.ERROR,
        pathname="test.py",
        lineno=1,
        msg="Error during processing",
        args=(),
        exc_info=None,
    )
    record.exc_text = 'Traceback: call with token="super_secret_token_123"'
    filt.filter(record)
    assert "super_secret_token_123" not in record.exc_text
    assert "[REDACTED]" in record.exc_text


@pytest.mark.anyio
async def test_adversarial_unauthenticated_upload_blocked_by_middleware():
    """
    VULN-03 : Vérifie qu'un upload sans en-tête Authorization est immédiatement
    rejeté avec 401 par le middleware avant toute bufferisation multipart.
    """
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post(
            "/photo-mystery/upload",
            content=b"arbitrary_binary_payload",
            headers={"Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryX"},
        )
        assert res.status_code == 401
        assert "Token manquant ou format invalide" in res.json()["detail"]


def test_adversarial_finalize_expired_challenges_idempotent(pg_photo_engine, monkeypatch):
    """
    VULN-04 : Vérifie que des appels répétés ou concurrents à finalize_expired_challenges
    ne provoquent pas de violation d'unicité sur photo_results_pkey.
    """
    monkeypatch.setenv("PHOTO_MYSTERY_ENABLED", "true")
    monkeypatch.setenv("PHOTO_MYSTERY_ALLOWLIST", "*")

    SessionLocal = sessionmaker(bind=pg_photo_engine)
    session = SessionLocal()

    uid = uuid.uuid4().hex[:6]
    creator = User(username=f"fin_u_{uid}", email=f"fin_{uid}@test.com", password_hash=hash_password("p"), is_guest=False)
    voter = User(username=f"fin_v_{uid}", email=f"fin_v_{uid}@test.com", password_hash=hash_password("p"), is_guest=False)
    session.add_all([creator, voter])
    session.flush()

    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    barathon = Barathon(
        name="Fin Barathon",
        start_datetime=past,
        has_started=True,
        status="started",
        travel_time_between_bars_minutes=10,
        max_time_in_bar_minutes=45,
        created_by_user_id=creator.id,
        join_code=f"F{uid}",
    )
    session.add(barathon)
    session.flush()

    p1 = BarathonParticipant(barathon_id=barathon.id, user_id=creator.id, role="creator")
    p2 = BarathonParticipant(barathon_id=barathon.id, user_id=voter.id, role="guest")
    session.add_all([p1, p2])
    session.flush()

    # Défi expiré dans le passé
    ch = PhotoChallenge(
        barathon_id=barathon.id,
        creator_user_id=creator.id,
        creator_membership_id=p1.id,
        state="published",
        question="Fin test ?",
        options=["Oui", "Non"],
        correct_index=0,
        create_key=uuid.uuid4(),
        create_fingerprint="fp_fin",
        code_expires_at=past,
        draft_expires_at=past,
        expires_at=past,  # Déjà expiré
        retention_until=past + timedelta(hours=1),
        expected_count=1,
    )
    session.add(ch)
    session.flush()

    aud1 = PhotoAudience(challenge_id=ch.id, user_id=creator.id, membership_id=p1.id, is_creator=True)
    aud2 = PhotoAudience(challenge_id=ch.id, user_id=voter.id, membership_id=p2.id, is_creator=False)
    session.add_all([aud1, aud2])
    session.flush()

    ans = PhotoAnswer(challenge_id=ch.id, audience_id=aud2.id, choice_index=0, passed=False)
    session.add(ans)
    session.commit()

    # Premier appel
    PhotoService.finalize_expired_challenges(session, barathon.id)
    session.refresh(ch)
    assert ch.state == "closed"

    # Deuxième appel immédiat : doit être strictement idempotent sans lever de UniqueViolation
    PhotoService.finalize_expired_challenges(session, barathon.id)

    results = session.scalars(select(PhotoResult).where(PhotoResult.challenge_id == ch.id)).all()
    assert len(results) == 1
    session.close()

