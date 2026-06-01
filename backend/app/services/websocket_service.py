from app.websocket.registry import ws_manager

class WebSocketService:
    async def notify_barathon_started(
        self,
        barathon_id: int,
        participant_ids: list[int],
        started_by_user_id: int,
        started_at: str,
    ) -> None:
        event = {
            "type": "BARATHON_STARTED",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": started_at,
            "payload": {
                "status": "active",
                "started_by_user_id": started_by_user_id,
            },
        }

        await ws_manager.broadcast_to_barathon(barathon_id, event)

        refresh_event = {
            "type": "BARATHON_LIST_REFRESH",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": started_at,
            "payload": {},
        }

        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, refresh_event)
            await ws_manager.send_to_user(user_id, event)
            
    async def notify_barathon_stopped(
        self,
        barathon_id: int,
        participant_ids: list[int],
        stopped_by_user_id: int,
        stopped_at: str,
    ) -> None:
        event = {
            "type": "BARATHON_STOPPED",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": stopped_at,
            "payload": {
                "status": "stopped",
                "stopped_by_user_id": stopped_by_user_id,
            },
        }

        # Pour les écrans détail connectés au canal du barathon
        await ws_manager.broadcast_to_barathon(barathon_id, event)

        refresh_event = {
            "type": "BARATHON_LIST_REFRESH",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": stopped_at,
            "payload": {},
        }

        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, refresh_event)
            await ws_manager.send_to_user(user_id, event)
websocket_service = WebSocketService()
