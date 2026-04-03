from fastapi import WebSocket, status
from sqlalchemy.orm import Session
from typing import Optional
from app.db import SessionLocal
from app.models import User
from app.security import decode_access_token


async def authenticate_websocket(websocket: WebSocket) -> Optional[User]:
    token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    payload = decode_access_token(token)

    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    user_id = payload.get("sub")

    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    db: Session = SessionLocal()
    try:
        user = db.get(User, int(user_id))

        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        return user
    finally:
        db.close()
