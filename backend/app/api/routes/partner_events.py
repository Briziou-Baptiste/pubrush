from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app.models import PartnerEvent, MapFilter, User
from app.api.deps.auth import get_current_user
from app.schemas import PartnerEventRead, MapFilterRead

router = APIRouter(tags=["partner-events"])

@router.get("/partner-events", response_model=list[PartnerEventRead])
def get_active_partner_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(PartnerEvent).where(PartnerEvent.is_active == True).order_by(PartnerEvent.name)
    ).all()

@router.get("/partner-events/validate", response_model=PartnerEventRead)
def validate_partner_event(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.scalar(
        select(PartnerEvent).where(
            PartnerEvent.code == code.strip(),
            PartnerEvent.is_active == True
        )
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Événement partenaire introuvable ou inactif."
        )
    return event


@router.get("/map-filters", response_model=list[MapFilterRead])
def get_map_filters(
    partner_event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch global filters
    global_filters = db.scalars(
        select(MapFilter).where(MapFilter.is_global == True)
    ).all()

    # Fetch event-specific filters if partner_event_id is provided
    event_filters = []
    if partner_event_id:
        event = db.scalar(
            select(PartnerEvent).where(
                PartnerEvent.id == partner_event_id,
                PartnerEvent.is_active == True
            )
        )
        if event:
            # SQLAlchemy relationship filters
            event_filters = event.filters

    # Combine filters and ensure no duplicates by using key
    combined = list(global_filters)
    existing_keys = {f.key for f in combined}
    for f in event_filters:
        if f.key not in existing_keys:
            combined.append(f)

    return combined
