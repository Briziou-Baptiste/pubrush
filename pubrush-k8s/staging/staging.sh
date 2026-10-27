#!/usr/bin/env bash
# ==============================================================================
# PUBRUSH PHOTO-001 - GESTIONNAIRE DE L'ENVIRONNEMENT DE STAGING ISOLÉ
# Commandes : start | status | stop | destroy
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.staging.yml"
PROJECT_NAME="pubrush-photo-staging"
ENV_STAGING="${ROOT_DIR}/backend/.env.staging"

check_port_free() {
  local port=$1
  if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "ERREUR: Le port ${port} est déjà utilisé par un autre processus :" >&2
    lsof -i :${port} >&2
    return 1
  fi
  return 0
}

cmd_start() {
  echo "=== Démarrage du Staging PubRush Photo Mystère ==="

  # 1. Vérification des ports requis
  echo "Vérification des ports réservés (15432, 18000)..."
  check_port_free 15432 || exit 1
  check_port_free 18000 || exit 1

  # 2. Préparation du mot de passe PostgreSQL dédié (aléatoire)
  local db_pass
  if [[ -f "${ENV_STAGING}" ]]; then
    db_pass=$(grep "^DATABASE_URL=" "${ENV_STAGING}" | sed -E 's/.*:([^@]+)@.*/\1/' || true)
  fi
  if [[ -z "${db_pass:-}" ]]; then
    db_pass=$(python3 -c "import secrets; print(secrets.token_urlsafe(18))")
    # Création du fichier temporaire minimal .env.staging (0600) pour Docker Compose
    old_umask=$(umask)
    umask 077
    cat <<EOF > "${ENV_STAGING}"
# Fichier initial temporaire pour Docker Compose
APP_ENV=staging
PYTHON_DOTENV_DISABLED=1
PORT=8000
DATABASE_URL=postgresql+psycopg://photo_staging:${db_pass}@db-photo:5432/pubrush_photo_staging
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
PHOTO_MYSTERY_ENABLED=false
PHOTO_MYSTERY_ALLOWLIST=""
PHOTO_AES_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
PHOTO_STORAGE_DIR=/tmp/pubrush-photo-media-staging
PHOTO_STORAGE_MAX_BYTES=33554432
EOF
    umask "${old_umask}"
  fi

  export STAGING_DB_PASSWORD="${db_pass}"

  # 3. Démarrage de PostgreSQL uniquement
  echo "Démarrage du conteneur de base de données PostgreSQL 15 dédié (127.0.0.1:15432)..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d db-photo

  # Attente de disponibilité
  echo "Attente de l'état healthy de la base..."
  local attempts=0
  while true; do
    local health
    health=$(docker inspect --format='{{json .State.Health.Status}}' "pubrush-photo-staging-db" 2>/dev/null || echo '"unknown"')
    if [[ "${health}" == '"healthy"' ]]; then
      echo "PostgreSQL est prêt et sain."
      break
    fi
    attempts=$((attempts + 1))
    if [[ ${attempts} -ge 20 ]]; then
      echo "ERREUR: Délai dépassé pour la disponibilité de PostgreSQL." >&2
      exit 1
    fi
    sleep 1
  done

  # 4. Exécution de la migration Alembic depuis l'hôte
  echo "Exécution des migrations Alembic vers la base de staging..."
  local host_db_url="postgresql+psycopg://photo_staging:${db_pass}@127.0.0.1:15432/pubrush_photo_staging"
  (
    cd "${ROOT_DIR}/backend"
    PYTHONPATH="${ROOT_DIR}/backend" PYTHON_DOTENV_DISABLED=1 DATABASE_URL="${host_db_url}" .venv/bin/alembic upgrade head
  )

  # 5. Exécution du seed avec STAGING_DATABASE_URL (P1-2: invocation propre avec PYTHONPATH explicite)
  echo "Exécution du script de seed synthétique..."
  (
    cd "${ROOT_DIR}/backend"
    PYTHONPATH="${ROOT_DIR}/backend" PYTHON_DOTENV_DISABLED=1 STAGING_DATABASE_URL="${host_db_url}" .venv/bin/python scripts/seed_staging_photo.py
  )

  # 6. Construction et démarrage du backend
  echo "Construction et démarrage du backend FastAPI staging (127.0.0.1:18000)..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d --build backend-photo

  # 7. Contrôle du healthcheck backend
  echo "Vérification du service backend..."
  sleep 3
  local be_status
  be_status=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:18000/health" || echo "000")
  if [[ "${be_status}" == "200" ]]; then
    echo "Backend staging opérationnel sur http://127.0.0.1:18000 (status 200)."
  else
    echo "AVERTISSEMENT: Le backend a répondu avec le statut ${be_status} au /health."
  fi

  echo "=== Staging démarré avec succès ==="
  echo "Base de données : 127.0.0.1:15432 (pubrush_photo_staging)"
  echo "Backend FastAPI  : 127.0.0.1:18000 (tmpfs 64 Mio, quota photo 32 Mio)"
  echo "Configuration    : ${ENV_STAGING} (permissions 0600)"
}

cmd_status() {
  echo "=== Statut du projet ${PROJECT_NAME} ==="
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" ps
}

cmd_stop() {
  echo "=== Arrêt des conteneurs du staging ${PROJECT_NAME} ==="
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" stop
  echo "Conteneurs arrêtés (les volumes et données restent conservés)."
}

cmd_destroy() {
  echo "=== Destruction complète du staging ${PROJECT_NAME} ==="
  echo "Arrêt et suppression des conteneurs et des volumes dédiés..."
  docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" down -v --remove-orphans

  echo "Nettoyage des fichiers locaux de staging..."
  if [[ -f "${ENV_STAGING}" ]]; then
    rm -f "${ENV_STAGING}"
    echo "Fichier ${ENV_STAGING} supprimé."
  fi
  rm -rf /tmp/pubrush-photo-media-staging 2>/dev/null || true

  echo "Destruction terminée. Environnement nettoyé."
}

case "${1:-}" in
  start)
    cmd_start
    ;;
  status)
    cmd_status
    ;;
  stop)
    cmd_stop
    ;;
  destroy)
    cmd_destroy
    ;;
  *)
    echo "Usage: $0 {start|status|stop|destroy}" >&2
    exit 1
    ;;
esac
