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
from app.models import User, InstallationStatus, LeadStatus
from app.core.timezone import today_colombia
from pydantic import BaseModel

router = APIRouter()


# ============== PUBLIC ENDPOINTS (for technician app) ==============

class AppTimerStartRequest(BaseModel):
    """Timer start request for app (no auth)."""
    started_by: str = "technician"


@router.get("/app/{installation_id}")
def get_installation_for_app(
    installation_id: int,
    db: Session = Depends(get_db)
):
    """
    PUBLIC ENDPOINT - Get installation detail for technician app.
    No authentication required.
    Returns installation with lead and product details.
    """
    from app.models import Lead, Product, Technician

    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )

    import json

    # Parse photos arrays
    photos_before = None
    photos_after = None
    if installation.photos_before:
        try:
            photos_before = json.loads(installation.photos_before)
        except:
            pass
    if installation.photos_after:
        try:
            photos_after = json.loads(installation.photos_after)
        except:
            pass

    # Build response with related data
    data = {
        "id": installation.id,
        "lead_id": installation.lead_id,
        "product_id": installation.product_id,
        "quantity": installation.quantity,
        "address": installation.address,
        "city": installation.city,
        "address_notes": installation.address_notes,
        "total_price": installation.total_price,
        "customer_notes": installation.customer_notes,
        "technician_id": installation.technician_id,
        "scheduled_date": installation.scheduled_date,
        "scheduled_time": installation.scheduled_time,
        "estimated_duration": installation.estimated_duration or 60,
        "status": installation.status,
        "payment_status": installation.payment_status,
        "payment_method": installation.payment_method,
        "amount_paid": installation.amount_paid or 0,
        "technician_notes": installation.technician_notes,
        "completed_at": installation.completed_at,
        "timer_started_at": installation.timer_started_at,
        "timer_ended_at": installation.timer_ended_at,
        "timer_started_by": installation.timer_started_by,
        "installation_duration_minutes": installation.installation_duration_minutes,
        "created_at": installation.created_at,
        "updated_at": installation.updated_at,
        # Media
        "signature_url": installation.signature_url,
        "photos_before": photos_before,
        "photos_after": photos_after,
    }

    # Get lead data
    lead = db.query(Lead).filter(Lead.id == installation.lead_id).first()
    if lead:
        data["lead_name"] = lead.name
        data["lead_phone"] = lead.phone

    # Get product data
    product = db.query(Product).filter(Product.id == installation.product_id).first()
    if product:
        data["product_name"] = product.name
        data["product_model"] = product.model
        data["product_image"] = product.image_url

    # Get technician name
    if installation.technician_id:
        tech = db.query(Technician).filter(Technician.id == installation.technician_id).first()
        if tech:
            data["technician_name"] = tech.full_name

    return data


@router.post("/app/{installation_id}/timer/start", response_model=TimerResponse)
def start_timer_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    timer_in: AppTimerStartRequest = None
):
    """
    PUBLIC ENDPOINT - Start installation timer from technician app.
    No authentication required.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    
    started_by = timer_in.started_by if timer_in else "technician"
    installation = crud.installation.start_timer(
        db,
        db_obj=installation,
        started_by=started_by
    )
    
    return crud.installation.get_timer_status(installation)


@router.post("/app/{installation_id}/timer/stop", response_model=TimerResponse)
def stop_timer_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db)
):
    """
    PUBLIC ENDPOINT - Stop installation timer from technician app.
    No authentication required.
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


@router.get("/app/{installation_id}/timer", response_model=TimerResponse)
def get_timer_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db)
):
    """
    PUBLIC ENDPOINT - Get timer status from technician app.
    No authentication required.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    
    return crud.installation.get_timer_status(installation)


@router.patch("/app/{installation_id}/status", response_model=InstallationResponse)
def update_status_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    status_in: InstallationStatusUpdate
):
    """
    PUBLIC ENDPOINT - Update installation status from technician app.
    No authentication required.
    """
    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )
    installation = crud.installation.update_status(db, db_obj=installation, status=status_in.status)
    
    # If installation is completed, update lead to "instalado"
    if status_in.status == InstallationStatus.COMPLETADA:
        lead = crud.lead.get(db, id=installation.lead_id)
        if lead:
            crud.lead.update_status(db, db_obj=lead, status=LeadStatus.INSTALADO)
    
    return installation


# ============== MEDIA UPLOAD ENDPOINTS (for technician app) ==============

class UploadUrlRequest(BaseModel):
    """Request for generating upload URL."""
    file_type: str  # foto_antes, foto_despues, firma
    client_name: str = "cliente"


class UploadUrlResponse(BaseModel):
    """Response with presigned upload URL."""
    upload_url: str
    public_url: str | None
    key: str
    content_type: str


class SaveMediaRequest(BaseModel):
    """Request to save media URLs."""
    signature_url: str | None = None
    photos_before: list[str] | None = None
    photos_after: list[str] | None = None


@router.post("/app/{installation_id}/upload-url", response_model=UploadUrlResponse)
def get_upload_url_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    request: UploadUrlRequest
):
    """
    PUBLIC ENDPOINT - Get presigned URL for uploading media.
    No authentication required (for technician app).
    """
    from app.services.r2_storage import r2_storage

    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )

    valid_types = ['foto_antes', 'foto_despues', 'firma']
    if request.file_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file_type. Must be one of: {valid_types}"
        )

    try:
        result = r2_storage.generate_upload_url(
            installation_id=installation_id,
            file_type=request.file_type,
            client_name=request.client_name
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating upload URL: {str(e)}"
        )


@router.post("/app/{installation_id}/save-media")
def save_media_for_app(
    installation_id: int,
    *,
    db: Session = Depends(get_db),
    request: SaveMediaRequest
):
    """
    PUBLIC ENDPOINT - Save media URLs after upload.
    No authentication required (for technician app).
    """
    import json

    installation = crud.installation.get(db, id=installation_id)
    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Installation not found"
        )

    # Update signature
    if request.signature_url is not None:
        installation.signature_url = request.signature_url

    # Update photos_before (merge with existing)
    if request.photos_before is not None:
        existing = []
        if installation.photos_before:
            try:
                existing = json.loads(installation.photos_before)
            except:
                pass
        existing.extend(request.photos_before)
        installation.photos_before = json.dumps(existing)

    # Update photos_after (merge with existing)
    if request.photos_after is not None:
        existing = []
        if installation.photos_after:
            try:
                existing = json.loads(installation.photos_after)
            except:
                pass
        existing.extend(request.photos_after)
        installation.photos_after = json.dumps(existing)

    db.add(installation)
    db.commit()
    db.refresh(installation)

    return {"status": "ok", "message": "Media saved successfully"}


# ============== AUTHENTICATED ENDPOINTS ==============

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
        # Use Colombia timezone for "today"
        target_date = today_colombia()
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

    # Update lead status to "agendado" (has scheduled installation)
    crud.lead.update_status(db, db_obj=lead, status=LeadStatus.AGENDADO)

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
    
    # If installation is completed, update lead to "instalado" (now a customer!)
    if status_in.status == InstallationStatus.COMPLETADA:
        lead = crud.lead.get(db, id=installation.lead_id)
        if lead:
            crud.lead.update_status(db, db_obj=lead, status=LeadStatus.INSTALADO)
    
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
    
    # Update lead to "instalado" - now a customer!
    lead = crud.lead.get(db, id=installation.lead_id)
    if lead:
        crud.lead.update_status(db, db_obj=lead, status=LeadStatus.INSTALADO)
    
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
