from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, select
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
from app.core.lifespan import lifespan
from app.db import get_db
from app.models import Role, User, PasswordResetToken, BarathonParticipantRole, Barathon, BarathonParticipant
from app.schemas import MeResponse, RoleRead, TokenResponse, UserCreate, UserLogin, UserRead, PasswordResetRequest, PasswordResetConfirm, PasswordChangeRequest, UserUpdatePayload
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
    if payload.username != current_user.username:
        # Check uniqueness of username
        existing_user = db.scalar(
            select(User).where(User.username == payload.username)
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce nom d'utilisateur est déjà pris."
            )
        current_user.username = payload.username

    db.commit()
    return current_user


@app.delete("/me")
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Process barathons created by the user
    created_barathons = db.scalars(
        select(Barathon).where(Barathon.created_by_user_id == current_user.id)
    ).all()

    for barathon in created_barathons:
        # Find all participant links for this barathon
        participants = db.scalars(
            select(BarathonParticipant).where(BarathonParticipant.barathon_id == barathon.id)
        ).all()
        
        # Filter out current user
        other_participants = [p for p in participants if p.user_id != current_user.id]

        if not other_participants:
            # User is the only participant, delete the barathon entirely
            db.delete(barathon)
        else:
            # Reassign creator role to the first other participant
            new_creator_participant = other_participants[0]
            new_creator_user = db.get(User, new_creator_participant.user_id)
            barathon.creator = new_creator_user
            new_creator_participant.role = "creator"
            
            # Delete current user's participation links for this barathon
            current_link = db.scalar(
                select(BarathonParticipant).where(
                    BarathonParticipant.barathon_id == barathon.id,
                    BarathonParticipant.user_id == current_user.id
                )
            )
            if current_link:
                db.delete(current_link)

            # Delete current user's assigned role in BarathonParticipantRole
            current_role_entry = db.scalar(
                select(BarathonParticipantRole).where(
                    BarathonParticipantRole.barathon_id == barathon.id,
                    BarathonParticipantRole.user_id == current_user.id
                )
            )
            if current_role_entry:
                db.delete(current_role_entry)

    # 2. Process other barathons joined by the user (where they are not creator)
    joined_links = db.scalars(
        select(BarathonParticipant).where(
            BarathonParticipant.user_id == current_user.id,
            BarathonParticipant.role != "creator"
        )
    ).all()

    for link in joined_links:
        db.delete(link)
        
        role_entry = db.scalar(
            select(BarathonParticipantRole).where(
                BarathonParticipantRole.barathon_id == link.barathon_id,
                BarathonParticipantRole.user_id == current_user.id
            )
        )
        if role_entry:
            db.delete(role_entry)

    # 3. Delete the user
    db.delete(current_user)
    db.commit()

    return {"message": "Votre compte et toutes vos données associées ont été supprimés conformément au RGPD."}
