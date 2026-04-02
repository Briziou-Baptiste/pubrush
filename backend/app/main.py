from fastapi import Depends, FastAPI, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import inspect, select, text, update, delete
from sqlalchemy.orm import Session, selectinload
from typing import Optional
import asyncio
import logging

from datetime import datetime, timedelta
from app.db import Base, engine, get_db
from app.models import Barathon, BarathonParticipant, BarathonStop, User, Role, BarathonParticipantRole
from app.schemas import (
    BarathonCreate,
    BarathonRead,
    MeResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
    UpdateBarathonStartDatetime,
    BarathonParticipantsUpdate,
    ActiveBarathonRead,
    ActiveBarathonStopRead,
    RoleRead,
    BarathonParticipantWithUserRead,
    BarathonParticipantRoleAssignmentInput,
    AssignBarathonRolesPayload,
    BarathonParticipantRoleRead
)
from app.security import create_access_token, decode_access_token, hash_password, verify_password

app = FastAPI(title="Pubrush API", version="0.1.0")

bearer_scheme = HTTPBearer()
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(barathon_status_watcher())


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing_email = db.scalar(select(User).where(User.email == payload.email))
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = db.scalar(select(User).where(User.username == payload.username))
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_admin=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@app.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur inconnu")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Mauvais mot de passe")

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "username": user.username,
            "is_admin": user.is_admin,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.get(User, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@app.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/barathons", response_model=BarathonRead, status_code=status.HTTP_201_CREATED)
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

    users = db.scalars(
        select(User).where(User.id.in_(participant_ids))
    ).all()

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

@app.get("/barathons/my/upcoming")
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

    result = []
    for barathon in barathons:
        result.append(
            {
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
                    if barathon.created_by_user_id == current_user.id
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
                    }
                    for stop in barathon.stops
                ],
            }
        )

    return result

@app.get("/barathons/my/past")
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

    result = []
    for barathon in barathons:
        result.append(
            {
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
                    if barathon.created_by_user_id == current_user.id
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
        )

    return result

@app.get("/barathons/{barathon_id}", response_model=BarathonRead)
def get_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Barathon)
        .options(selectinload(Barathon.stops), selectinload(Barathon.participants))
        .where(Barathon.id == barathon_id)
    )
    barathon = db.scalar(query)

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable")

    is_creator = barathon.created_by_user_id == current_user.id
    is_participant = any(link.user_id == current_user.id for link in barathon.participants)

    if not is_creator and not is_participant:
        raise HTTPException(status_code=403, detail="Accès interdit")

    return barathon

@app.delete("/barathons/{barathon_id}", status_code=status.HTTP_204_NO_CONTENT)
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

@app.patch("/barathons/{barathon_id}/start-datetime", response_model=BarathonRead)
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
    
@app.get("/users/search", response_model=list[UserRead])
def search_users(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(User)
        .where(User.username.ilike(f"{q}%"))
        .order_by(User.username.asc())
        .limit(10)
    )

    return list(db.scalars(query).all())
    
@app.post("/barathons/{barathon_id}/participants", response_model=BarathonRead)
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

    users = db.scalars(
        select(User).where(User.id.in_(missing_to_add))
    ).all()

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
    
@app.post("/barathons/{barathon_id}/start", response_model=BarathonRead)
def start_barathon(
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

    barathon.status = "started"
    barathon.has_started = True
    barathon.started_at = datetime.utcnow()
    barathon.updated_at = datetime.utcnow()

    db.commit()

    started_barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user),
        )
        .where(Barathon.id == barathon.id)
    )

    return started_barathon
    
@app.get("/barathons/my/active", response_model=Optional[ActiveBarathonRead])
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
    
@app.get("/barathons/{barathon_id}/active-view", response_model=ActiveBarathonRead)
def get_active_barathon_by_id(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    participant_user_ids = {participant.user_id for participant in barathon.participants}
    is_creator = barathon.created_by_user_id == current_user.id
    is_participant = current_user.id in participant_user_ids

    if not is_creator and not is_participant and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit.")

    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Ce barathon n'est pas en cours.",
        )

    return barathon

@app.post("/barathons/{barathon_id}/finish", response_model=BarathonRead)
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

    barathon.status = "completed"
    barathon.ended_at = datetime.utcnow()
    barathon.updated_at = datetime.utcnow()

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
    
@app.get("/roles", response_model=list[RoleRead])
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = db.scalars(
        select(Role).order_by(Role.name.asc())
    ).all()

    return list(roles)
    
@app.get("/barathons/{barathon_id}/start-config")
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
    
@app.post("/barathons/{barathon_id}/assign-roles-and-start")
def assign_roles_and_start_barathon(
    barathon_id: int,
    payload: AssignBarathonRolesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.participants),
        )
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

    roles = db.scalars(
        select(Role).where(Role.id.in_(assigned_role_ids))
    ).all()
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

    barathon.status = "started"
    barathon.has_started = True
    barathon.started_at = datetime.utcnow()
    barathon.updated_at = datetime.utcnow()

    db.commit()

    return {"success": True, "barathon_id": barathon.id}
    
@app.post("/barathons/{barathon_id}/stop")
def stop_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    barathon = db.scalar(
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants),
        )
        .where(Barathon.id == barathon_id)
    )

    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable.")

    participant_user_ids = {participant.user_id for participant in barathon.participants}
    is_creator = barathon.created_by_user_id == current_user.id
    is_participant = current_user.id in participant_user_ids

    if not is_creator and not is_participant and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit.")

    if barathon.status != "started":
        raise HTTPException(
            status_code=400,
            detail="Seuls les barathons en cours peuvent être arrêtés.",
        )

    barathon.status = "stopped"
    barathon.ended_at = datetime.utcnow()
    barathon.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(barathon)

    return {
        "id": barathon.id,
        "status": barathon.status,
        "ended_at": barathon.ended_at,
    }
    
@app.post("/barathons/{barathon_id}/stops/{stop_id}/complete")
def complete_barathon_stop(
    barathon_id: int,
    stop_id: int,
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

    participant_user_ids = {participant.user_id for participant in barathon.participants}
    is_creator = barathon.created_by_user_id == current_user.id
    is_participant = current_user.id in participant_user_ids

    if not is_creator and not is_participant and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit.")

    if barathon.status != "started":
        raise HTTPException(status_code=400, detail="Le barathon n'est pas en cours.")

    stop = db.scalar(
        select(BarathonStop).where(
            BarathonStop.id == stop_id,
            BarathonStop.barathon_id == barathon_id,
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

def fail_expired_planned_barathons():
    with Session(engine) as db:
        now = datetime.utcnow()
        grace_limit = now - timedelta(minutes=15)

        expired_barathons = db.scalars(
            select(Barathon).where(
                Barathon.status == "planned",
                Barathon.has_started == False,
                Barathon.start_datetime <= grace_limit,
            )
        ).all()

        if not expired_barathons:
            return

        for barathon in expired_barathons:
            barathon.status = "failed"
            barathon.ended_at = now

        db.commit()

        logger.info(
            "Barathons passés en failed: %s",
            [barathon.id for barathon in expired_barathons]
        )


async def barathon_status_watcher():
    while True:
        try:
            fail_expired_planned_barathons()
        except Exception as exc:
            logger.exception("Erreur dans le watcher des barathons: %s", exc)

        await asyncio.sleep(60)
