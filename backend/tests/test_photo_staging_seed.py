import os
import stat
import subprocess
import sys
from pathlib import Path
import pytest
from sqlalchemy.engine import make_url


def test_seed_staging_refuses_missing_staging_database_url():
    """Vérifie que seed_staging_photo.py refuse de s'exécuter si STAGING_DATABASE_URL est absent."""
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = {k: v for k, v in os.environ.items() if k not in ("STAGING_DATABASE_URL", "DATABASE_URL")}
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "CRITICAL ERROR: STAGING_DATABASE_URL est obligatoire" in proc.stderr


def test_seed_staging_refuses_wrong_database_name():
    """Vérifie que seed_staging_photo.py refuse une base autre que pubrush_photo_staging."""
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://photo_staging:secret@127.0.0.1:15432/pubrush_production"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "Cible interdite: base 'pubrush_production'" in proc.stderr


def test_seed_staging_refuses_wrong_username():
    """Vérifie que seed_staging_photo.py refuse un utilisateur autre que photo_staging."""
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://postgres:secret@127.0.0.1:15432/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "Cible interdite: utilisateur 'postgres'" in proc.stderr


def test_seed_staging_refuses_remote_host():
    """Vérifie que seed_staging_photo.py refuse un hôte distant."""
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://photo_staging:secret@api.pubrush.com:15432/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "Cible interdite: hôte 'api.pubrush.com'" in proc.stderr


def test_seed_staging_refuses_wrong_port():
    """Vérifie que seed_staging_photo.py refuse un port hôte autre que 15432."""
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://photo_staging:secret@127.0.0.1:5432/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "Cible interdite: port '5432'" in proc.stderr


def test_seed_staging_refuses_query_parameters_bypass():
    """
    P1-3 : Vérifie que seed_staging_photo.py refuse immédiatement les paramètres de query
    tels que ?host=external.invalid avant tout appel à create_engine.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://photo_staging:secret@127.0.0.1:15432/pubrush_photo_staging?host=external.invalid"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "les paramètres de query URL (?...) sont strictement interdits" in proc.stderr


def test_seed_staging_refuses_missing_port():
    """
    P1-3 : Vérifie que le port hôte local absent (None) est refusé.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://photo_staging:secret@127.0.0.1/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "port 'None'" in proc.stderr


def test_seed_staging_refuses_invalid_driver():
    """
    P1-3 : Vérifie qu'un driver non-psycopg est rejeté.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = "postgresql+asyncpg://photo_staging:secret@127.0.0.1:15432/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "driver 'postgresql+asyncpg'" in proc.stderr


def test_seed_staging_importable_without_pythonpath():
    """
    P1-2 : Vérifie que le script de seed est exécutable sans variable PYTHONPATH préexistante.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    script_path = backend_dir / "scripts" / "seed_staging_photo.py"

    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    env["PYTHON_DOTENV_DISABLED"] = "1"
    # Cible invalide pour tester jusqu'au garde-fou sans toucher de base
    env["STAGING_DATABASE_URL"] = "postgresql+psycopg://invalid_user:pass@127.0.0.1:15432/pubrush_photo_staging"

    proc = subprocess.run(
        [sys.executable, str(script_path)],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    # Doit avoir importé app sans ModuleNotFoundError
    assert "ModuleNotFoundError" not in proc.stderr
    assert "Cible interdite: utilisateur 'invalid_user'" in proc.stderr


def test_seed_staging_preserves_real_password_in_env_file(tmp_path):
    """
    P1-1 : Vérifie que le mot de passe réel est transmis à l'objet URL et écrit
    dans .env.staging sans jamais être masqué par '***', et sans apparaître dans la sortie console.
    """
    from urllib.parse import quote_plus
    backend_dir = Path(__file__).resolve().parent.parent
    temp_env_file = tmp_path / ".env.staging.test"

    raw_pass = "SecretPass123_Secure-Token"
    staging_url = f"postgresql+psycopg://photo_staging:{quote_plus(raw_pass)}@127.0.0.1:15432/pubrush_photo_staging"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["STAGING_DATABASE_URL"] = staging_url
    env["STAGING_ENV_FILE"] = str(temp_env_file)

    # Importer le module de seed et valider parsed_url et DATABASE_URL
    parsed = make_url(staging_url)
    assert parsed.password == raw_pass
    assert str(parsed) != staging_url  # str() masque le mot de passe avec ***
    assert "***" in str(parsed)
    rendered = parsed.render_as_string(hide_password=False)
    assert "***" not in rendered
    assert raw_pass in rendered
