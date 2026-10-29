import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Set

from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.services.photo_storage import get_storage_dir, delete_file

logger = logging.getLogger(__name__)

# Rétention maximale des fichiers temporaires non finalisés : 15 minutes
DEFAULT_MAX_TEMP_AGE_SECONDS = 15 * 60


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def cleanup_orphaned_files(
    known_storage_keys: Set[uuid.UUID],
    max_temp_age_seconds: int = DEFAULT_MAX_TEMP_AGE_SECONDS,
) -> int:
    """
    Parcourt PHOTO_STORAGE_DIR et supprime :
    1. Tout fichier `.enc` dont la clé n'est pas répertoriée dans known_storage_keys.
    2. Tout fichier temporaire (.tmp_* ou tmp_*) plus vieux que max_temp_age_seconds.
    3. Tout fichier malformé ou résiduel non autorisé.

    Returns:
        Nombre total de fichiers supprimés.
    """
    storage_dir = get_storage_dir()
    if not os.path.isdir(storage_dir):
        return 0

    known_uuids = set()
    for k in known_storage_keys:
        if isinstance(k, str):
            try:
                known_uuids.add(uuid.UUID(k))
            except ValueError:
                pass
        elif isinstance(k, uuid.UUID):
            known_uuids.add(k)

    deleted_count = 0
    now = time.time()
    cutoff_temp_time = now - max_temp_age_seconds

    for filename in os.listdir(storage_dir):
        file_path = os.path.join(storage_dir, filename)
        if not os.path.isfile(file_path):
            continue

        try:
            mtime = os.path.getmtime(file_path)
        except OSError:
            continue

        # Cas 1 : Fichiers temporaires d'écriture en cours ou abandonnés
        if filename.startswith((".tmp_", "tmp_")):
            if mtime < cutoff_temp_time:
                try:
                    os.unlink(file_path)
                    deleted_count += 1
                except OSError:
                    pass
            continue

        # Cas 2 : Fichiers chiffrés .enc
        if filename.endswith(".enc"):
            key_str = filename[:-4]
            try:
                file_uuid = uuid.UUID(key_str)
                if file_uuid not in known_uuids:
                    os.unlink(file_path)
                    deleted_count += 1
            except ValueError:
                try:
                    os.unlink(file_path)
                    deleted_count += 1
                except OSError:
                    pass
            continue

    return deleted_count


def purge_media_file(storage_key: uuid.UUID) -> bool:
    """
    Supprime immédiatement et physiquement le fichier média chiffré correspondant.
    """
    return delete_file(storage_key)


def purge_expired_photos(db: Session) -> int:
    """
    Scanne les défis et médias pour purger les fichiers expirés et réconcilier les états.
    1. Marque delete_pending les médias des défis expirés, annulés ou fermés depuis > 15 min.
    2. Supprime physiquement les fichiers de tous les médias delete_pending.
    3. Marque les médias comme deleted en base.
    4. Supprime les fichiers orphelins non connus en base.
    """
    from app.photo_models import PhotoChallenge, PhotoMedia

    now = utc_now()
    purged_count = 0

    # 1. Identifier les défis expirés (draft_expires_at dépassé ou closed depuis > 15m)
    expired_drafts = db.scalars(
        select(PhotoChallenge).where(
            PhotoChallenge.state == "draft",
            PhotoChallenge.draft_expires_at <= now,
        )
    ).all()
    for ch in expired_drafts:
        ch.state = "expired"
        ch.terminal_at = now
        ch.terminal_reason = "draft_timeout"

    # Défis fermés depuis plus de 15 minutes
    cutoff_closed = now - timedelta(minutes=15)
    expired_closed = db.scalars(
        select(PhotoChallenge).where(
            PhotoChallenge.state == "closed",
            PhotoChallenge.terminal_at <= cutoff_closed,
        )
    ).all()

    terminal_ids = [ch.id for ch in expired_drafts] + [ch.id for ch in expired_closed]

    # Médias associés aux défis expirés, ou dont la date de purge est passée
    media_to_delete = db.scalars(
        select(PhotoMedia).where(
            or_(
                PhotoMedia.state == "delete_pending",
                PhotoMedia.purge_due_at <= now,
                PhotoMedia.challenge_id.in_(terminal_ids) if terminal_ids else False,
                PhotoMedia.challenge_id.is_(None),
            ),
            PhotoMedia.state != "deleted",
        )
    ).all()

    for m in media_to_delete:
        m.state = "delete_pending"
        m.delete_requested_at = m.delete_requested_at or now

        # Tentative d'effacement physique
        try:
            purge_media_file(m.storage_key)
            m.state = "deleted"
            m.deleted_at = now
            purged_count += 1
        except Exception as exc:
            m.attempt_count += 1
            m.next_attempt_at = now + timedelta(seconds=30)
            logger.warning("Échec purge média %s (tentative %d): %s", m.id, m.attempt_count, exc)

    db.commit()

    # Nettoyage des orphelins sur disque
    active_keys = set(
        db.scalars(
            select(PhotoMedia.storage_key).where(
                PhotoMedia.state.in_(["staged", "ready"])
            )
        ).all()
    )
    purged_count += cleanup_orphaned_files(active_keys)

    return purged_count


def reconcile_photo_storage(db: Session) -> int:
    """Réconciliation initiale appelée au démarrage du conteneur/pod."""
    logger.info("Démarrage de la réconciliation du stockage photo éphémère...")
    return purge_expired_photos(db)


async def photo_purge_watcher(interval_seconds: int = 30):
    """Tâche de fond asynchrone périodique exécutant la purge des photos."""
    from app.db import SessionLocal

    logger.info("Démarrage du watcher de purge photo (interval=%ds)", interval_seconds)
    while True:
        try:
            with SessionLocal() as db:
                purged = purge_expired_photos(db)
                if purged > 0:
                    logger.info("Watcher purge photo: %d médias/fichiers purgés.", purged)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Erreur dans le watcher de purge photo: %s", exc)

        await asyncio.sleep(interval_seconds)
