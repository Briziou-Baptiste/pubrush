from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.db import get_db
from app.models import Barathon, BarathonParticipant, User
from app.api.deps.auth import get_current_user

def get_barathon_with_access(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Barathon:
    query = (
        select(Barathon)
        .options(
            selectinload(Barathon.stops),
            selectinload(Barathon.participants).selectinload(BarathonParticipant.user)
        )
        .where(Barathon.id == barathon_id)
    )
    barathon = db.scalar(query)
    
    if not barathon:
        raise HTTPException(status_code=404, detail="Barathon introuvable")

    is_creator = barathon.created_by_user_id == current_user.id
    is_participant = any(link.user_id == current_user.id for link in barathon.participants)

    if not is_creator and not is_participant and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Accès interdit")

    return barathon
