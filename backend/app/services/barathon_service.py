import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import engine
from app.models import Barathon

logger = logging.getLogger(__name__)

def fail_expired_planned_barathons():
    with Session(engine) as db:
        now = datetime.utcnow()
        grace_limit = now - timedelta(minutes=15)

        expired_barathons = db.scalars(
            select(Barathon).where(
                Barathon.status == "planned",
                Barathon.has_started == False,
                Barathon.start_datetime <= grace_limit,
            )
        ).all()

        if not expired_barathons:
            return

        for barathon in expired_barathons:
            barathon.status = "failed"
            barathon.ended_at = now

        db.commit()

        logger.info(
            "Barathons passés en failed: %s",
            [barathon.id for barathon in expired_barathons]
        )

async def barathon_status_watcher():
    while True:
        try:
            fail_expired_planned_barathons()
        except Exception as exc:
            logger.exception("Erreur dans le watcher des barathons: %s", exc)

        await asyncio.sleep(60)

async def is_user_participant(barathon_id: int, user_id: int) -> bool:
    db: Session = SessionLocal()
    try:
        participant = db.scalar(
            select(BarathonParticipant).where(
                BarathonParticipant.barathon_id == barathon_id,
                BarathonParticipant.user_id == user_id,
            )
        )
        return participant is not None
    finally:
        db.close()
