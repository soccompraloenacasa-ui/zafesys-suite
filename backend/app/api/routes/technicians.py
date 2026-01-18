"""
ZAFESYS Suite - Technician Routes
"""
from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_admin
from app import crud
from app.schemas import (
    TechnicianCreate, TechnicianUpdate, TechnicianResponse, TechnicianListResponse,
    TechnicianDaySchedule, InstallationResponse
)
from app.models import User

router = APIRouter()


@router.get("/", response_model=List[TechnicianListResponse])
def get_technicians(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
):
    """Get all technicians."""
    if active_only:
        return crud.technician.get_active(db, skip=skip, limit=limit)
    return crud.technician.get_multi(db, skip=skip, limit=limit)


@router.get("/available", response_model=List[TechnicianListResponse])
def get_available_technicians(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get available technicians for assignment."""
    return crud.technician.get_available(db)


@router.get("/{technician_id}", response_model=TechnicianResponse)
def get_technician(
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific technician."""
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )
    return technician


@router.get("/{technician_id}/schedule", response_model=TechnicianDaySchedule)
def get_technician_schedule(
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    target_date: date = Query(default=None)
):
    """Get technician's schedule for a specific day."""
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )

    if target_date is None:
        target_date = date.today()

    installations = crud.installation.get_technician_day_schedule(
        db, technician_id=technician_id, target_date=target_date
    )

    return TechnicianDaySchedule(
        date=target_date,
        installations=[InstallationResponse.model_validate(i) for i in installations],
        total_count=len(installations)
    )


@router.post("/", response_model=TechnicianResponse)
def create_technician(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    technician_in: TechnicianCreate
):
    """Create a new technician (admin only)."""
    existing = crud.technician.get_by_phone(db, phone=technician_in.phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Technician with this phone already exists"
        )
    technician = crud.technician.create(db, obj_in=technician_in)
    return technician


@router.put("/{technician_id}", response_model=TechnicianResponse)
def update_technician(
    technician_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    technician_in: TechnicianUpdate
):
    """Update a technician (admin only)."""
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )
    technician = crud.technician.update(db, db_obj=technician, obj_in=technician_in)
    return technician


@router.patch("/{technician_id}/availability", response_model=TechnicianResponse)
def update_technician_availability(
    technician_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_available: bool
):
    """Update technician availability status."""
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )
    technician = crud.technician.set_availability(db, db_obj=technician, is_available=is_available)
    return technician


@router.delete("/{technician_id}")
def delete_technician(
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a technician (admin only)."""
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )
    crud.technician.remove(db, id=technician_id)
    return {"message": "Technician deleted"}
