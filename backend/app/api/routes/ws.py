import logging
from fastapi import APIRouter, WebSocket
from fastapi.websockets import WebSocketDisconnect
from app.websocket.auth import authenticate_websocket
from app.websocket.registry import ws_manager
from app.services.barathon_service import is_user_participant

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/me")
async def ws_me(websocket: WebSocket):
    logger.debug("[WS][ROUTE] /ws/me connection attempt")

    user = await authenticate_websocket(websocket)
    if not user:
        logger.debug("[WS][ROUTE] authentication failed")
        return

    logger.debug("[WS][ROUTE] authenticated user_id=%s", user.id)

    await ws_manager.connect_user(user.id, websocket)
    logger.debug("[WS][ROUTE] connected user_id=%s", user.id)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        logger.debug("[WS][ROUTE] disconnected user_id=%s", user.id)
        ws_manager.disconnect_user(user.id, websocket)

@router.websocket("/ws/barathons/{barathon_id}")
async def ws_barathon(websocket: WebSocket, barathon_id: int):
    user = await authenticate_websocket(websocket)
    if not user:
        return

    allowed = await is_user_participant(barathon_id=barathon_id, user_id=user.id)
    if not allowed:
        await websocket.close(code=1008)
        return

    await ws_manager.connect_barathon(barathon_id, websocket)

    # Send current snapshot of friends locations if available
    existing_locations = ws_manager.get_barathon_locations(barathon_id)
    if existing_locations:
        try:
            await websocket.send_json({
                "type": "FRIENDS_LOCATIONS_SNAPSHOT",
                "barathon_id": barathon_id,
                "payload": {
                    "locations": existing_locations,
                },
            })
        except Exception:
            pass

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "PING":
                await websocket.send_json({"type": "PONG"})
            elif msg_type == "UPDATE_LOCATION":
                lat = data.get("latitude")
                lng = data.get("longitude")
                if lat is not None and lng is not None:
                    loc_payload = {
                        "user_id": user.id,
                        "username": user.username,
                        "latitude": float(lat),
                        "longitude": float(lng),
                        "is_guest": getattr(user, "is_guest", False),
                    }
                    ws_manager.set_user_location(barathon_id, user.id, loc_payload)
                    event = {
                        "type": "FRIEND_LOCATION_UPDATE",
                        "barathon_id": barathon_id,
                        "payload": loc_payload,
                    }
                    await ws_manager.broadcast_to_barathon(barathon_id, event)
    except WebSocketDisconnect:
        ws_manager.disconnect_barathon(barathon_id, websocket)
