# ==============================================================================
# PUBRUSH BACKEND - DOCKERFILE FASTAPI MULTI-STAGE OPTIMISÉ
# ==============================================================================

# --- Étape 1 : Builder (Compilation et dépendances) ---
FROM python:3.11-slim AS builder

WORKDIR /build

# Dépendances de compilation et certificats racine
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Création d'un environnement virtuel isolé
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Mise à niveau de sécurité de pip et installation des dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade "pip>=26.2.2" && \
    pip install --no-cache-dir -r requirements.txt


# --- Étape 2 : Runner (Image finale minimale & durcie) ---
FROM python:3.11-slim AS runner

# Installation explicite des certificats racine à jour pour les requêtes TLS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Variables d'environnement Python pour la production
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Sécurité : Création d'un groupe et utilisateur non-root dédié (UID/GID standard)
RUN groupadd -g 10001 pubrush && \
    useradd -u 10000 -g pubrush -m -d /home/pubrush -s /sbin/nologin pubrush

# Copie exclusive du venv depuis l'étape builder (sans compilateurs)
COPY --from=builder --chown=pubrush:pubrush /opt/venv /opt/venv

# Copie du code applicatif et des fichiers de migration
COPY --chown=pubrush:pubrush alembic/ ./alembic
COPY --chown=pubrush:pubrush alembic.ini .
COPY --chown=pubrush:pubrush app/ ./app

# Utilisateur non-root actif
USER pubrush

EXPOSE 8000

# Healthcheck natif Docker (sans dépendance à curl ou wget)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

# Démarrage de FastAPI via Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
