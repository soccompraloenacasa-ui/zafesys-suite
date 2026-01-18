"""
ZAFESYS Suite - Lead Routes
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app import crud
from app.schemas import (
    LeadCreate, LeadUpdate, LeadResponse, LeadStatusUpdate, LeadKanbanResponse
)
from app.models import User, LeadStatus

router = APIRouter()


@router.get("/", response_model=List[LeadResponse])
def get_leads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all leads."""
    return crud.lead.get_multi(db, skip=skip, limit=limit)


@router.get("/kanban")
def get_leads_kanban(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get leads organized for kanban board."""
    kanban_data = crud.lead.get_kanban_data(db)
    # Convert to response format
    result = {}
    for status_key, leads in kanban_data.items():
        result[status_key] = [
            LeadKanbanResponse.model_validate(lead) for lead in leads
        ]
    return result


@router.get("/stats")
def get_leads_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lead statistics."""
    return crud.lead.count_by_status(db)


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific lead."""
    lead = crud.lead.get(db, id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    return lead


@router.post("/", response_model=LeadResponse)
def create_lead(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lead_in: LeadCreate
):
    """Create a new lead."""
    # Check if phone already exists
    existing = crud.lead.get_by_phone(db, phone=lead_in.phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead with this phone already exists"
        )
    lead = crud.lead.create(db, obj_in=lead_in)
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lead_in: LeadUpdate
):
    """Update a lead."""
    lead = crud.lead.get(db, id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    lead = crud.lead.update(db, db_obj=lead, obj_in=lead_in)
    return lead


@router.patch("/{lead_id}/status", response_model=LeadResponse)
def update_lead_status(
    lead_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_in: LeadStatusUpdate
):
    """Update lead status (for kanban drag & drop)."""
    lead = crud.lead.get(db, id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    lead = crud.lead.update_status(db, db_obj=lead, status=status_in.status)
    return lead


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a lead."""
    lead = crud.lead.get(db, id=lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    crud.lead.remove(db, id=lead_id)
    return {"message": "Lead deleted"}
