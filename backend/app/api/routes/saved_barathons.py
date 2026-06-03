from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Barathon, SavedBarathon, SavedBarathonStop, User
from app.api.deps.auth import get_current_user
from app.api.deps.barathons import get_barathon_with_access
from app.schemas import SaveBarathonPayload, SavedBarathonRead

router = APIRouter(tags=["saved-barathons"])

@router.post("/barathons/{barathon_id}/save", response_model=SavedBarathonRead, status_code=status.HTTP_201_CREATED)
def save_past_barathon(
    payload: SaveBarathonPayload,
    barathon: Barathon = Depends(get_barathon_with_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Vérifier que le barathon est bien dans un statut passé
    if barathon.status not in ["completed", "stopped", "failed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les barathons passés (terminés, arrêtés ou échoués) peuvent être enregistrés."
        )

    # Créer le barathon enregistré
    saved = SavedBarathon(
        user_id=current_user.id,
        name=payload.name,
        travel_time_between_bars_minutes=barathon.travel_time_between_bars_minutes,
        max_time_in_bar_minutes=barathon.max_time_in_bar_minutes,
    )
    db.add(saved)
    db.flush()  # Récupérer l'ID pour les stops

    # Copier les stops
    for stop in barathon.stops:
        db.add(
            SavedBarathonStop(
                saved_barathon_id=saved.id,
                name=stop.name,
                stop_type=stop.stop_type,
                latitude=stop.latitude,
                longitude=stop.longitude,
                stop_order=stop.stop_order,
            )
        )

    db.commit()
    db.refresh(saved)

    # Recharger avec les stops ordonnés
    query = (
        select(SavedBarathon)
        .options(selectinload(SavedBarathon.stops))
        .where(SavedBarathon.id == saved.id)
    )
    return db.scalar(query)


@router.get("/saved-barathons", response_model=list[SavedBarathonRead])
def get_my_saved_barathons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(SavedBarathon)
        .options(selectinload(SavedBarathon.stops))
        .where(SavedBarathon.user_id == current_user.id)
        .order_by(SavedBarathon.created_at.desc())
    )
    return db.scalars(query).unique().all()


@router.delete("/saved-barathons/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_barathon(
    saved_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    saved = db.get(SavedBarathon, saved_id)
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barathon enregistré introuvable."
        )

    if saved.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'êtes pas propriétaire de ce barathon enregistré."
        )

    db.delete(saved)
    db.commit()
    return
