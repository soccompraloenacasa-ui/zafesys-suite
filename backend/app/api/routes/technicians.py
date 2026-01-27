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
from pydantic import BaseModel

router = APIRouter()


# ============== PUBLIC ENDPOINTS (for technician app) ==============

class TechnicianAppItem(BaseModel):
    """Minimal technician info for app login selector."""
    id: int
    full_name: str

    class Config:
        from_attributes = True


@router.get("/app/list", response_model=List[TechnicianAppItem])
def get_technicians_for_app(
    db: Session = Depends(get_db)
):
    """
    PUBLIC ENDPOINT - Get active technicians for app login selector.
    No authentication required.
    """
    technicians = crud.technician.get_active(db, skip=0, limit=100)
    return technicians


@router.get("/app/{technician_id}/installations")
def get_technician_installations_for_app(
    technician_id: int,
    db: Session = Depends(get_db),
    target_date: date = Query(default=None)
):
    """
    PUBLIC ENDPOINT - Get technician's installations for a specific date.
    No authentication required (for technician app).
    Returns installations with lead and product details.
    """
    from app.core.timezone import today_colombia
    from app.models import Lead, Product, Technician as TechnicianModel

    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technician not found"
        )

    if target_date is None:
        target_date = today_colombia()

    installations = crud.installation.get_by_date(
        db, target_date=target_date, technician_id=technician_id
    )

    # Enrich with lead and product data
    result = []
    for inst in installations:
        data = {
            "id": inst.id,
            "lead_id": inst.lead_id,
            "product_id": inst.product_id,
            "quantity": inst.quantity,
            "address": inst.address,
            "city": inst.city,
            "address_notes": inst.address_notes,
            "total_price": inst.total_price,
            "customer_notes": inst.customer_notes,
            "technician_id": inst.technician_id,
            "scheduled_date": inst.scheduled_date,
            "scheduled_time": inst.scheduled_time,
            "estimated_duration": inst.estimated_duration or 60,
            "status": inst.status,
            "payment_status": inst.payment_status,
            "payment_method": inst.payment_method,
            "amount_paid": inst.amount_paid or 0,
            "technician_notes": inst.technician_notes,
            "completed_at": inst.completed_at,
            "timer_started_at": inst.timer_started_at,
            "timer_ended_at": inst.timer_ended_at,
            "timer_started_by": inst.timer_started_by,
            "installation_duration_minutes": inst.installation_duration_minutes,
            "created_at": inst.created_at,
            "updated_at": inst.updated_at,
        }

        # Get lead data
        lead = db.query(Lead).filter(Lead.id == inst.lead_id).first()
        if lead:
            data["lead_name"] = lead.name
            data["lead_phone"] = lead.phone

        # Get product data
        product = db.query(Product).filter(Product.id == inst.product_id).first()
        if product:
            data["product_name"] = product.name
            data["product_model"] = product.model
            data["product_image"] = product.image_url

        # Get technician name
        if inst.technician_id:
            tech = db.query(TechnicianModel).filter(TechnicianModel.id == inst.technician_id).first()
            if tech:
                data["technician_name"] = tech.full_name

        result.append(data)

    return result


# ============== AUTHENTICATED ENDPOINTS ==============

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
