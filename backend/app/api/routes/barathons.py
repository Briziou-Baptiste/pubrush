from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
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
)
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
)


router = APIRouter(prefix="/barathons", tags=["barathons"])


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
):
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

    now = datetime.utcnow()
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
):
    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Ce barathon n'est pas en cours.",
        )

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

    now = datetime.utcnow()
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

    roles = db.scalars(select(Role).order_by(Role.name.asc())).all()

    return {
        "barathon_id": barathon.id,
        "barathon_name": barathon.name,
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
    
    now = datetime.utcnow()
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

    now = datetime.utcnow()
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


@router.post("/{barathon_id}/stops/{stop_id}/complete")
def complete_barathon_stop(
    stop_id: int,
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
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

    if not stop.is_completed:
        stop.is_completed = True
        stop.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(stop)

    return {
        "success": True,
        "stop_id": stop.id,
        "is_completed": stop.is_completed,
        "completed_at": stop.completed_at,
    }
