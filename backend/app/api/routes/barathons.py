import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import (
    Barathon,
    BarathonParticipant,
    BarathonParticipantRole,
    BarathonStop,
    Role,
    User,
    BarathonExpense,
    AppUsageLog,
)
from app.security import hash_password, create_access_token
from app.services.websocket_service import websocket_service
from app.api.deps.auth import get_current_user
from app.api.deps.barathons import get_barathon_with_access
from app.schemas import (
    ActiveBarathonRead,
    AssignBarathonRolesPayload,
    BarathonCreate,
    BarathonParticipantsUpdate,
    BarathonRead,
    UpdateBarathonStartDatetime,
    MyBarathonBalanceRead,
    ReplaceBarathonStopPayload,
    AddBarathonStopPayload,
    BarathonPreviewByCode,
    JoinGuestPayload,
    JoinGuestResponse,
)


router = APIRouter(prefix="/barathons", tags=["barathons"])


def generate_unique_join_code(db: Session) -> str:
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    for _ in range(15):
        random_part = "".join(secrets.choice(alphabet) for _ in range(4))
        code = f"RUSH-{random_part}"
        exists = db.scalar(select(Barathon.id).where(Barathon.join_code == code))
        if not exists:
            return code
    return f"RUSH-{uuid.uuid4().hex[:6].upper()}"


def serialize_barathon_summary(barathon: Barathon, current_user_id: int) -> dict:
    return {
        "id": barathon.id,
        "name": barathon.name,
        "start_datetime": barathon.start_datetime,
        "end_datetime": barathon.end_datetime,
        "has_started": barathon.has_started,
        "status": barathon.status,
        "travel_time_between_bars_minutes": barathon.travel_time_between_bars_minutes,
        "max_time_in_bar_minutes": barathon.max_time_in_bar_minutes,
        "created_by_user_id": barathon.created_by_user_id,
        "started_at": barathon.started_at,
        "ended_at": barathon.ended_at,
        "current_user_role": (
            "creator"
            if barathon.created_by_user_id == current_user_id
            else "participant"
        ),
        "join_code": barathon.join_code,
        "participants_count": len(barathon.participants),
        "stops": [
            {
                "id": stop.id,
                "name": stop.name,
                "stop_type": stop.stop_type,
                "latitude": float(stop.latitude),
                "longitude": float(stop.longitude),
                "stop_order": stop.stop_order,
                "is_completed": stop.is_completed,
                "completed_at": stop.completed_at,
            }
            for stop in barathon.stops
        ],
    }


@router.post("", response_model=BarathonRead, status_code=status.HTTP_201_CREATED)
def create_barathon(
    payload: BarathonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_orders = [stop.stop_order for stop in payload.stops]
    if len(existing_orders) != len(set(existing_orders)):
        raise HTTPException(
            status_code=400,
            detail="Chaque stop doit avoir un stop_order unique dans le barathon.",
        )

    if payload.end_datetime <= payload.start_datetime:
        raise HTTPException(
            status_code=400,
            detail="La date de fin doit être strictement après la date de début.",
        )

    participant_ids = set(payload.participant_user_ids)
    participant_ids.add(current_user.id)

    users = db.scalars(select(User).where(User.id.in_(participant_ids))).all()

    found_user_ids = {user.id for user in users}
    missing_user_ids = participant_ids - found_user_ids
    if missing_user_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Utilisateurs introuvables: {sorted(missing_user_ids)}",
        )

    barathon = Barathon(
        name=payload.name,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        has_started=False,
        status="planned",
        travel_time_between_bars_minutes=payload.travel_time_between_bars_minutes,
        max_time_in_bar_minutes=payload.max_time_in_bar_minutes,
        created_by_user_id=current_user.id,
        partner_event_id=payload.partner_event_id,
        join_code=generate_unique_join_code(db),
    )

    db.add(barathon)
    db.flush()

    for user_id in participant_ids:
        role = "creator" if user_id == current_user.id else "participant"
        db.add(
            BarathonParticipant(
                barathon_id=barathon.id,
                user_id=user_id,
                role=role,
            )
        )

    for stop in payload.stops:
        db.add(
            BarathonStop(
                barathon_id=barathon.id,
                name=stop.name,
                stop_type=stop.stop_type,
                latitude=stop.latitude,
                longitude=stop.longitude,
                stop_order=stop.stop_order,
            )
        )

    db.commit()

    created_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon.id)
    )

    return created_barathon


@router.get("/my/upcoming")
def get_my_upcoming_barathons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants),
        )
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(
            BarathonParticipant.user_id == current_user.id,
            Barathon.status == "planned",
        )
        .order_by(Barathon.start_datetime.asc())
    )

    barathons = list(db.scalars(query).unique().all())

    has_new_code = False
    for b in barathons:
        if b.join_code is None:
            b.join_code = generate_unique_join_code(db)
            has_new_code = True
    if has_new_code:
        db.commit()

    return [serialize_barathon_summary(b, current_user.id) for b in barathons]


@router.get("/my/past")
def get_my_past_barathons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    past_statuses = ["completed", "stopped", "failed"]

    query = (
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants),
        )
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(
            BarathonParticipant.user_id == current_user.id,
            Barathon.status.in_(past_statuses),
        )
        .order_by(Barathon.start_datetime.desc())
    )

    barathons = list(db.scalars(query).unique().all())

    return [serialize_barathon_summary(b, current_user.id) for b in barathons]


@router.get("/my/active", response_model=Optional[ActiveBarathonRead])
def get_my_active_barathon(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(selectinload(Barathon.stops))
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(
            Barathon.status == "started",
            BarathonParticipant.user_id == current_user.id,
        )
        .order_by(Barathon.started_at.desc().nullslast(), Barathon.id.desc())
    )

    if not barathon:
        return None

    if barathon.join_code is None:
        barathon.join_code = generate_unique_join_code(db)
        db.commit()
        db.refresh(barathon)

    return barathon


@router.get("/my/balances", response_model=list[MyBarathonBalanceRead])
def get_my_barathon_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Barathon)
        .options(
            selectinload(Barathon.expenses).selectinload(BarathonExpense.beneficiaries),
        )
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(BarathonParticipant.user_id == current_user.id)
    )
    barathons = db.scalars(query).unique().all()

    balances = []
    for b in barathons:
        paid_amount = 0.0
        debt_amount = 0.0

        for exp in b.expenses:
            amount = float(exp.amount)
            if exp.payer_user_id == current_user.id:
                paid_amount += amount

            beneficiaries = [ben.user_id for ben in exp.beneficiaries]
            if current_user.id in beneficiaries:
                num_beneficiaries = len(beneficiaries)
                if num_beneficiaries > 0:
                    debt_amount += amount / num_beneficiaries

        net_balance = round(paid_amount - debt_amount, 2)
        if net_balance != 0:
            balances.append({
                "barathon_id": b.id,
                "barathon_name": b.name,
                "balance": net_balance,
                "status": b.status,
            })

    # Sort by barathon_id descending (most recent first)
    balances.sort(key=lambda x: x["barathon_id"], reverse=True)
    return balances


@router.get("/{barathon_id}", response_model=BarathonRead)
def get_barathon(
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
):
    if barathon.join_code is None:
        barathon.join_code = generate_unique_join_code(db)
        db.commit()
        db.refresh(barathon)
    return barathon


@router.delete("/{barathon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.get(Barathon, barathon_id)

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable")

    if barathon.created_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le créateur peut supprimer ce barathon")

    db.delete(barathon)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{barathon_id}/start-datetime", response_model=BarathonRead)
def update_barathon_start_datetime(
    barathon_id: int,
    payload: UpdateBarathonStartDatetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.get(Barathon, barathon_id)

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable")

    if barathon.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Seul le créateur peut modifier l'heure de ce barathon",
        )

    if barathon.status != "planned":
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons planifiés peuvent être modifiés",
        )

    barathon.start_datetime = payload.start_datetime
    db.commit()
    db.refresh(barathon)

    return barathon


@router.post("/{barathon_id}/participants", response_model=BarathonRead)
def add_participants_to_barathon(
    barathon_id: int,
    payload: BarathonParticipantsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
            selectinload(Barathon.stops),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    if barathon.created_by_user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit.")

    existing_user_ids = {participant.user_id for participant in barathon.participants}
    requested_user_ids = set(payload.participant_user_ids)
    missing_to_add = requested_user_ids - existing_user_ids

    if not missing_to_add:
        return barathon

    users = db.scalars(select(User).where(User.id.in_(missing_to_add))).all()

    found_ids = {user.id for user in users}
    if found_ids != missing_to_add:
        raise HTTPException(status_code=400, detail="Certains utilisateurs sont introuvables.")

    for user_id in missing_to_add:
        db.add(
            BarathonParticipant(
                barathon_id=barathon.id,
                user_id=user_id,
                role="participant",
            )
        )

    db.commit()

    updated_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
            selectinload(Barathon.stops),
        )
        .where(Barathon.id == barathon.id)
    )

    return updated_barathon


@router.delete("/{barathon_id}/participants/{user_id}", response_model=BarathonRead)
def remove_participant_from_barathon(
    barathon_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
            selectinload(Barathon.stops),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    if barathon.created_by_user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit.")

    if user_id == barathon.created_by_user_id:
        raise HTTPException(
            status_code=400, detail="Impossible de retirer le créateur du barathon."
        )

    participant = db.scalar(
        select(BarathonParticipant).where(
            BarathonParticipant.barathon_id == barathon_id,
            BarathonParticipant.user_id == user_id,
        )
    )

    if not participant:
        raise HTTPException(
            status_code=404, detail="Participant non trouvé dans ce barathon."
        )

    db.execute(
        delete(BarathonParticipantRole).where(
            BarathonParticipantRole.barathon_id == barathon_id,
            BarathonParticipantRole.user_id == user_id,
        )
    )

    db.delete(participant)
    db.commit()

    updated_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
            selectinload(Barathon.stops),
        )
        .where(Barathon.id == barathon_id)
    )

    return updated_barathon


@router.post("/{barathon_id}/start", response_model=BarathonRead)
async def start_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    is_creator = barathon.created_by_user_id == current_user.id
    if not is_creator and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Seul le créateur peut démarrer le barathon.")

    if barathon.status != "planned":
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons en statut planned peuvent être démarrés.",
        )

    now = utc_now()
    barathon.status = "started"
    barathon.has_started = True
    barathon.started_at = now
    barathon.updated_at = now

    db.commit()

    started_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon.id)
    )
    
    if not started_barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable après démarrage.")

    participant_ids = [participant.user_id for participant in started_barathon.participants]

    await websocket_service.notify_barathon_started(
        barathon_id=started_barathon.id,
        participant_ids=participant_ids,
        started_by_user_id=current_user.id,
        started_at=started_barathon.started_at.isoformat() if started_barathon.started_at else now.isoformat(),
    )
    return started_barathon


@router.get("/{barathon_id}/active-view", response_model=ActiveBarathonRead)
def get_active_barathon_by_id(
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
):
    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Ce barathon n'est pas en cours.",
        )

    if barathon.join_code is None:
        barathon.join_code = generate_unique_join_code(db)
        db.commit()
        db.refresh(barathon)

    return barathon


@router.post("/{barathon_id}/finish", response_model=BarathonRead)
def finish_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    is_creator = barathon.created_by_user_id == current_user.id
    if not is_creator and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Seul le créateur peut terminer le barathon.")

    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons started peuvent être terminés.",
        )

    now = utc_now()
    barathon.status = "completed"
    barathon.ended_at = now
    barathon.updated_at = now

    db.commit()

    finished_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon.id)
    )

    return finished_barathon


@router.get("/{barathon_id}/start-config")
def get_barathon_start_config(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    is_creator = barathon.created_by_user_id == current_user.id
    if not is_creator and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Seul le créateur peut lancer le barathon.")

    if barathon.join_code is None:
        barathon.join_code = generate_unique_join_code(db)
        db.commit()
        db.refresh(barathon)

    roles = db.scalars(select(Role).order_by(Role.name.asc())).all()

    return {
        "barathon_id": barathon.id,
        "barathon_name": barathon.name,
        "join_code": barathon.join_code,
        "participants": [
            {
                "user_id": participant.user.id,
                "username": participant.user.username,
                "email": participant.user.email,
            }
            for participant in barathon.participants
        ],
        "roles": [
            {
                "id": role.id,
                "name": role.name,
                "description": role.description,
            }
            for role in roles
        ],
    }


@router.post("/{barathon_id}/assign-roles-and-start")
async def assign_roles_and_start_barathon(
    barathon_id: int,
    payload: AssignBarathonRolesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(selectinload(Barathon.participants))
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    is_creator = barathon.created_by_user_id == current_user.id
    if not is_creator and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Seul le créateur peut lancer le barathon.")

    if barathon.status != "planned":
        raise HTTPException(status_code=400, detail="Le barathon doit être en statut planned.")

    participant_user_ids = {participant.user_id for participant in barathon.participants}
    participant_count = len(participant_user_ids)

    if len(payload.assignments) != participant_count:
        raise HTTPException(
            status_code=400,
            detail=f"Il faut attribuer exactement {participant_count} rôles.",
        )

    assigned_user_ids = [assignment.user_id for assignment in payload.assignments]
    assigned_role_ids = [assignment.role_id for assignment in payload.assignments]

    if len(set(assigned_user_ids)) != len(assigned_user_ids):
        raise HTTPException(status_code=400, detail="Un utilisateur ne peut avoir qu'un seul rôle.")

    if len(set(assigned_role_ids)) != len(assigned_role_ids):
        raise HTTPException(status_code=400, detail="Un rôle ne peut être attribué qu'une seule fois.")

    if set(assigned_user_ids) != participant_user_ids:
        raise HTTPException(
            status_code=400,
            detail="Tous les participants du barathon doivent recevoir un rôle, et seulement eux.",
        )

    roles = db.scalars(select(Role).where(Role.id.in_(assigned_role_ids))).all()
    found_role_ids = {role.id for role in roles}

    if found_role_ids != set(assigned_role_ids):
        raise HTTPException(status_code=400, detail="Un ou plusieurs rôles sont introuvables.")

    db.execute(
        delete(BarathonParticipantRole).where(BarathonParticipantRole.barathon_id == barathon.id)
    )

    for assignment in payload.assignments:
        db.add(
            BarathonParticipantRole(
                barathon_id=barathon.id,
                user_id=assignment.user_id,
                role_id=assignment.role_id,
            )
        )
    
    now = utc_now()
    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable après démarrage.")

    barathon.status = "started"
    barathon.has_started = True
    barathon.started_at = now
    barathon.updated_at = now

    db.commit()

    await websocket_service.notify_barathon_started(
        barathon_id=barathon.id,
        participant_ids=participant_user_ids,
        started_by_user_id=current_user.id,
        started_at=barathon.started_at.isoformat() if barathon.started_at else now.isoformat(),
    )

    return {"success": True, "barathon_id": barathon.id}


@router.post("/{barathon_id}/stop")
async def stop_barathon(
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
):
    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons en cours peuvent être arrêtés.",
        )

    now = utc_now()
    barathon.status = "stopped"
    barathon.ended_at = now
    barathon.updated_at = now

    db.commit()
    db.refresh(barathon)
    
    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable après arrêt.")

    participant_user_ids = {participant.user_id for participant in barathon.participants}

    await websocket_service.notify_barathon_stopped(
        barathon_id=barathon.id,
        participant_ids=participant_user_ids,
        stopped_by_user_id=current_user.id,
        stopped_at=barathon.ended_at.isoformat() if barathon.ended_at else now.isoformat(),
    )

    return {
        "id": barathon.id,
        "status": barathon.status,
        "ended_at": barathon.ended_at,
    }


@router.get("/{barathon_id}/roles")
def get_barathon_roles(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_with_access),
):
    assigned_roles = db.scalars(
        select(BarathonParticipantRole)
        .options(
            selectinload(BarathonParticipantRole.user),
            selectinload(BarathonParticipantRole.role),
        )
        .where(BarathonParticipantRole.barathon_id == barathon.id)
    ).all()

    return [
        {
            "user_id": ar.user.id,
            "username": ar.user.username,
            "role_id": ar.role.id,
            "role_name": ar.role.name,
            "role_description": ar.role.description,
        }
        for ar in assigned_roles
    ]


@router.post("/{barathon_id}/stops/{stop_id}/complete")
async def complete_barathon_stop(
    stop_id: int,
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if barathon.status != "started":
        raise HTTPException(status_code=400, detail="Le barathon n'est pas en cours.")

    stop = db.scalar(
        select(BarathonStop).where(
            BarathonStop.id == stop_id,
            BarathonStop.barathon_id == barathon.id,
        )
    )

    if not stop:
        raise HTTPException(status_code=404, detail="Étape introuvable.")

    now = utc_now()
    if not stop.is_completed:
        stop.is_completed = True
        stop.completed_at = now
        db.commit()
        db.refresh(stop)

    stops_sorted = sorted(barathon.stops, key=lambda s: s.stop_order)
    current_index = next((idx for idx, s in enumerate(stops_sorted) if s.id == stop.id), 0)
    next_index = current_index + 1
    next_stop = stops_sorted[next_index] if next_index < len(stops_sorted) else None

    participant_ids = [p.user_id for p in barathon.participants]
    await websocket_service.notify_barathon_next_step(
        barathon_id=barathon.id,
        participant_ids=participant_ids,
        completed_stop_id=stop.id,
        next_stop_index=next_index,
        next_stop_id=next_stop.id if next_stop else None,
        advanced_by_user_id=current_user.id,
        timestamp=now.isoformat(),
    )

    return {
        "success": True,
        "stop_id": stop.id,
        "is_completed": stop.is_completed,
        "completed_at": stop.completed_at,
        "next_stop_index": next_index,
        "next_stop_id": next_stop.id if next_stop else None,
    }


@router.post("/{barathon_id}/next-step")
async def advance_barathon_next_step(
    barathon_id: int,
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if barathon.status != "started":
        raise HTTPException(status_code=400, detail="Le barathon n'est pas en cours.")

    stops_sorted = sorted(barathon.stops, key=lambda s: s.stop_order)
    current_stop = next((s for s in stops_sorted if not s.is_completed), None)
    if not current_stop and stops_sorted:
        current_stop = stops_sorted[-1]

    now = utc_now()
    completed_stop_id = None
    if current_stop:
        completed_stop_id = current_stop.id
        if not current_stop.is_completed:
            current_stop.is_completed = True
            current_stop.completed_at = now
            db.commit()
            db.refresh(current_stop)

    current_index = (
        next((idx for idx, s in enumerate(stops_sorted) if s.id == completed_stop_id), 0)
        if completed_stop_id
        else 0
    )
    next_index = current_index + 1
    next_stop = stops_sorted[next_index] if next_index < len(stops_sorted) else None

    participant_ids = [p.user_id for p in barathon.participants]
    await websocket_service.notify_barathon_next_step(
        barathon_id=barathon.id,
        participant_ids=participant_ids,
        completed_stop_id=completed_stop_id or 0,
        next_stop_index=next_index,
        next_stop_id=next_stop.id if next_stop else None,
        advanced_by_user_id=current_user.id,
        timestamp=now.isoformat(),
    )

    return {
        "success": True,
        "completed_stop_id": completed_stop_id,
        "next_stop_index": next_index,
        "next_stop_id": next_stop.id if next_stop else None,
    }


def check_is_maitre_du_trajet(barathon: Barathon, current_user: User, db: Session) -> bool:
    if barathon.created_by_user_id == current_user.id:
        return True
    has_role = db.scalar(
        select(BarathonParticipantRole)
        .join(Role)
        .where(
            BarathonParticipantRole.barathon_id == barathon.id,
            BarathonParticipantRole.user_id == current_user.id,
            func.lower(Role.name).in_(["maître du trajet", "maitre du trajet", "capitaine"]),
        )
    )
    return has_role is not None


@router.post("/{barathon_id}/stops/{stop_id}/replace", response_model=ActiveBarathonRead)
async def replace_barathon_stop(
    barathon_id: int,
    stop_id: int,
    payload: ReplaceBarathonStopPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon_id)
    )
    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    if barathon.status not in ("started", "planned"):
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons en cours ou planifiés peuvent avoir leurs étapes modifiées.",
        )

    if not check_is_maitre_du_trajet(barathon, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le créateur du barathon (Maître du trajet) peut modifier les étapes.",
        )

    stop = next((s for s in barathon.stops if s.id == stop_id), None)
    if not stop:
        raise HTTPException(status_code=404, detail="Étape introuvable dans ce barathon.")

    if stop.is_completed:
        raise HTTPException(
            status_code=400,
            detail="Impossible de remplacer une étape déjà terminée.",
        )

    old_name = stop.name
    stop.name = payload.name
    stop.latitude = payload.latitude
    stop.longitude = payload.longitude
    stop.stop_type = payload.stop_type
    stop.updated_at = utc_now()

    log = AppUsageLog(
        user_id=current_user.id,
        action=f"replace_stop:{payload.reason}",
    )
    db.add(log)
    db.commit()
    db.refresh(barathon)

    stops_sorted = sorted(barathon.stops, key=lambda x: x.stop_order)
    stops_data = [
        {
            "id": s.id,
            "barathon_id": s.barathon_id,
            "name": s.name,
            "stop_type": s.stop_type,
            "latitude": float(s.latitude),
            "longitude": float(s.longitude),
            "stop_order": s.stop_order,
            "is_completed": s.is_completed,
            "entered_at": s.entered_at.isoformat() if s.entered_at else None,
            "left_at": s.left_at.isoformat() if s.left_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in stops_sorted
    ]

    participant_ids = [p.user_id for p in barathon.participants]
    now_iso = utc_now().isoformat()

    await websocket_service.notify_barathon_stop_replaced(
        barathon_id=barathon.id,
        participant_ids=participant_ids,
        stop_id=stop.id,
        old_name=old_name,
        new_name=stop.name,
        reason=payload.reason,
        replaced_by_user_id=current_user.id,
        replaced_by_username=current_user.username,
        stops=stops_data,
        timestamp=now_iso,
    )

    return barathon


@router.post("/{barathon_id}/stops/add", response_model=ActiveBarathonRead, status_code=status.HTTP_201_CREATED)
async def add_barathon_stop(
    barathon_id: int,
    payload: AddBarathonStopPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon_id)
    )
    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    if barathon.status not in ("started", "planned"):
        raise HTTPException(
            status_code=400,
            detail="Impossible d'ajouter une étape à un barathon terminé ou arrêté.",
        )

    if not check_is_maitre_du_trajet(barathon, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul le créateur du barathon (Maître du trajet) peut ajouter des étapes.",
        )

    existing_stops = sorted(barathon.stops, key=lambda s: s.stop_order)

    # Determine target stop_order based on requested position
    if payload.position in ("before_current", "after_current") and payload.current_stop_id:
        target_ref = next((s for s in existing_stops if s.id == payload.current_stop_id), None)
        if target_ref:
            if payload.position == "before_current":
                target_order = target_ref.stop_order
            else:
                target_order = target_ref.stop_order + 1
        else:
            target_order = (max([s.stop_order for s in existing_stops] or [0])) + 1
    else:
        # at_end
        target_order = (max([s.stop_order for s in existing_stops] or [0])) + 1

    # Shift existing stops if inserting in the middle to prevent UniqueConstraint collision
    stops_to_shift = sorted(
        [s for s in existing_stops if s.stop_order >= target_order],
        key=lambda s: s.stop_order,
    )
    if stops_to_shift:
        max_order = max(s.stop_order for s in existing_stops)
        # Step 1: Temporarily shift out of range with positive numbers to satisfy chk_barathon_stops_order
        for idx, s in enumerate(stops_to_shift):
            s.stop_order = max_order + 1000 + idx
        db.flush()

        # Step 2: Assign new shifted positive orders
        for idx, s in enumerate(stops_to_shift):
            s.stop_order = target_order + 1 + idx
        db.flush()

    new_stop = BarathonStop(
        barathon_id=barathon.id,
        name=payload.name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        stop_type=payload.stop_type,
        stop_order=target_order,
        is_completed=False,
    )
    db.add(new_stop)

    log = AppUsageLog(
        user_id=current_user.id,
        action=f"add_stop:{payload.position}",
    )
    db.add(log)
    db.commit()
    db.refresh(barathon)

    stops_sorted = sorted(barathon.stops, key=lambda x: x.stop_order)
    stops_data = [
        {
            "id": s.id,
            "barathon_id": s.barathon_id,
            "name": s.name,
            "stop_type": s.stop_type,
            "latitude": float(s.latitude),
            "longitude": float(s.longitude),
            "stop_order": s.stop_order,
            "is_completed": s.is_completed,
            "entered_at": s.entered_at.isoformat() if s.entered_at else None,
            "left_at": s.left_at.isoformat() if s.left_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in stops_sorted
    ]

    participant_ids = [p.user_id for p in barathon.participants]
    now_iso = utc_now().isoformat()

    added_stop_dict = {
        "id": new_stop.id,
        "name": new_stop.name,
        "latitude": float(new_stop.latitude),
        "longitude": float(new_stop.longitude),
        "stop_type": new_stop.stop_type,
        "stop_order": new_stop.stop_order,
    }

    await websocket_service.notify_barathon_stop_added(
        barathon_id=barathon.id,
        participant_ids=participant_ids,
        added_stop=added_stop_dict,
        position=payload.position,
        added_by_user_id=current_user.id,
        added_by_username=current_user.username,
        stops=stops_data,
        timestamp=now_iso,
    )

    return barathon


@router.get("/by-code/{code}", response_model=BarathonPreviewByCode)
def get_barathon_preview_by_code(code: str, db: Session = Depends(get_db)):
    clean_code = code.strip().upper()
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.creator),
            selectinload(Barathon.stops),
            selectinload(Barathon.participants),
        )
        .where(func.upper(Barathon.join_code) == clean_code)
    )
    if not barathon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barathon introuvable avec ce code d'invitation.",
        )

    return BarathonPreviewByCode(
        id=barathon.id,
        name=barathon.name,
        join_code=barathon.join_code or clean_code,
        status=barathon.status,
        start_datetime=barathon.start_datetime,
        creator_username=barathon.creator.username if barathon.creator else "Organisateur",
        stops_count=len(barathon.stops),
        participants_count=len(barathon.participants),
    )


@router.post("/join-guest", response_model=JoinGuestResponse, status_code=status.HTTP_201_CREATED)
async def join_barathon_as_guest(
    payload: JoinGuestPayload,
    db: Session = Depends(get_db),
):
    clean_code = payload.join_code.strip().upper()
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
            selectinload(Barathon.creator),
        )
        .where(func.upper(Barathon.join_code) == clean_code)
    )
    if not barathon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code de barathon invalide ou inexistant.",
        )

    if barathon.status in ("completed", "stopped", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de rejoindre un barathon terminé ou annulé.",
        )

    clean_username = payload.username.strip()
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le pseudo ne peut pas être vide.",
        )

    # Vérifier si l'utilisateur existe déjà dans ce barathon avec ce pseudo
    existing_participant = next(
        (p for p in barathon.participants if p.user and p.user.username.lower() == clean_username.lower()),
        None,
    )

    if existing_participant and existing_participant.user and existing_participant.user.is_guest:
        # Re-connexion transparente de l'invité existant
        guest_user = existing_participant.user
    else:
        # Si le nom est déjà pris dans l'application par un autre utilisateur, ajouter un suffixe court
        final_username = clean_username
        user_with_name = db.scalar(select(User).where(func.lower(User.username) == clean_username.lower()))
        if user_with_name:
            final_username = f"{clean_username}_{secrets.randbelow(900) + 100}"

        guest_email = f"guest_{uuid.uuid4().hex[:12]}@guest.pubrush.internal"
        guest_user = User(
            email=guest_email,
            username=final_username,
            password_hash=hash_password(secrets.token_urlsafe(16)),
            is_admin=False,
            is_guest=True,
        )
        db.add(guest_user)
        db.flush()

        participant = BarathonParticipant(
            barathon_id=barathon.id,
            user_id=guest_user.id,
            role="participant",
        )
        db.add(participant)

        log = AppUsageLog(user_id=guest_user.id, action=f"guest_join:{barathon.id}")
        db.add(log)
        db.commit()
        db.refresh(barathon)

        # Diffuser la notification WebSocket à la room
        participant_ids = [p.user_id for p in barathon.participants if p.user_id != guest_user.id]
        await websocket_service.notify_participant_joined(
            barathon_id=barathon.id,
            participant_ids=participant_ids,
            user_data={
                "id": guest_user.id,
                "username": guest_user.username,
                "is_guest": True,
            },
            participants_count=len(barathon.participants),
            timestamp=utc_now().isoformat(),
        )

    access_token = create_access_token(
        {
            "sub": str(guest_user.id),
            "email": guest_user.email,
            "username": guest_user.username,
            "is_admin": guest_user.is_admin,
            "is_guest": True,
        }
    )

    return JoinGuestResponse(
        access_token=access_token,
        token_type="bearer",
        user=guest_user,
        barathon=barathon,
    )


