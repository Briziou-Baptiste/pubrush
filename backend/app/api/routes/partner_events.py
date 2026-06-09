from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.db import get_db
from app.models import PartnerEvent, MapFilter, User, EventTicket, PartnerEventUser, PartnerEventSpot
from app.api.deps.auth import get_current_user
from app.schemas import PartnerEventRead, MapFilterRead, PartnerEventSpotRead

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
            # Ensure they are registered in PartnerEventUser
            existing_join = db.scalar(
                select(PartnerEventUser).where(
                    PartnerEventUser.event_id == event.id,
                    PartnerEventUser.user_id == current_user.id
                )
            )
            if not existing_join:
                join_record = PartnerEventUser(event_id=event.id, user_id=current_user.id)
                db.add(join_record)
                db.commit()
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
    if event.end_date and now > event.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'événement est déjà terminé."
        )
        
    ticket.is_used = True
    ticket.used_by_user_id = current_user.id
    ticket.used_at = now
    
    # Ensure they are registered in PartnerEventUser
    existing_join = db.scalar(
        select(PartnerEventUser).where(
            PartnerEventUser.event_id == event.id,
            PartnerEventUser.user_id == current_user.id
        )
    )
    if not existing_join:
        join_record = PartnerEventUser(event_id=event.id, user_id=current_user.id)
        db.add(join_record)
        
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
        
    # Check ticket requirement
    if event.requires_ticket:
        ticket = db.scalar(
            select(EventTicket).where(
                EventTicket.event_id == event.id,
                EventTicket.used_by_user_id == current_user.id,
                EventTicket.is_used == True
            )
        )
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cet événement nécessite un ticket d'accès valide."
            )
            
    # Also register the user as having joined if not already
    existing_join = db.scalar(
        select(PartnerEventUser).where(
            PartnerEventUser.event_id == event.id,
            PartnerEventUser.user_id == current_user.id
        )
    )
    if not existing_join:
        join_record = PartnerEventUser(event_id=event.id, user_id=current_user.id)
        db.add(join_record)
        db.commit()
        
    return event


@router.post("/partner-events/{event_id}/join")
def join_partner_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event or not event.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Événement partenaire introuvable ou inactif."
        )

    # Check dates activity
    now = datetime.utcnow()
    if event.end_date and now > event.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'événement est déjà terminé."
        )

    # If it requires a ticket, verify that they have a redeemed ticket for it
    if event.requires_ticket:
        ticket = db.scalar(
            select(EventTicket).where(
                EventTicket.event_id == event.id,
                EventTicket.used_by_user_id == current_user.id,
                EventTicket.is_used == True
            )
        )
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cet événement nécessite un ticket d'accès valide."
            )

    # Add to PartnerEventUser
    existing_join = db.scalar(
        select(PartnerEventUser).where(
            PartnerEventUser.event_id == event.id,
            PartnerEventUser.user_id == current_user.id
        )
    )
    if not existing_join:
        join_record = PartnerEventUser(event_id=event.id, user_id=current_user.id)
        db.add(join_record)
        db.commit()
    
    return {"message": "Vous avez rejoint l'événement avec succès."}


@router.get("/map-filters", response_model=list[MapFilterRead])
def get_map_filters(
    partner_event_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch event-specific filters if partner_event_id is provided
    if partner_event_id:
        event = db.scalar(
            select(PartnerEvent).where(
                PartnerEvent.id == partner_event_id,
                PartnerEvent.is_active == True
            )
        )
        if event:
            return event.filters
        return []

    # Otherwise (e.g. for general map), return all global filters
    global_filters = db.scalars(
        select(MapFilter).where(MapFilter.is_global == True)
    ).all()
    return list(global_filters)


@router.get("/partner-events/{event_id}/spots", response_model=list[PartnerEventSpotRead])
def get_partner_event_spots(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.get(PartnerEvent, event_id)
    if not event or not event.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Événement partenaire introuvable ou inactif."
        )

    # If it requires a ticket, verify that the ticket is used by current user
    if event.requires_ticket:
        ticket = db.scalar(
            select(EventTicket).where(
                EventTicket.event_id == event.id,
                EventTicket.used_by_user_id == current_user.id,
                EventTicket.is_used == True
            )
        )
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cet événement nécessite un ticket d'accès valide."
            )

    spots = db.scalars(
        select(PartnerEventSpot)
        .where(PartnerEventSpot.event_id == event_id)
        .order_by(PartnerEventSpot.name.asc())
    ).all()
    return list(spots)
