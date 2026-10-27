import os
import runpy
import shutil
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy
from alembic import context
from alembic.config import Config
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


class StopBeforeConnection(Exception):
    pass


def capture_alembic_configuration(monkeypatch, url, inherited):
    """Execute the real Alembic environment, stopping before any connection."""
    cfg = Config()
    cfg.set_main_option("sqlalchemy.url", url)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("APP_ENV", "production")
    for key, value in inherited.items():
        monkeypatch.setenv(key, value)

    captured = {}

    class NoConnection:
        def connect(self):
            raise StopBeforeConnection()

    def engine_from_config(section, **kwargs):
        captured["connect_args"] = kwargs.get("connect_args", {}).copy()
        captured["host"] = make_url(section["sqlalchemy.url"]).host
        captured["environment"] = {key: os.environ.get(key) for key in inherited}
        return NoConnection()

    with patch.object(context, "config", cfg, create=True), patch.object(
        context, "is_offline_mode", return_value=False
    ), patch.object(sqlalchemy, "engine_from_config", engine_from_config):
        with pytest.raises(StopBeforeConnection):
            runpy.run_path(str(BACKEND_DIR / "alembic" / "env.py"))
    return captured


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://synthetic:localhost-token@production.invalid:5432/pubrush",
        "postgresql+psycopg://synthetic:password@production.invalid:5432/localhost_archive",
    ],
    ids=["localhost-in-password", "localhost-in-database"],
)
def test_non_staging_remote_url_never_forces_local_address(monkeypatch, url):
    captured = capture_alembic_configuration(monkeypatch, url, {})
    assert captured["host"] == "production.invalid"
    assert "hostaddr" not in captured["connect_args"]


def test_non_staging_libpq_environment_is_preserved(monkeypatch):
    inherited = {
        "PGHOSTADDR": "192.0.2.12",
        "PGPASSWORD": "synthetic-password",
        "PGPASSFILE": "/private/tmp/synthetic-pgpass",
        "PGSERVICE": "synthetic-service",
        "PGSERVICEFILE": "/private/tmp/synthetic-service.conf",
        "PGOPTIONS": "-c statement_timeout=10000",
    }
    captured = capture_alembic_configuration(
        monkeypatch,
        "postgresql+psycopg://synthetic@production.invalid:5432/pubrush",
        inherited,
    )
    assert captured["environment"] == inherited
    assert {key: os.environ.get(key) for key in inherited} == inherited


def test_staging_launcher_migrates_postgres_with_hostile_pghostaddr(tmp_path):
    """Run the real launcher and migration against an explicitly dedicated local DB.

    Docker and the health check are replaced locally; Alembic, psycopg, PostgreSQL,
    the seed, and the launcher's environment handling are real.
    """
    url = os.environ.get("PHOTO_STAGING_TEST_DATABASE_URL")
    if not url:
        pytest.skip("PHOTO_STAGING_TEST_DATABASE_URL is not configured")
    target = make_url(url)
    assert (target.drivername, target.host, target.port, target.username, target.database) == (
        "postgresql+psycopg", "127.0.0.1", 15432, "photo_staging", "pubrush_photo_staging"
    )
    assert not target.query and target.password

    staging_dir = tmp_path / "pubrush-k8s" / "staging"
    backend = tmp_path / "backend"
    bin_dir = tmp_path / "bin"
    staging_dir.mkdir(parents=True)
    backend.mkdir()
    bin_dir.mkdir()
    launcher = staging_dir / "staging.sh"
    shutil.copy(REPO_DIR / "pubrush-k8s" / "staging" / "staging.sh", launcher)
    for name in (".venv", "app", "alembic", "alembic.ini", "scripts"):
        (backend / name).symlink_to(BACKEND_DIR / name)

    env_file = backend / ".env.staging"
    env_file.write_text(
        "DATABASE_URL=" + target.set(host="db-photo", port=5432).render_as_string(hide_password=False) + "\n"
    )
    env_file.chmod(0o600)

    # No container or network service is started by the launcher in this test.
    fake_commands = {
        "docker": "if [ \"$1\" = inspect ]; then printf '\"healthy\"\\n'; fi\n",
        "lsof": "exit 1\n",
        "curl": "printf 200\n",
        "sleep": "exit 0\n",
    }
    for name, body in fake_commands.items():
        executable = bin_dir / name
        executable.write_text("#!/bin/sh\n" + body)
        executable.chmod(0o700)

    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env.update(
        PATH=str(bin_dir) + os.pathsep + env.get("PATH", ""),
        PGHOSTADDR="127.0.0.2",
        PGPASSWORD="incorrect-synthetic-password",
        PGSERVICE="nonexistent-synthetic-service",
        PYTHON_DOTENV_DISABLED="1",
        STAGING_ENV_FILE=str(env_file),
    )
    proc = subprocess.run(
        ["bash", str(launcher), "start"], cwd=tmp_path, env=env,
        text=True, capture_output=True, timeout=90,
    )
    assert proc.returncode == 0, proc.stderr
    generated = dotenv_values(env_file)
    assert make_url(generated["DATABASE_URL"]).password == target.password
    assert generated["PHOTO_MYSTERY_ALLOWLIST"] == generated["TEST_BARATHON_ID"]
    for secret in (target.password, generated["JWT_SECRET_KEY"], generated["TESTER_CREATOR_PASSWORD"]):
        assert secret not in proc.stdout + proc.stderr

    engine = create_engine(target, connect_args={"hostaddr": "127.0.0.1"})
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "b1c2d3e4f5a6"
            assert connection.execute(text("SELECT count(*) FROM barathon_participants")).scalar_one() >= 2
    finally:
        engine.dispose()
