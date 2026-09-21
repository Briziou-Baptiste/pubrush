from typing import Optional
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

    async def notify_barathon_next_step(
        self,
        barathon_id: int,
        participant_ids: list[int],
        completed_stop_id: int,
        next_stop_index: int,
        next_stop_id: Optional[int],
        advanced_by_user_id: int,
        timestamp: str,
    ) -> None:
        event = {
            "type": "BARATHON_NEXT_STEP",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": timestamp,
            "payload": {
                "completed_stop_id": completed_stop_id,
                "next_stop_index": next_stop_index,
                "next_stop_id": next_stop_id,
                "user_id": advanced_by_user_id,
            },
        }

        # Diffuser à la room du barathon (/ws/barathons/{id})
        await ws_manager.broadcast_to_barathon(barathon_id, event)

        # Diffuser également aux sockets utilisateurs (/ws/me) de chaque participant
        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, event)

    async def notify_barathon_stop_replaced(
        self,
        barathon_id: int,
        participant_ids: list[int],
        stop_id: int,
        old_name: str,
        new_name: str,
        reason: str,
        replaced_by_user_id: int,
        replaced_by_username: str,
        stops: list[dict],
        timestamp: str,
    ) -> None:
        event = {
            "type": "BARATHON_STOP_REPLACED",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": timestamp,
            "payload": {
                "stop_id": stop_id,
                "old_name": old_name,
                "new_name": new_name,
                "reason": reason,
                "user_id": replaced_by_user_id,
                "username": replaced_by_username,
                "stops": stops,
            },
        }
        await ws_manager.broadcast_to_barathon(barathon_id, event)
        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, event)

    async def notify_barathon_stop_added(
        self,
        barathon_id: int,
        participant_ids: list[int],
        added_stop: dict,
        position: str,
        added_by_user_id: int,
        added_by_username: str,
        stops: list[dict],
        timestamp: str,
    ) -> None:
        event = {
            "type": "BARATHON_STOP_ADDED",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": timestamp,
            "payload": {
                "added_stop": added_stop,
                "position": position,
                "user_id": added_by_user_id,
                "username": added_by_username,
                "stops": stops,
            },
        }
        await ws_manager.broadcast_to_barathon(barathon_id, event)
        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, event)

    async def notify_participant_joined(
        self,
        barathon_id: int,
        participant_ids: list[int],
        user_data: dict,
        participants_count: int,
        timestamp: str,
    ) -> None:
        event = {
            "type": "BARATHON_PARTICIPANT_JOINED",
            "entity": "barathon",
            "barathon_id": barathon_id,
            "timestamp": timestamp,
            "payload": {
                "user": user_data,
                "participants_count": participants_count,
            },
        }
        await ws_manager.broadcast_to_barathon(barathon_id, event)
        for user_id in participant_ids:
            await ws_manager.send_to_user(user_id, event)


websocket_service = WebSocketService()

