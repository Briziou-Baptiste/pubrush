from fastapi import APIRouter, WebSocket
from fastapi.websockets import WebSocketDisconnect
from app.websocket.auth import authenticate_websocket
from app.websocket.registry import ws_manager
from app.services.barathon_service import is_user_participant

router = APIRouter()

@router.websocket("/ws/me")
async def ws_me(websocket: WebSocket):
    print("[WS][ROUTE] /ws/me connection attempt")
    print("[WS][ROUTE] query params =", dict(websocket.query_params))

    user = await authenticate_websocket(websocket)
    if not user:
        print("[WS][ROUTE] authentication failed")
        return

    print(f"[WS][ROUTE] authenticated user_id={user.id}")

    await ws_manager.connect_user(user.id, websocket)
    print(f"[WS][ROUTE] connected user_id={user.id}")

    try:
        while True:
            data = await websocket.receive_json()
            print(f"[WS][ROUTE] message from user_id={user.id} -> {data}")

            if data.get("type") == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        print(f"[WS][ROUTE] disconnected user_id={user.id}")
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

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        ws_manager.disconnect_barathon(barathon_id, websocket)
