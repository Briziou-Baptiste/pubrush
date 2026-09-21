from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI

logger = logging.getLogger(__name__)

from app.services.barathon_service import barathon_status_watcher

import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("TESTING", "").lower() == "true":
        yield
        return

    task = asyncio.create_task(barathon_status_watcher())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
