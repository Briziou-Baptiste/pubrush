import logging
from fastapi import WebSocket, status
from sqlalchemy.orm import Session
from typing import Optional
from app.db import SessionLocal
from app.models import User
from app.security import decode_access_token

logger = logging.getLogger(__name__)


async def authenticate_websocket(websocket: WebSocket) -> Optional[User]:
    token = websocket.query_params.get("token")

    if not token:
        logger.debug("[WS][AUTH] WebSocket connection rejected: missing token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    payload = decode_access_token(token)

    if not payload:
        logger.debug("[WS][AUTH] WebSocket connection rejected: invalid or expired token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    user_id = payload.get("sub")

    if not user_id:
        logger.debug("[WS][AUTH] WebSocket connection rejected: token missing sub claim")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    db: Session = SessionLocal()
    try:
        user = db.get(User, int(user_id))

        if not user:
            logger.debug("[WS][AUTH] WebSocket connection rejected: user %s not found", user_id)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        logger.debug("[WS][AUTH] WebSocket authenticated successfully for user_id=%s", user.id)
        return user
    finally:
        db.close()

