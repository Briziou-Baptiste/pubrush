# --- Étape 1 : Builder ---
FROM python:3.9-slim AS builder

WORKDIR /build

# Installer les dépendances de compilation nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier le fichier des dépendances
COPY requirements.txt .

# Installer les dépendances dans le répertoire utilisateur (/root/.local)
RUN pip install --no-cache-dir --user -r requirements.txt


# --- Étape 2 : Runner ---
FROM python:3.9-slim AS runner

# Configurer les variables d'environnement Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/pubrush/.local/bin:$PATH

WORKDIR /app

# Installer libpq pour le client PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Créer un utilisateur non-root sécurisé pour exécuter l'application
RUN groupadd -g 10001 pubrush && \
    useradd -u 10000 -g pubrush -m -s /sbin/nologin pubrush

# Copier les dépendances Python depuis l'étape de construction
COPY --from=builder --chown=pubrush:pubrush /root/.local /home/pubrush/.local

# Copier le code source de l'application et les configurations nécessaires
COPY --chown=pubrush:pubrush app/ ./app
COPY --chown=pubrush:pubrush alembic/ ./alembic
COPY --chown=pubrush:pubrush alembic.ini .

# Changer de propriétaire pour le répertoire de travail
RUN chown -R pubrush:pubrush /app

# Passer à l'utilisateur non-root sécurisé
USER pubrush

# Exposer le port de FastAPI
EXPOSE 8000

# Commande par défaut pour exécuter l'application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
