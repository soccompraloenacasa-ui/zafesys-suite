"""
ZAFESYS Suite - Technician Mobile App Routes
Endpoints for the technician PWA
"""
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel
from app.api.deps import get_db
from app import crud
from app.models.technician import Technician, TechnicianLocation
from app.models.installation import Installation, InstallationStatus, PaymentStatus, PaymentMethod, TimerStartedBy
from app.core.security import create_access_token

router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class TechLoginRequest(BaseModel):
    phone: str
    pin: str


class TechLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    technician_id: int
    technician_name: str


class TechInstallationResponse(BaseModel):
    id: int
    lead_name: str
    lead_phone: str
    product_name: str
    product_model: str
    product_image: Optional[str]  # Added product image URL
    scheduled_date: Optional[date]
    scheduled_time: Optional[str]
    address: str
    city: Optional[str]
    address_notes: Optional[str]
    status: str
    payment_status: str
    total_price: float
    amount_paid: float
    customer_notes: Optional[str]
    # Timer fields
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None

    class Config:
        from_attributes = True


class TechStatusUpdateRequest(BaseModel):
    status: str  # en_camino, en_progreso, completada


class TechPaymentConfirmRequest(BaseModel):
    amount: float
    method: str  # efectivo, transferencia, nequi, daviplata


class TechAvailabilityRequest(BaseModel):
    is_available: bool


class TechCompleteRequest(BaseModel):
    technician_notes: Optional[str] = None
    photo_proof_url: Optional[str] = None


# Timer Schema for PWA
class TechTimerResponse(BaseModel):
    installation_id: int
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None
    is_running: bool = False
    elapsed_minutes: Optional[int] = None


# GPS Tracking Schemas
class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    altitude: Optional[float] = None
    battery_level: Optional[int] = None
    activity: Optional[str] = None  # idle, moving, at_installation
    installation_id: Optional[int] = None


class TechnicianLocationResponse(BaseModel):
    technician_id: int
    technician_name: str
    phone: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    battery_level: Optional[int]
    activity: Optional[str]
    is_available: bool
    recorded_at: datetime
    minutes_ago: int
    current_installation: Optional[dict] = None

    class Config:
        from_attributes = True


class LocationHistoryResponse(BaseModel):
    id: int
    latitude: float
    longitude: float
    accuracy: Optional[float]
    speed: Optional[float]
    battery_level: Optional[int]
    activity: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# HELPER: Get current technician from token
# ============================================================

def get_current_technician(
    db: Session = Depends(get_db),
    token: str = Depends(lambda: None)  # Will be extracted from header
) -> Technician:
    """This is a placeholder - in production, extract from JWT token."""
    # For now, we'll pass technician_id in requests
    pass


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/login", response_model=TechLoginResponse)
def tech_login(
    request: TechLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login for technicians using phone and PIN.
    Returns a JWT token for subsequent requests.
    """
    # Normalize phone
    phone = request.phone.strip()
    if not phone.startswith("+"):
        phone = f"+57{phone}" if phone.startswith("3") else phone

    # Find technician by phone
    technician = crud.technician.get_by_phone(db, phone=phone)

    # Also try without country code
    if not technician:
        phone_without_code = phone.replace("+57", "").replace("+", "")
        technician = db.query(Technician).filter(
            Technician.phone.contains(phone_without_code),
            Technician.is_active == True
        ).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Telefono no registrado"
        )

    if not technician.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cuenta desactivada"
        )

    # Check PIN
    if not technician.pin:
        # If no PIN set, set it now (first login)
        technician.pin = request.pin
        db.add(technician)
        db.commit()
    elif technician.pin != request.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto"
        )

    # Create token
    token = create_access_token(
        subject=f"tech:{technician.id}",
        role="technician"
    )

    return TechLoginResponse(
        access_token=token,
        technician_id=technician.id,
        technician_name=technician.full_name
    )


@router.get("/my-installations", response_model=List[TechInstallationResponse])
def get_my_installations(
    technician_id: int,
    target_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Get installations assigned to a technician for a specific date.
    If no date provided, returns today's installations.
    """
    if target_date is None:
        target_date = date.today()

    # Verify technician exists
    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tecnico no encontrado"
        )

    # Get installations
    installations = crud.installation.get_technician_day_schedule(
        db, technician_id=technician_id, target_date=target_date
    )

    result = []
    for inst in installations:
        result.append(TechInstallationResponse(
            id=inst.id,
            lead_name=inst.lead.name if inst.lead else "Sin nombre",
            lead_phone=inst.lead.phone if inst.lead else "",
            product_name=inst.product.name if inst.product else "Sin producto",
            product_model=inst.product.model if inst.product else "",
            product_image=inst.product.image_url if inst.product else None,
            scheduled_date=inst.scheduled_date,
            scheduled_time=str(inst.scheduled_time) if inst.scheduled_time else None,
            address=inst.address,
            city=inst.city,
            address_notes=inst.address_notes,
            status=inst.status.value,
            payment_status=inst.payment_status.value,
            total_price=float(inst.total_price),
            amount_paid=float(inst.amount_paid),
            customer_notes=inst.customer_notes,
            timer_started_at=inst.timer_started_at,
            timer_ended_at=inst.timer_ended_at,
            timer_started_by=inst.timer_started_by.value if inst.timer_started_by else None,
            installation_duration_minutes=inst.installation_duration_minutes
        ))

    return result


@router.get("/installations/{installation_id}", response_model=TechInstallationResponse)
def get_installation_detail(
    installation_id: int,
    technician_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific installation."""
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado para ver esta instalacion"
        )

    return TechInstallationResponse(
        id=installation.id,
        lead_name=installation.lead.name if installation.lead else "Sin nombre",
        lead_phone=installation.lead.phone if installation.lead else "",
        product_name=installation.product.name if installation.product else "Sin producto",
        product_model=installation.product.model if installation.product else "",
        product_image=installation.product.image_url if installation.product else None,
        scheduled_date=installation.scheduled_date,
        scheduled_time=str(installation.scheduled_time) if installation.scheduled_time else None,
        address=installation.address,
        city=installation.city,
        address_notes=installation.address_notes,
        status=installation.status.value,
        payment_status=installation.payment_status.value,
        total_price=float(installation.total_price),
        amount_paid=float(installation.amount_paid),
        customer_notes=installation.customer_notes,
        timer_started_at=installation.timer_started_at,
        timer_ended_at=installation.timer_ended_at,
        timer_started_by=installation.timer_started_by.value if installation.timer_started_by else None,
        installation_duration_minutes=installation.installation_duration_minutes
    )


@router.patch("/installations/{installation_id}/status")
def update_installation_status(
    installation_id: int,
    technician_id: int,
    request: TechStatusUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update installation status (en_camino, en_progreso, completada)."""
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    # Validate status transition
    valid_statuses = ["en_camino", "en_progreso", "completada"]
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estado invalido. Use: {', '.join(valid_statuses)}"
        )

    new_status = InstallationStatus(request.status)
    installation.status = new_status

    if new_status == InstallationStatus.COMPLETADA:
        installation.completed_at = datetime.now(timezone.utc)

    db.add(installation)
    db.commit()

    return {"message": "Estado actualizado", "status": request.status}


# ============================================================
# TIMER ENDPOINTS FOR TECHNICIAN PWA
# ============================================================

@router.post("/installations/{installation_id}/timer/start", response_model=TechTimerResponse)
def start_timer(
    installation_id: int,
    technician_id: int,
    db: Session = Depends(get_db)
):
    """
    Start the installation timer (from technician PWA).
    Automatically sets timer_started_by to 'technician'.
    """
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    # Check if timer is already running
    if installation.timer_started_at and not installation.timer_ended_at:
        # Timer already running, return current status
        timer_status = crud.installation.get_timer_status(installation)
        return TechTimerResponse(
            installation_id=timer_status["installation_id"],
            timer_started_at=timer_status["timer_started_at"],
            timer_ended_at=timer_status["timer_ended_at"],
            timer_started_by=timer_status["timer_started_by"].value if timer_status["timer_started_by"] else None,
            installation_duration_minutes=timer_status["installation_duration_minutes"],
            is_running=timer_status["is_running"],
            elapsed_minutes=timer_status["elapsed_minutes"]
        )

    # Start the timer
    installation = crud.installation.start_timer(
        db,
        db_obj=installation,
        started_by=TimerStartedBy.TECHNICIAN
    )

    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(
        installation_id=timer_status["installation_id"],
        timer_started_at=timer_status["timer_started_at"],
        timer_ended_at=timer_status["timer_ended_at"],
        timer_started_by=timer_status["timer_started_by"].value if timer_status["timer_started_by"] else None,
        installation_duration_minutes=timer_status["installation_duration_minutes"],
        is_running=timer_status["is_running"],
        elapsed_minutes=timer_status["elapsed_minutes"]
    )


@router.post("/installations/{installation_id}/timer/stop", response_model=TechTimerResponse)
def stop_timer(
    installation_id: int,
    technician_id: int,
    db: Session = Depends(get_db)
):
    """
    Stop the installation timer (from technician PWA).
    Calculates and stores the duration.
    """
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    if installation.timer_started_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El timer no ha sido iniciado"
        )

    if installation.timer_ended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El timer ya fue detenido"
        )

    # Stop the timer
    installation = crud.installation.stop_timer(db, db_obj=installation)

    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(
        installation_id=timer_status["installation_id"],
        timer_started_at=timer_status["timer_started_at"],
        timer_ended_at=timer_status["timer_ended_at"],
        timer_started_by=timer_status["timer_started_by"].value if timer_status["timer_started_by"] else None,
        installation_duration_minutes=timer_status["installation_duration_minutes"],
        is_running=timer_status["is_running"],
        elapsed_minutes=timer_status["elapsed_minutes"]
    )


@router.get("/installations/{installation_id}/timer", response_model=TechTimerResponse)
def get_timer_status(
    installation_id: int,
    technician_id: int,
    db: Session = Depends(get_db)
):
    """
    Get current timer status for an installation.
    Shows elapsed time if timer is running.
    """
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(
        installation_id=timer_status["installation_id"],
        timer_started_at=timer_status["timer_started_at"],
        timer_ended_at=timer_status["timer_ended_at"],
        timer_started_by=timer_status["timer_started_by"].value if timer_status["timer_started_by"] else None,
        installation_duration_minutes=timer_status["installation_duration_minutes"],
        is_running=timer_status["is_running"],
        elapsed_minutes=timer_status["elapsed_minutes"]
    )


# ============================================================
# PAYMENT & COMPLETION ENDPOINTS
# ============================================================

@router.post("/installations/{installation_id}/confirm-payment")
def confirm_payment(
    installation_id: int,
    technician_id: int,
    request: TechPaymentConfirmRequest,
    db: Session = Depends(get_db)
):
    """Confirm payment received from customer."""
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    # Update payment
    installation.amount_paid = float(installation.amount_paid or 0) + request.amount

    # Set payment method
    try:
        installation.payment_method = PaymentMethod(request.method)
    except ValueError:
        pass  # Keep existing method if invalid

    # Update payment status
    if installation.amount_paid >= float(installation.total_price):
        installation.payment_status = PaymentStatus.PAGADO
    elif installation.amount_paid > 0:
        installation.payment_status = PaymentStatus.PARCIAL

    db.add(installation)
    db.commit()

    return {
        "message": "Pago registrado",
        "amount_paid": float(installation.amount_paid),
        "total_price": float(installation.total_price),
        "payment_status": installation.payment_status.value
    }


@router.post("/installations/{installation_id}/complete")
def complete_installation(
    installation_id: int,
    technician_id: int,
    request: TechCompleteRequest,
    db: Session = Depends(get_db)
):
    """Mark installation as completed with optional notes and photo."""
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instalacion no encontrada"
        )

    if installation.technician_id != technician_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado"
        )

    # If timer is running, stop it first
    if installation.timer_started_at and not installation.timer_ended_at:
        crud.installation.stop_timer(db, db_obj=installation)

    installation.status = InstallationStatus.COMPLETADA
    installation.completed_at = datetime.now(timezone.utc)

    if request.technician_notes:
        installation.technician_notes = request.technician_notes

    if request.photo_proof_url:
        installation.photo_proof_url = request.photo_proof_url

    db.add(installation)
    db.commit()

    return {"message": "Instalacion completada", "id": installation.id}


@router.patch("/availability")
def update_availability(
    technician_id: int,
    request: TechAvailabilityRequest,
    db: Session = Depends(get_db)
):
    """Update technician availability status."""
    technician = crud.technician.get(db, id=technician_id)

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tecnico no encontrado"
        )

    technician.is_available = request.is_available
    db.add(technician)
    db.commit()

    return {
        "message": "Disponibilidad actualizada",
        "is_available": technician.is_available
    }


@router.get("/profile")
def get_tech_profile(
    technician_id: int,
    db: Session = Depends(get_db)
):
    """Get technician profile info."""
    technician = crud.technician.get(db, id=technician_id)

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tecnico no encontrado"
        )

    return {
        "id": technician.id,
        "full_name": technician.full_name,
        "phone": technician.phone,
        "email": technician.email,
        "zone": technician.zone,
        "is_available": technician.is_available,
        "is_active": technician.is_active,
        "tracking_enabled": getattr(technician, 'tracking_enabled', True)
    }


# ============================================================
# GPS TRACKING ENDPOINTS
# ============================================================

@router.post("/location")
def update_location(
    technician_id: int,
    request: LocationUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update technician's current GPS location.
    Called periodically by the PWA (every 2-3 minutes).
    """
    technician = crud.technician.get(db, id=technician_id)
    
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tecnico no encontrado"
        )
    
    # Create location record
    location = TechnicianLocation(
        technician_id=technician_id,
        latitude=request.latitude,
        longitude=request.longitude,
        accuracy=request.accuracy,
        speed=request.speed,
        heading=request.heading,
        altitude=request.altitude,
        battery_level=request.battery_level,
        activity=request.activity,
        installation_id=request.installation_id
    )
    
    db.add(location)
    db.commit()
    
    return {
        "message": "Ubicacion actualizada",
        "location_id": location.id,
        "recorded_at": location.recorded_at
    }


@router.get("/locations/all", response_model=List[TechnicianLocationResponse])
def get_all_technician_locations(
    db: Session = Depends(get_db)
):
    """
    Get the latest location for all active technicians.
    Used by admin dashboard to show real-time map.
    """
    # Subquery to get the latest location for each technician
    latest_location_subq = db.query(
        TechnicianLocation.technician_id,
        func.max(TechnicianLocation.recorded_at).label('max_recorded_at')
    ).group_by(TechnicianLocation.technician_id).subquery()
    
    # Join to get full location data along with technician info
    results = db.query(TechnicianLocation, Technician).join(
        latest_location_subq,
        and_(
            TechnicianLocation.technician_id == latest_location_subq.c.technician_id,
            TechnicianLocation.recorded_at == latest_location_subq.c.max_recorded_at
        )
    ).join(
        Technician,
        TechnicianLocation.technician_id == Technician.id
    ).filter(
        Technician.is_active == True
    ).all()
    
    now = datetime.now(timezone.utc)
    response = []
    
    for location, technician in results:
        # Calculate minutes since last update
        recorded_at = location.recorded_at
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
        time_diff = now - recorded_at
        minutes_ago = int(time_diff.total_seconds() / 60)
        
        # Get current installation if any
        current_installation = None
        if location.installation_id:
            inst = db.query(Installation).filter(Installation.id == location.installation_id).first()
            if inst:
                current_installation = {
                    "id": inst.id,
                    "address": inst.address,
                    "lead_name": inst.lead.name if inst.lead else "Sin nombre",
                    "status": inst.status.value
                }
        
        response.append(TechnicianLocationResponse(
            technician_id=technician.id,
            technician_name=technician.full_name,
            phone=technician.phone,
            latitude=location.latitude,
            longitude=location.longitude,
            accuracy=location.accuracy,
            battery_level=location.battery_level,
            activity=location.activity,
            is_available=technician.is_available,
            recorded_at=location.recorded_at,
            minutes_ago=minutes_ago,
            current_installation=current_installation
        ))
    
    return response


@router.get("/locations/history/{technician_id}", response_model=List[LocationHistoryResponse])
def get_technician_location_history(
    technician_id: int,
    date_filter: Optional[date] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get location history for a specific technician.
    Useful for reviewing a technician's route during the day.
    """
    query = db.query(TechnicianLocation).filter(
        TechnicianLocation.technician_id == technician_id
    )
    
    if date_filter:
        start_of_day = datetime.combine(date_filter, datetime.min.time())
        end_of_day = datetime.combine(date_filter, datetime.max.time())
        query = query.filter(
            TechnicianLocation.recorded_at >= start_of_day,
            TechnicianLocation.recorded_at <= end_of_day
        )
    
    locations = query.order_by(TechnicianLocation.recorded_at.desc()).limit(limit).all()
    
    return [LocationHistoryResponse(
        id=loc.id,
        latitude=loc.latitude,
        longitude=loc.longitude,
        accuracy=loc.accuracy,
        speed=loc.speed,
        battery_level=loc.battery_level,
        activity=loc.activity,
        recorded_at=loc.recorded_at
    ) for loc in locations]
