from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session, selectinload
from datetime import datetime, timedelta
import random
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

from app.api.routes.barathons import router as barathons_router
from app.api.routes.ws import router as ws_router
from app.api.routes.expenses import router as expenses_router
from app.api.routes.bars import router as bars_router
from app.api.routes.saved_barathons import router as saved_barathons_router
from app.api.routes.partner_events import router as partner_events_router
from app.core.lifespan import lifespan
from app.db import get_db
from app.models import Role, User, PasswordResetToken, BarathonParticipantRole, Barathon, BarathonParticipant, BarathonStop, PartnerEvent, MapFilter, EventTicket, PartnerEventUser, PartnerEventSpot
from app.schemas import MeResponse, RoleRead, TokenResponse, UserCreate, UserLogin, UserRead, PasswordResetRequest, PasswordResetConfirm, PasswordChangeRequest, UserUpdatePayload, UserStatsResponse, PartnerEventRead, MapFilterRead, PartnerEventSpotRead, PartnerEventSpotCreate
from app.security import create_access_token, decode_access_token, hash_password, verify_password
from app.services.email_service import send_reset_code_email

app = FastAPI(
    title="Pubrush API",
    version="0.1.0",
    lifespan=lifespan,
)

bearer_scheme = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(barathons_router)
app.include_router(ws_router)
app.include_router(expenses_router)
app.include_router(bars_router)
app.include_router(saved_barathons_router)
app.include_router(partner_events_router)

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing_email = db.scalar(
        select(User).where(func.lower(User.email) == func.lower(payload.email))
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette adresse email est déjà enregistrée."
        )

    existing_username = db.scalar(
        select(User).where(func.lower(User.username) == func.lower(payload.username))
    )
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce nom d'utilisateur est déjà pris."
        )

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


@app.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    username_clean = username.strip()
    if len(username_clean) < 3:
        return {"available": False}

    existing_username = db.scalar(
        select(User).where(func.lower(User.username) == func.lower(username_clean))
    )
    return {"available": existing_username is None}


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


def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits d'administration nécessaires."
        )
    return current_user


@app.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


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


@app.get("/roles", response_model=list[RoleRead])
def get_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    roles = db.scalars(select(Role).order_by(Role.name.asc())).all()
    return list(roles)


@app.post("/forgot-password/request")
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte n'est associé à cette adresse email."
        )

    db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.email == payload.email)
    )

    code = f"{random.randint(100000, 999999)}"

    expiration = datetime.utcnow() + timedelta(minutes=15)
    token_entry = PasswordResetToken(
        email=payload.email,
        token=code,
        expires_at=expiration
    )
    db.add(token_entry)
    db.commit()

    # Envoi du mail réel
    send_reset_code_email(payload.email, code)

    return {"message": "Un code de réinitialisation a été envoyé par email."}


@app.post("/forgot-password/reset")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    token_entry = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.email == payload.email,
            PasswordResetToken.token == payload.code
        )
    )

    if not token_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code de réinitialisation est incorrect."
        )

    if token_entry.expires_at < datetime.utcnow():
        db.delete(token_entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code de réinitialisation a expiré."
        )

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable."
        )

    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent du mot de passe actuel."
        )

    user.password_hash = hash_password(payload.new_password)
    
    db.delete(token_entry)
    db.commit()

    return {"message": "Votre mot de passe a été réinitialisé avec succès."}


@app.get("/barathons/{barathon_id}/my-role")
def get_my_role_in_barathon(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_link = db.scalar(
        select(BarathonParticipantRole)
        .options(selectinload(BarathonParticipantRole.role))
        .where(
            BarathonParticipantRole.barathon_id == barathon_id,
            BarathonParticipantRole.user_id == current_user.id,
        )
    )
    if not role_link:
        return {"role": None}
    return {"role": role_link.role.name}


@app.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'ancien mot de passe est incorrect."
        )

    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit être différent du mot de passe actuel."
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Votre mot de passe a été modifié avec succès."}


@app.put("/me", response_model=UserRead)
def update_profile(
    payload: UserUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.username.lower() != current_user.username.lower():
        # Check uniqueness of username case-insensitively
        existing_user = db.scalar(
            select(User).where(
                (func.lower(User.username) == func.lower(payload.username)) &
                (User.id != current_user.id)
            )
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce nom d'utilisateur est déjà pris."
            )
        current_user.username = payload.username
    elif payload.username != current_user.username:
        # Just a case change for the same user (e.g. "alice" -> "Alice")
        current_user.username = payload.username

    db.commit()
    return current_user


def _delete_user_data(user_to_delete: User, db: Session):
    # 1. Process barathons created by the user
    created_barathons = db.scalars(
        select(Barathon).where(Barathon.created_by_user_id == user_to_delete.id)
    ).all()

    for barathon in created_barathons:
        # Find all participant links for this barathon
        participants = db.scalars(
            select(BarathonParticipant).where(BarathonParticipant.barathon_id == barathon.id)
        ).all()
        
        # Filter out user
        other_participants = [p for p in participants if p.user_id != user_to_delete.id]

        if not other_participants:
            # User is the only participant, delete the barathon entirely
            db.delete(barathon)
        else:
            # Reassign creator role to the first other participant
            new_creator_participant = other_participants[0]
            new_creator_user = db.get(User, new_creator_participant.user_id)
            barathon.creator = new_creator_user
            new_creator_participant.role = "creator"
            
            # Delete user's participation links for this barathon
            current_link = db.scalar(
                select(BarathonParticipant).where(
                    BarathonParticipant.barathon_id == barathon.id,
                    BarathonParticipant.user_id == user_to_delete.id
                )
            )
            if current_link:
                db.delete(current_link)

            # Delete user's assigned role in BarathonParticipantRole
            current_role_entry = db.scalar(
                select(BarathonParticipantRole).where(
                    BarathonParticipantRole.barathon_id == barathon.id,
                    BarathonParticipantRole.user_id == user_to_delete.id
                )
            )
            if current_role_entry:
                db.delete(current_role_entry)

    # 2. Process other barathons joined by the user (where they are not creator)
    joined_links = db.scalars(
        select(BarathonParticipant).where(
            BarathonParticipant.user_id == user_to_delete.id,
            BarathonParticipant.role != "creator"
        )
    ).all()

    for link in joined_links:
        db.delete(link)
        
        role_entry = db.scalar(
            select(BarathonParticipantRole).where(
                BarathonParticipantRole.barathon_id == link.barathon_id,
                BarathonParticipantRole.user_id == user_to_delete.id
            )
        )
        if role_entry:
            db.delete(role_entry)

    # 3. Delete the user
    db.delete(user_to_delete)


@app.delete("/me")
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _delete_user_data(current_user, db)
    db.commit()

    return {"message": "Votre compte et toutes vos données associées ont été supprimés conformément au RGPD."}


@app.get("/me/stats", response_model=UserStatsResponse)
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Barathons created by current user
    barathons_created = db.scalar(
        select(func.count(Barathon.id)).where(Barathon.created_by_user_id == current_user.id)
    ) or 0

    # 2. Barathons completed/stopped where user participated
    barathons_completed = db.scalar(
        select(func.count(Barathon.id))
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(
            BarathonParticipant.user_id == current_user.id,
            Barathon.status.in_(["completed", "stopped"])
        )
    ) or 0

    # 3. Total completed stops (bars visited) in barathons the user participated in
    bars_visited = db.scalar(
        select(func.count(BarathonStop.id))
        .join(Barathon, Barathon.id == BarathonStop.barathon_id)
        .join(BarathonParticipant, BarathonParticipant.barathon_id == Barathon.id)
        .where(
            BarathonParticipant.user_id == current_user.id,
            BarathonStop.is_completed == True
        )
    ) or 0

    return {
        "barathons_created": barathons_created,
        "barathons_completed": barathons_completed,
        "bars_visited": bars_visited
    }


# ==========================================
# ADMIN ENDPOINTS (Secured by get_current_admin_user)
# ==========================================

@app.get("/admin/stats")
def get_global_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_barathons = db.scalar(select(func.count(Barathon.id))) or 0
    total_stops = db.scalar(select(func.count(BarathonStop.id))) or 0
    
    return {
        "total_users": total_users,
        "total_barathons": total_barathons,
        "total_stops": total_stops,
    }


@app.get("/admin/users", response_model=list[UserRead])
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    return users


@app.put("/admin/users/{user_id}/toggle-admin", response_model=UserRead)
def toggle_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas modifier votre propre rôle d'administrateur."
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    
    user.is_admin = not user.is_admin
    db.commit()
    db.refresh(user)
    return user


@app.delete("/admin/users/{user_id}")
def delete_user_by_admin(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte depuis le dashboard."
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    
    _delete_user_data(user, db)
    db.commit()
    return {"message": "Utilisateur supprimé avec succès."}


# ==========================================
# ADMIN PARTNER EVENTS & MAP FILTERS CRUD
# ==========================================

from typing import Optional
from pydantic import BaseModel, Field

class AdminPartnerEventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    is_active: bool = True
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    requires_ticket: bool = False

class AdminPartnerEventUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    requires_ticket: Optional[bool] = None

class AdminMapFilterCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(..., min_length=1, max_length=100)
    osm_query: str
    google_type: Optional[str] = None
    is_global: bool = True

class AdminMapFilterUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    icon: Optional[str] = None
    osm_query: Optional[str] = None
    google_type: Optional[str] = None
    is_global: Optional[bool] = None


@app.get("/admin/partner-events")
def admin_get_partner_events(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    events = db.scalars(
        select(PartnerEvent)
        .options(selectinload(PartnerEvent.filters))
        .order_by(PartnerEvent.id.desc())
    ).all()
    
    result = []
    for e in events:
      result.append({
          "id": e.id,
          "name": e.name,
          "code": e.code,
          "description": e.description,
          "is_active": e.is_active,
          "start_date": e.start_date.isoformat() if e.start_date else None,
          "end_date": e.end_date.isoformat() if e.end_date else None,
          "requires_ticket": e.requires_ticket,
          "created_at": e.created_at,
          "filters": [{"id": f.id, "key": f.key, "label": f.label} for f in e.filters]
      })
    return result


@app.post("/admin/partner-events")
def admin_create_partner_event(
    payload: AdminPartnerEventCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    existing = db.scalar(select(PartnerEvent).where(PartnerEvent.code == payload.code.strip()))
    if existing:
        raise HTTPException(status_code=400, detail="Un événement partenaire avec ce code existe déjà.")
    
    event = PartnerEvent(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
        start_date=payload.start_date,
        end_date=payload.end_date,
        requires_ticket=payload.requires_ticket
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.put("/admin/partner-events/{event_id}")
def admin_update_partner_event(
    event_id: int,
    payload: AdminPartnerEventUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
    
    if payload.name is not None:
        event.name = payload.name.strip()
    if payload.code is not None:
        code_clean = payload.code.strip().upper()
        if code_clean != event.code:
            existing = db.scalar(select(PartnerEvent).where(PartnerEvent.code == code_clean))
            if existing:
                raise HTTPException(status_code=400, detail="Un événement partenaire avec ce code existe déjà.")
            event.code = code_clean
    if payload.description is not None:
        event.description = payload.description.strip() if payload.description else None
    if payload.is_active is not None:
        event.is_active = payload.is_active
    if payload.start_date is not None:
        event.start_date = payload.start_date
    if payload.end_date is not None:
        event.end_date = payload.end_date
    if payload.requires_ticket is not None:
        event.requires_ticket = payload.requires_ticket
        
    db.commit()
    db.refresh(event)
    return event


@app.delete("/admin/partner-events/{event_id}")
def admin_delete_partner_event(
    event_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
    
    db.delete(event)
    db.commit()
    return {"message": "Événement partenaire supprimé avec succès."}


class AdminGenerateTicketsPayload(BaseModel):
    count: int = Field(..., ge=1, le=1000)


@app.post("/admin/partner-events/{event_id}/tickets/generate")
def admin_generate_partner_event_tickets(
    event_id: int,
    payload: AdminGenerateTicketsPayload,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
    
    import secrets
    import string
    chars = string.ascii_uppercase + string.digits
    generated_tickets = []
    
    for _ in range(payload.count):
        while True:
            code1 = "".join(secrets.choice(chars) for _ in range(4))
            code2 = "".join(secrets.choice(chars) for _ in range(4))
            code = f"PR-{code1}-{code2}"
            existing = db.scalar(select(EventTicket).where(EventTicket.ticket_code == code))
            if not existing:
                break
        
        ticket = EventTicket(event_id=event_id, ticket_code=code)
        db.add(ticket)
        generated_tickets.append(ticket)
        
    db.commit()
    return [{"id": t.id, "ticket_code": t.ticket_code, "is_used": t.is_used} for t in generated_tickets]


@app.get("/admin/partner-events/{event_id}/tickets")
def admin_list_partner_event_tickets(
    event_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
        
    tickets = db.scalars(
        select(EventTicket)
        .options(selectinload(EventTicket.used_by_user))
        .where(EventTicket.event_id == event_id)
        .order_by(EventTicket.id.desc())
    ).all()
    
    result = []
    for t in tickets:
        result.append({
            "id": t.id,
            "ticket_code": t.ticket_code,
            "is_used": t.is_used,
            "used_by_username": t.used_by_user.username if t.used_by_user else None,
            "used_at": t.used_at.isoformat() if t.used_at else None
        })
    return result


@app.get("/admin/map-filters")
def admin_get_map_filters(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    filters = db.scalars(select(MapFilter).order_by(MapFilter.id.desc())).all()
    return filters


@app.post("/admin/map-filters")
def admin_create_map_filter(
    payload: AdminMapFilterCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    existing = db.scalar(select(MapFilter).where(MapFilter.key == payload.key.strip()))
    if existing:
        raise HTTPException(status_code=400, detail="Un filtre avec cette clé existe déjà.")
    
    m_filter = MapFilter(
        key=payload.key.strip(),
        label=payload.label.strip(),
        icon=payload.icon.strip(),
        osm_query=payload.osm_query.strip(),
        google_type=payload.google_type.strip() if payload.google_type else None,
        is_global=payload.is_global
    )
    db.add(m_filter)
    db.commit()
    db.refresh(m_filter)
    return m_filter


@app.put("/admin/map-filters/{filter_id}")
def admin_update_map_filter(
    filter_id: int,
    payload: AdminMapFilterUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    m_filter = db.get(MapFilter, filter_id)
    if not m_filter:
        raise HTTPException(status_code=404, detail="Filtre introuvable.")
    
    if payload.key is not None:
        key_clean = payload.key.strip()
        if key_clean != m_filter.key:
            existing = db.scalar(select(MapFilter).where(MapFilter.key == key_clean))
            if existing:
                raise HTTPException(status_code=400, detail="Un filtre avec cette clé existe déjà.")
            m_filter.key = key_clean
    if payload.label is not None:
        m_filter.label = payload.label.strip()
    if payload.icon is not None:
        m_filter.icon = payload.icon.strip()
    if payload.osm_query is not None:
        m_filter.osm_query = payload.osm_query.strip()
    if payload.google_type is not None:
        m_filter.google_type = payload.google_type.strip() if payload.google_type else None
    if payload.is_global is not None:
        m_filter.is_global = payload.is_global
        
    db.commit()
    db.refresh(m_filter)
    return m_filter


@app.delete("/admin/map-filters/{filter_id}")
def admin_delete_map_filter(
    filter_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    m_filter = db.get(MapFilter, filter_id)
    if not m_filter:
        raise HTTPException(status_code=404, detail="Filtre introuvable.")
    
    db.delete(m_filter)
    db.commit()
    return {"message": "Filtre supprimé avec succès."}


@app.post("/admin/partner-events/{event_id}/filters/{filter_id}")
def admin_link_filter_to_event(
    event_id: int,
    filter_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.scalar(
        select(PartnerEvent)
        .options(selectinload(PartnerEvent.filters))
        .where(PartnerEvent.id == event_id)
    )
    m_filter = db.get(MapFilter, filter_id)
    
    if not event or not m_filter:
        raise HTTPException(status_code=404, detail="Événement ou filtre introuvable.")
    
    if m_filter not in event.filters:
        event.filters.append(m_filter)
        db.commit()
        db.refresh(event)
        
    return {
        "id": event.id,
        "name": event.name,
        "filters": [{"id": f.id, "key": f.key, "label": f.label} for f in event.filters]
    }


@app.delete("/admin/partner-events/{event_id}/filters/{filter_id}")
def admin_unlink_filter_from_event(
    event_id: int,
    filter_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.scalar(
        select(PartnerEvent)
        .options(selectinload(PartnerEvent.filters))
        .where(PartnerEvent.id == event_id)
    )
    m_filter = db.get(MapFilter, filter_id)
    
    if not event or not m_filter:
        raise HTTPException(status_code=404, detail="Événement ou filtre introuvable.")
    
    if m_filter in event.filters:
        event.filters.remove(m_filter)
        db.commit()
        db.refresh(event)
        
    return {
        "id": event.id,
        "name": event.name,
        "filters": [{"id": f.id, "key": f.key, "label": f.label} for f in event.filters]
    }


@app.get("/admin/partner-events/{event_id}/spots", response_model=list[PartnerEventSpotRead])
def admin_get_event_spots(
    event_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
    spots = db.scalars(
        select(PartnerEventSpot)
        .where(PartnerEventSpot.event_id == event_id)
        .order_by(PartnerEventSpot.id.desc())
    ).all()
    return list(spots)


@app.post("/admin/partner-events/{event_id}/spots", response_model=PartnerEventSpotRead)
def admin_create_event_spot(
    event_id: int,
    payload: PartnerEventSpotCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Événement partenaire introuvable.")
    
    spot = PartnerEventSpot(
        event_id=event_id,
        name=payload.name.strip(),
        spot_type=payload.spot_type.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=payload.description.strip() if payload.description else None
    )
    db.add(spot)
    db.commit()
    db.refresh(spot)
    return spot


@app.delete("/admin/partner-events/{event_id}/spots/{spot_id}")
def admin_delete_event_spot(
    event_id: int,
    spot_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    spot = db.scalar(
        select(PartnerEventSpot).where(
            PartnerEventSpot.id == spot_id,
            PartnerEventSpot.event_id == event_id
        )
    )
    if not spot:
        raise HTTPException(status_code=404, detail="Point partenaire introuvable.")
    db.delete(spot)
    db.commit()
    return {"message": "Point partenaire supprimé avec succès."}



