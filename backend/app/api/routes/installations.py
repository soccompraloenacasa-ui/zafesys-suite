"""
ZAFESYS Suite - Installation Routes
"""
from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app import crud
from app.schemas import (
    InstallationCreate, InstallationUpdate, InstallationResponse,
    InstallationStatusUpdate, InstallationPaymentUpdate, InstallationCompleteRequest
)
from app.schemas.installation import TimerStartRequest, TimerResponse
from app.models import User, InstallationStatus

router = APIRouter()


@router.get("/", response_model=List[InstallationResponse])
def get_installations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    status_filter: InstallationStatus = Query(default=None)
):
    """Get all installations."""
    if status_filter:
        return crud.installation.get_by_status(db, status=status_filter, skip=skip, limit=limit)
    return crud.installation.get_multi(db, skip=skip, limit=limit)


@router.get("/pending", response_model=List[InstallationResponse])
def get_pending_installations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get installations pending scheduling."""
    return crud.installation.get_pending(db)


@router.get("/by-date", response_model=List[InstallationResponse])
def get_installations_by_date(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    target_date: date = Query(default=None),
    technician_id: int = Query(default=None)
):
    """Get installations for a specific date."""
    if target_date is None:
        target_date = date.today()
    return crud.installation.get_by_date(db, target_date=target_date, technician_id=technician_id)


@router.get("/stats")
def get_installations_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get installation statistics."""
    return {
        "by_status": crud.installation.count_by_status(db),
        "today_count": crud.installation.get_today_count(db)
    }


@router.get("/{installation_id}", response_model=InstallationResponse)
def get_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific installation."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    return installation


@router.post("/", response_model=InstallationResponse)
def create_installation(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    installation_in: InstallationCreate
):
    """Create a new installation."""
    # Verify lead exists
    lead = crud.lead.get(db, id=installation_in.lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead not found"
        )

    # Verify product exists and has stock
    product = crud.product.get(db, id=installation_in.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product not found"
        )
    if product.stock < installation_in.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {product.stock}"
        )

    # Create installation
    installation = crud.installation.create(db, obj_in=installation_in)

    # Decrease product stock
    crud.product.update_stock(
        db, db_obj=product, quantity=installation_in.quantity, operation="subtract"
    )

    return installation


@router.put("/{installation_id}", response_model=InstallationResponse)
def update_installation(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    installation_in: InstallationUpdate
):
    """Update an installation."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    installation = crud.installation.update(db, db_obj=installation, obj_in=installation_in)
    return installation


@router.patch("/{installation_id}/status", response_model=InstallationResponse)
def update_installation_status(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_in: InstallationStatusUpdate
):
    """Update installation status."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    installation = crud.installation.update_status(db, db_obj=installation, status=status_in.status)
    return installation


@router.patch("/{installation_id}/payment", response_model=InstallationResponse)
def update_installation_payment(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    payment_in: InstallationPaymentUpdate
):
    """Update installation payment info."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    installation = crud.installation.update_payment(
        db,
        db_obj=installation,
        payment_status=payment_in.payment_status,
        payment_method=payment_in.payment_method,
        amount_paid=float(payment_in.amount_paid)
    )
    return installation


@router.post("/{installation_id}/complete", response_model=InstallationResponse)
def complete_installation(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    complete_in: InstallationCompleteRequest
):
    """Mark installation as completed."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    installation = crud.installation.complete(
        db,
        db_obj=installation,
        technician_notes=complete_in.technician_notes,
        photo_proof_url=complete_in.photo_proof_url
    )
    return installation


# ============== TIMER ENDPOINTS ==============

@router.post("/{installation_id}/timer/start", response_model=TimerResponse)
def start_installation_timer(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    timer_in: TimerStartRequest
):
    """
    Start the installation timer.
    Can be started by admin or technician.
    If timer is already running, returns current timer status.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    
    installation = crud.installation.start_timer(
        db,
        db_obj=installation,
        started_by=timer_in.started_by
    )
    
    return crud.installation.get_timer_status(installation)


@router.post("/{installation_id}/timer/stop", response_model=TimerResponse)
def stop_installation_timer(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Stop the installation timer.
    Calculates and stores the total duration.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    
    if installation.timer_started_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timer has not been started"
        )
    
    if installation.timer_ended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Timer has already been stopped"
        )
    
    installation = crud.installation.stop_timer(db, db_obj=installation)
    
    return crud.installation.get_timer_status(installation)


@router.get("/{installation_id}/timer", response_model=TimerResponse)
def get_installation_timer(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current timer status for an installation.
    Includes elapsed time if timer is running.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    
    return crud.installation.get_timer_status(installation)


@router.delete("/{installation_id}")
def delete_installation(
    installation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an installation."""
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    crud.installation.remove(db, id=installation_id)
    return {"message": "Installation deleted"}
