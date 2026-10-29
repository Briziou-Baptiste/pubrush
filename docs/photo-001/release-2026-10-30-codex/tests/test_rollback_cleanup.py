"""Execute the exact Job command against an explicitly disposable PostgreSQL.

Run with the candidate backend on PYTHONPATH and its dependencies installed:
  PHOTO_ROLLBACK_TEST_DATABASE_URL=<private URL> python -m unittest discover \
    -s docs/photo-001/release-2026-10-30-codex/tests -v

The test database must already have the candidate migrations. No production or
staging URL is accepted. Tests create/delete synthetic data in this database.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
import uuid
from datetime import datetime, timedelta, timezone

import yaml
from sqlalchemy import create_engine, delete, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session


RELEASE = Path(__file__).resolve().parents[1]
JOB = yaml.safe_load((RELEASE / "prepared-not-applied/rollback-purge-job.template.yaml").read_text())
COMMAND = JOB["spec"]["template"]["spec"]["containers"][0]["command"]
OLD_COMMAND = ["python", "-B", "-c", "import asyncio; from app.services.photo_purge import photo_purge_watcher; asyncio.run(photo_purge_watcher())"]


class RollbackCleanupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        url = make_url(os.environ["PHOTO_ROLLBACK_TEST_DATABASE_URL"])
        if (url.drivername, url.host, url.port, url.database, url.username) != (
            "postgresql+psycopg", "127.0.0.1", 5432, "pubrush_rollback_test", "photo_cleanup"
        ) or url.query or not url.password:
            raise RuntimeError("Only the dedicated disposable PostgreSQL is allowed")
        os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
        import app.models
        import app.photo_models
        cls.User = app.models.User
        cls.Barathon = app.models.Barathon
        cls.Challenge = app.photo_models.PhotoChallenge
        cls.Media = app.photo_models.PhotoMedia
        cls.engine = create_engine(url)
        with cls.engine.connect() as connection:
            assert connection.scalar(text("SELECT current_database()")) == "pubrush_rollback_test"
            assert connection.scalar(text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")) is False
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "b1c2d3e4f5a6"
        with Session(cls.engine) as db:
            user = cls.User(email="rollback-" + uuid.uuid4().hex + "@example.invalid", username="Synthetic", password_hash="synthetic-unused")
            db.add(user)
            db.flush()
            barathon = cls.Barathon(name="Rollback sentinel", start_datetime=datetime.now(timezone.utc), created_by_user_id=user.id, travel_time_between_bars_minutes=5, max_time_in_bar_minutes=30)
            db.add(barathon)
            db.commit()
            cls.user_id, cls.barathon_id = user.id, barathon.id

    @classmethod
    def tearDownClass(cls):
        with Session(cls.engine) as db:
            db.execute(delete(cls.Media))
            db.execute(delete(cls.Barathon).where(cls.Barathon.id == cls.barathon_id))
            db.execute(delete(cls.User).where(cls.User.id == cls.user_id))
            db.commit()
        cls.engine.dispose()

    def setUp(self):
        with Session(self.engine) as db:
            db.execute(delete(self.Media))
            db.execute(delete(self.Challenge).where(self.Challenge.barathon_id == self.barathon_id))
            db.commit()
        self.cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)

    def add_media(self, orphan=False, newer=False):
        with Session(self.engine) as db:
            challenge_id = None
            if not orphan:
                challenge = self.Challenge(barathon_id=self.barathon_id, creator_user_id=self.user_id, state="published", create_fingerprint="synthetic", draft_expires_at=datetime.now(timezone.utc), retention_until=datetime.now(timezone.utc) + timedelta(hours=24))
                db.add(challenge)
                db.flush()
                challenge_id = challenge.id
            media = self.Media(challenge_id=challenge_id, storage_key=uuid.uuid4(), state="ready", created_at=self.cutoff + timedelta(minutes=1) if newer else self.cutoff - timedelta(minutes=1), purge_due_at=datetime.now(timezone.utc) + timedelta(hours=6))
            db.add(media)
            db.commit()
            return str(media.id)

    def snapshot(self, media_only=False):
        with self.engine.connect() as connection:
            names = ["photo_media"] if media_only else connection.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'photo_media' ORDER BY tablename")).all()
            return {name: connection.scalar(text('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), \'[]\'::jsonb) FROM "' + name + '" t')) for name in names}

    def run_job(self, extra=None):
        env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
        env.update(PHOTO_MYSTERY_ENABLED="false", PGCONNECT_TIMEOUT="2", PHOTO_ROLLBACK_STORAGE_LOST_BEFORE=self.cutoff.isoformat(), PHOTO_STORAGE_DIR="/must-not-access-old-volume")
        env.update(extra or {})
        started = time.monotonic()
        result = subprocess.run([sys.executable, *COMMAND[1:]], env=env, capture_output=True, text=True, timeout=10)
        self.assertLess(time.monotonic() - started, 10)
        password = make_url(env["DATABASE_URL"]).password
        self.assertNotIn(password, result.stdout + result.stderr)
        return result

    def test_original_entrypoint_reproduces_mapper_failure_and_never_finishes(self):
        env = dict(os.environ, PHOTO_STORAGE_DIR="/must-not-access-old-volume")
        proc = subprocess.Popen([sys.executable, *OLD_COMMAND[1:]], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            with self.assertRaises(subprocess.TimeoutExpired):
                # Cold imports also run under the Job's 250m CPU limit.
                proc.communicate(timeout=8)
        finally:
            proc.kill()
            stdout, stderr = proc.communicate(timeout=5)
        self.assertIn("failed to locate a name ('Barathon')", stderr)

    def test_attached_media_from_lost_volume_is_marked_deleted(self):
        media_id = self.add_media()
        result = self.run_job()
        self.assertEqual(result.returncode, 0, result.stderr)
        row = self.snapshot(True)["photo_media"][0]
        self.assertEqual(row["id"], media_id)
        self.assertEqual(row["state"], "deleted")
        self.assertIsNotNone(row["deleted_at"])
        self.assertIsNotNone(row["delete_requested_at"])

    def test_orphan_from_missing_volume_is_marked_deleted(self):
        self.add_media(orphan=True)
        self.assertEqual(self.run_job().returncode, 0)
        self.assertEqual(self.snapshot(True)["photo_media"][0]["state"], "deleted")

    def test_empty_database_finishes_successfully(self):
        result = self.run_job()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("updated=0", result.stdout)

    def test_reexecution_is_idempotent(self):
        self.add_media()
        self.assertEqual(self.run_job().returncode, 0)
        before = self.snapshot(True)
        result = self.run_job()
        self.assertEqual(result.returncode, 0)
        self.assertIn("updated=0", result.stdout)
        self.assertEqual(before, self.snapshot(True))

    def test_real_sql_write_failure_returns_nonzero_without_changes(self):
        self.add_media()
        before = self.snapshot(True)
        result = self.run_job({"PGOPTIONS": "-c default_transaction_read_only=on"})
        self.assertEqual(result.returncode, 1)
        self.assertIn("cleanup failed:", result.stderr)
        self.assertEqual(before, self.snapshot(True))

    def test_newer_media_is_not_touched(self):
        self.add_media(orphan=True)
        newer_id = self.add_media(orphan=True, newer=True)
        self.assertEqual(self.run_job().returncode, 0)
        rows = {row["id"]: row for row in self.snapshot(True)["photo_media"]}
        self.assertEqual(rows[newer_id]["state"], "ready")
        self.assertIsNone(rows[newer_id]["deleted_at"])
        self.assertEqual(sum(row["state"] == "deleted" for row in rows.values()), 1)

    def test_all_other_tables_are_unchanged(self):
        self.add_media()
        before = self.snapshot()
        self.assertEqual(self.run_job().returncode, 0)
        self.assertEqual(before, self.snapshot())

    def test_invalid_cutoffs_are_rejected_without_changes(self):
        self.add_media()
        before = self.snapshot(True)
        for cutoff in ("${PHOTO_ROLLBACK_STORAGE_LOST_BEFORE}", "", "2026-01-01T00:00:00", (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()):
            with self.subTest(cutoff=cutoff):
                self.assertEqual(self.run_job({"PHOTO_ROLLBACK_STORAGE_LOST_BEFORE": cutoff}).returncode, 1)
                self.assertEqual(before, self.snapshot(True))

    def test_photo_enabled_is_rejected(self):
        self.add_media()
        before = self.snapshot(True)
        self.assertEqual(self.run_job({"PHOTO_MYSTERY_ENABLED": "true"}).returncode, 1)
        self.assertEqual(before, self.snapshot(True))

    def test_manifest_is_bounded_and_hardened(self):
        spec = JOB["spec"]
        pod = spec["template"]["spec"]
        container = pod["containers"][0]
        self.assertEqual(spec["activeDeadlineSeconds"], 120)
        self.assertEqual(spec["backoffLimit"], 0)
        self.assertEqual(pod["restartPolicy"], "Never")
        self.assertFalse(pod["automountServiceAccountToken"])
        self.assertEqual(pod["securityContext"]["runAsUser"], 10000)
        self.assertTrue(pod["securityContext"]["runAsNonRoot"])
        self.assertFalse(container["securityContext"]["allowPrivilegeEscalation"])
        self.assertTrue(container["securityContext"]["readOnlyRootFilesystem"])
        self.assertEqual(container["securityContext"]["capabilities"]["drop"], ["ALL"])
        self.assertEqual(container["resources"]["limits"], {"cpu": "250m", "memory": "256Mi"})
        env = {value["name"]: value for value in container["env"]}
        self.assertNotIn("PHOTO_AES_KEY", env)
        self.assertNotIn("JWT_SECRET_KEY", env)
        self.assertEqual(env["PHOTO_MYSTERY_ENABLED"]["value"], "false")
        self.assertNotIn("persistentVolumeClaim", json.dumps(pod))


if __name__ == "__main__":
    unittest.main(verbosity=2)
