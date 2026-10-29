from contextlib import asynccontextmanager
import asyncio
import logging
import os
from fastapi import FastAPI

logger = logging.getLogger(__name__)

from app.services.barathon_service import barathon_status_watcher
from app.services.photo_purge import photo_purge_watcher, reconcile_photo_storage
from app.websocket.registry import ws_manager


async def location_expiry_watcher(interval_seconds: int = 15, max_age_seconds: float = 60.0):
    """
    Tâche de fond proactive : purge les positions GPS en RAM expirées (> 60s)
    et diffuse FRIEND_LOCATION_EXPIRED aux salons barathons concernés.
    """
    logger.info("Démarrage du watcher d'expiration GPS (interval=%ss, TTL=%ss)", interval_seconds, max_age_seconds)
    while True:
        try:
            expired_by_barathon = ws_manager.purge_expired_locations(max_age_seconds=max_age_seconds)
            for barathon_id, expired_user_ids in expired_by_barathon.items():
                for uid in expired_user_ids:
                    await ws_manager.broadcast_to_barathon(
                        barathon_id,
                        {
                            "type": "FRIEND_LOCATION_EXPIRED",
                            "barathon_id": barathon_id,
                            "payload": {"user_id": uid},
                        },
                    )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Erreur dans le watcher d'expiration GPS: %s", exc)

        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("TESTING", "").lower() == "true":
        yield
        return

    # Réconciliation initiale du stockage photo
    try:
        from app.db import SessionLocal
        with SessionLocal() as db:
            reconcile_photo_storage(db)
    except Exception as exc:
        logger.warning("Échec de la réconciliation initiale du stockage photo: %s", exc)

    status_task = asyncio.create_task(barathon_status_watcher())
    expiry_task = asyncio.create_task(location_expiry_watcher())
    photo_purge_task = asyncio.create_task(photo_purge_watcher())
    try:
        yield
    finally:
        status_task.cancel()
        expiry_task.cancel()
        photo_purge_task.cancel()
        for t in (status_task, expiry_task, photo_purge_task):
            try:
                await t
            except asyncio.CancelledError:
                pass
