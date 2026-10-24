import time
from collections import defaultdict
from typing import Optional, Union
from fastapi import WebSocket


class WSManager:
    def __init__(self):
        self.user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.barathon_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.barathon_user_sockets: dict[int, dict[int, set[WebSocket]]] = defaultdict(lambda: defaultdict(set))
        self.socket_barathon_user: dict[WebSocket, tuple[int, int]] = {}
        self.barathon_locations: dict[int, dict[int, dict]] = defaultdict(dict)
        self.barathon_location_timestamps: dict[int, dict[int, float]] = defaultdict(dict)

    def set_user_location(self, barathon_id: int, user_id: int, location_data: dict):
        self.barathon_locations[barathon_id][user_id] = location_data
        self.barathon_location_timestamps[barathon_id][user_id] = time.time()

    def get_barathon_locations(self, barathon_id: int, max_age_seconds: float = 60.0) -> list[dict]:
        now = time.time()
        locations = self.barathon_locations.get(barathon_id, {})
        timestamps = self.barathon_location_timestamps.get(barathon_id, {})
        valid_locations = []
        expired_users = []

        for uid, loc in list(locations.items()):
            ts = timestamps.get(uid, 0.0)
            if now - ts <= max_age_seconds:
                valid_locations.append(loc)
            else:
                expired_users.append(uid)

        for uid in expired_users:
            locations.pop(uid, None)
            timestamps.pop(uid, None)

        return valid_locations

    def purge_expired_locations(self, max_age_seconds: float = 60.0) -> dict[int, list[int]]:
        """
        Proactively purges expired locations across all barathons and returns
        a mapping of barathon_id -> list of expired user_ids.
        """
        now = time.time()
        expired_by_barathon: dict[int, list[int]] = defaultdict(list)

        for barathon_id in list(self.barathon_locations.keys()):
            locations = self.barathon_locations.get(barathon_id, {})
            timestamps = self.barathon_location_timestamps.get(barathon_id, {})
            expired_users = []

            for uid in list(locations.keys()):
                ts = timestamps.get(uid, 0.0)
                if now - ts > max_age_seconds:
                    expired_users.append(uid)

            for uid in expired_users:
                locations.pop(uid, None)
                timestamps.pop(uid, None)
                expired_by_barathon[barathon_id].append(uid)

            if not locations:
                self.barathon_locations.pop(barathon_id, None)
                self.barathon_location_timestamps.pop(barathon_id, None)

        return dict(expired_by_barathon)

    def clear_user_location(self, barathon_id: int, user_id: int):
        if barathon_id in self.barathon_locations:
            self.barathon_locations[barathon_id].pop(user_id, None)
        if barathon_id in self.barathon_location_timestamps:
            self.barathon_location_timestamps[barathon_id].pop(user_id, None)

    def clear_user_all_locations(self, user_id: int):
        for barathon_id in list(self.barathon_locations.keys()):
            self.clear_user_location(barathon_id, user_id)

    def clear_barathon_locations(self, barathon_id: int):
        self.barathon_locations.pop(barathon_id, None)
        self.barathon_location_timestamps.pop(barathon_id, None)

    async def connect_user(self, user_id: int, websocket: WebSocket):
        try:
            await websocket.accept()
        except Exception:
            pass
        self.user_connections[user_id].add(websocket)

    async def connect_barathon(
        self,
        barathon_id: int,
        websocket_or_user_id: Union[WebSocket, int],
        maybe_websocket: Optional[WebSocket] = None,
    ):
        if maybe_websocket is None:
            websocket: WebSocket = websocket_or_user_id  # type: ignore
            user_id: Optional[int] = None
        else:
            user_id = int(websocket_or_user_id)  # type: ignore
            websocket = maybe_websocket

        try:
            await websocket.accept()
        except Exception:
            pass

        self.barathon_connections[barathon_id].add(websocket)
        if user_id is not None:
            self.barathon_user_sockets[barathon_id][user_id].add(websocket)
            self.socket_barathon_user[websocket] = (barathon_id, user_id)

    def disconnect_user(self, user_id: int, websocket: WebSocket):
        self.user_connections[user_id].discard(websocket)
        if not self.user_connections[user_id]:
            self.user_connections.pop(user_id, None)

    def disconnect_barathon(self, barathon_id: int, websocket: WebSocket):
        self.barathon_connections[barathon_id].discard(websocket)
        if not self.barathon_connections[barathon_id]:
            self.barathon_connections.pop(barathon_id, None)

        entry = self.socket_barathon_user.pop(websocket, None)
        if entry:
            b_id, u_id = entry
            if b_id in self.barathon_user_sockets:
                self.barathon_user_sockets[b_id][u_id].discard(websocket)
                if not self.barathon_user_sockets[b_id][u_id]:
                    self.barathon_user_sockets[b_id].pop(u_id, None)
                if not self.barathon_user_sockets[b_id]:
                    self.barathon_user_sockets.pop(b_id, None)

    async def disconnect_and_close_user(self, user_id: int, code: int = 1008, reason: str = "User deleted"):
        # 1. Purge all location data in memory
        self.clear_user_all_locations(user_id)

        # 2. Close and remove all /ws/me connections for this user
        user_ws_set = list(self.user_connections.pop(user_id, set()))
        for ws in user_ws_set:
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass

        # 3. Close and remove all barathon connections belonging to this user
        for barathon_id in list(self.barathon_user_sockets.keys()):
            barathon_user_ws_set = list(self.barathon_user_sockets[barathon_id].pop(user_id, set()))
            for ws in barathon_user_ws_set:
                self.socket_barathon_user.pop(ws, None)
                self.barathon_connections.get(barathon_id, set()).discard(ws)
                try:
                    await ws.close(code=code, reason=reason)
                except Exception:
                    pass
            if not self.barathon_user_sockets[barathon_id]:
                self.barathon_user_sockets.pop(barathon_id, None)
            if not self.barathon_connections.get(barathon_id):
                self.barathon_connections.pop(barathon_id, None)

    async def close_barathon_connections(self, barathon_id: int, code: int = 1000, reason: str = ""):
        # Purge locations
        self.clear_barathon_locations(barathon_id)

        # Close all active sockets in this barathon room
        barathon_ws_set = list(self.barathon_connections.pop(barathon_id, set()))
        self.barathon_user_sockets.pop(barathon_id, None)
        for ws in barathon_ws_set:
            self.socket_barathon_user.pop(ws, None)
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass

    async def send_to_user(self, user_id: int, payload: dict):
        dead = []
        for ws in list(self.user_connections.get(user_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_user(user_id, ws)

    async def broadcast_to_barathon(self, barathon_id: int, payload: dict):
        dead = []
        for ws in list(self.barathon_connections.get(barathon_id, set())):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_barathon(barathon_id, ws)
