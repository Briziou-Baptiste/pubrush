from collections import defaultdict
from fastapi import WebSocket

class WSManager:
    def __init__(self):
        self.user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.barathon_connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect_user(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.user_connections[user_id].add(websocket)

    async def connect_barathon(self, barathon_id: int, websocket: WebSocket):
        await websocket.accept()
        self.barathon_connections[barathon_id].add(websocket)

    def disconnect_user(self, user_id: int, websocket: WebSocket):
        self.user_connections[user_id].discard(websocket)
        if not self.user_connections[user_id]:
            self.user_connections.pop(user_id, None)

    def disconnect_barathon(self, barathon_id: int, websocket: WebSocket):
        self.barathon_connections[barathon_id].discard(websocket)
        if not self.barathon_connections[barathon_id]:
            self.barathon_connections.pop(barathon_id, None)

    async def send_to_user(self, user_id: int, payload: dict):
        dead = []
        for ws in self.user_connections.get(user_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_user(user_id, ws)

    async def broadcast_to_barathon(self, barathon_id: int, payload: dict):
        dead = []
        for ws in self.barathon_connections.get(barathon_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_barathon(barathon_id, ws)
