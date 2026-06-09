from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.db import get_db
from app.models import PartnerEvent, MapFilter, User, EventTicket
from app.api.deps.auth import get_current_user
from app.schemas import PartnerEventRead, MapFilterRead

router = APIRouter(tags=["partner-events"])

@router.get("/partner-events", response_model=list[PartnerEventRead])
def get_active_partner_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = db.scalars(
        select(PartnerEvent).where(PartnerEvent.is_active == True).order_by(PartnerEvent.name)
    ).all()
    
    redeemed_event_ids = set(
        db.scalars(
            select(EventTicket.event_id)
            .where(EventTicket.used_by_user_id == current_user.id, EventTicket.is_used == True)
        ).all()
    )
    
    result = []
    for e in events:
        is_unlocked = not e.requires_ticket or (e.id in redeemed_event_ids)
        result.append({
            "id": e.id,
            "name": e.name,
            "code": e.code,
            "description": e.description,
            "is_active": e.is_active,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "requires_ticket": e.requires_ticket,
            "is_unlocked": is_unlocked
        })
    return result


class RedeemTicketPayload(BaseModel):
    ticket_code: str = Field(..., min_length=1)


@router.post("/partner-events/redeem-ticket", response_model=PartnerEventRead)
def redeem_partner_event_ticket(
    payload: RedeemTicketPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.scalar(
        select(EventTicket)
        .options(selectinload(EventTicket.event))
        .where(EventTicket.ticket_code == payload.ticket_code.strip())
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code de ticket invalide."
        )
    
    if ticket.is_used:
        if ticket.used_by_user_id == current_user.id:
            event = ticket.event
            return {
                "id": event.id,
                "name": event.name,
                "code": event.code,
                "description": event.description,
                "is_active": event.is_active,
                "start_date": event.start_date,
                "end_date": event.end_date,
                "requires_ticket": event.requires_ticket,
                "is_unlocked": True
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce code de ticket a déjà été utilisé."
            )
            
    event = ticket.event
    if not event.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'événement associé à ce ticket n'est pas actif."
        )
        
    now = datetime.utcnow()
    if event.start_date and now < event.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'événement commencera le {event.start_date.strftime('%d/%m/%Y à %H:%M')}."
        )
    if event.end_date and now > event.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'événement est déjà terminé."
        )
        
    ticket.is_used = True
    ticket.used_by_user_id = current_user.id
    ticket.used_at = now
    
    db.commit()
    db.refresh(ticket)
    
    return {
        "id": event.id,
        "name": event.name,
        "code": event.code,
        "description": event.description,
        "is_active": event.is_active,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "requires_ticket": event.requires_ticket,
        "is_unlocked": True
    }

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
