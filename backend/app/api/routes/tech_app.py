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
import json
from app.api.deps import get_db
from app import crud
from app.models.technician import Technician, TechnicianLocation
from app.models.installation import Installation, InstallationStatus, PaymentStatus, PaymentMethod
from app.core.security import create_access_token
from app.services.r2_storage import get_r2_service

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
    product_image: Optional[str]
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
    # Media fields
    signature_url: Optional[str] = None
    photos_before: Optional[List[str]] = None
    photos_after: Optional[List[str]] = None
    video_url: Optional[str] = None

    class Config:
        from_attributes = True


class TechStatusUpdateRequest(BaseModel):
    status: str


class TechPaymentConfirmRequest(BaseModel):
    amount: float
    method: str


class TechAvailabilityRequest(BaseModel):
    is_available: bool


class TechCompleteRequest(BaseModel):
    technician_notes: Optional[str] = None
    photo_proof_url: Optional[str] = None


class TechTimerResponse(BaseModel):
    installation_id: int
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None
    is_running: bool = False
    elapsed_minutes: Optional[int] = None


class UploadUrlRequest(BaseModel):
    file_type: str  # foto_antes, foto_despues, firma, video
    client_name: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


class SaveMediaRequest(BaseModel):
    signature_url: Optional[str] = None
    photos_before: Optional[List[str]] = None
    photos_after: Optional[List[str]] = None
    video_url: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    altitude: Optional[float] = None
    battery_level: Optional[int] = None
    activity: Optional[str] = None
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
# HELPERS
# ============================================================

def parse_photos_json(photos_str: Optional[str]) -> Optional[List[str]]:
    if not photos_str:
        return None
    try:
        return json.loads(photos_str)
    except:
        return None


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/login", response_model=TechLoginResponse)
def tech_login(request: TechLoginRequest, db: Session = Depends(get_db)):
    phone = request.phone.strip()
    if not phone.startswith("+"):
        phone = f"+57{phone}" if phone.startswith("3") else phone

    technician = crud.technician.get_by_phone(db, phone=phone)

    if not technician:
        phone_without_code = phone.replace("+57", "").replace("+", "")
        technician = db.query(Technician).filter(
            Technician.phone.contains(phone_without_code),
            Technician.is_active == True
        ).first()

    if not technician:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telefono no registrado")

    if not technician.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cuenta desactivada")

    if not technician.pin:
        technician.pin = request.pin
        db.add(technician)
        db.commit()
    elif technician.pin != request.pin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorrecto")

    token = create_access_token(subject=f"tech:{technician.id}", role="technician")

    return TechLoginResponse(
        access_token=token,
        technician_id=technician.id,
        technician_name=technician.full_name
    )


@router.get("/my-installations", response_model=List[TechInstallationResponse])
def get_my_installations(technician_id: int, target_date: Optional[date] = None, db: Session = Depends(get_db)):
    if target_date is None:
        target_date = date.today()

    technician = crud.technician.get(db, id=technician_id)
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tecnico no encontrado")

    installations = crud.installation.get_technician_day_schedule(db, technician_id=technician_id, target_date=target_date)

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
            timer_started_by=inst.timer_started_by,
            installation_duration_minutes=inst.installation_duration_minutes,
            signature_url=inst.signature_url,
            photos_before=parse_photos_json(inst.photos_before),
            photos_after=parse_photos_json(inst.photos_after),
            video_url=getattr(inst, 'video_url', None)
        ))

    return result


@router.get("/installations/{installation_id}", response_model=TechInstallationResponse)
def get_installation_detail(installation_id: int, technician_id: int, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver esta instalacion")

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
        timer_started_by=installation.timer_started_by,
        installation_duration_minutes=installation.installation_duration_minutes,
        signature_url=installation.signature_url,
        photos_before=parse_photos_json(installation.photos_before),
        photos_after=parse_photos_json(installation.photos_after),
        video_url=getattr(installation, 'video_url', None)
    )


@router.patch("/installations/{installation_id}/status")
def update_installation_status(installation_id: int, technician_id: int, request: TechStatusUpdateRequest, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    valid_statuses = ["en_camino", "en_progreso", "completada"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Estado invalido. Use: {', '.join(valid_statuses)}")

    new_status = InstallationStatus(request.status)
    installation.status = new_status

    if new_status == InstallationStatus.COMPLETADA:
        installation.completed_at = datetime.now(timezone.utc)

    db.add(installation)
    db.commit()

    return {"message": "Estado actualizado", "status": request.status}


# ============================================================
# MEDIA UPLOAD ENDPOINTS
# ============================================================

@router.post("/installations/{installation_id}/upload-url", response_model=UploadUrlResponse)
def get_upload_url(installation_id: int, request: UploadUrlRequest, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    valid_types = ["foto_antes", "foto_despues", "firma", "video"]
    if request.file_type not in valid_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tipo invalido. Use: {', '.join(valid_types)}")

    try:
        r2_service = get_r2_service()
        result = r2_service.generate_upload_url(
            installation_id=installation_id,
            file_type=request.file_type,
            client_name=request.client_name
        )
        return UploadUrlResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generando URL: {str(e)}")


@router.post("/installations/{installation_id}/save-media")
def save_media_references(installation_id: int, request: SaveMediaRequest, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if request.signature_url:
        installation.signature_url = request.signature_url

    if request.photos_before:
        existing = parse_photos_json(installation.photos_before) or []
        existing.extend(request.photos_before)
        installation.photos_before = json.dumps(existing)

    if request.photos_after:
        existing = parse_photos_json(installation.photos_after) or []
        existing.extend(request.photos_after)
        installation.photos_after = json.dumps(existing)

    if request.video_url:
        installation.video_url = request.video_url

    db.add(installation)
    db.commit()

    return {
        "message": "Media guardada",
        "signature_url": installation.signature_url,
        "photos_before": parse_photos_json(installation.photos_before),
        "photos_after": parse_photos_json(installation.photos_after),
        "video_url": getattr(installation, 'video_url', None)
    }


# ============================================================
# TIMER ENDPOINTS
# ============================================================

@router.post("/installations/{installation_id}/timer/start", response_model=TechTimerResponse)
def start_timer(installation_id: int, technician_id: int, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    if installation.timer_started_at and not installation.timer_ended_at:
        timer_status = crud.installation.get_timer_status(installation)
        return TechTimerResponse(**timer_status)

    installation = crud.installation.start_timer(db, db_obj=installation, started_by="technician")
    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(**timer_status)


@router.post("/installations/{installation_id}/timer/stop", response_model=TechTimerResponse)
def stop_timer(installation_id: int, technician_id: int, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    if installation.timer_started_at is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El timer no ha sido iniciado")

    if installation.timer_ended_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El timer ya fue detenido")

    installation = crud.installation.stop_timer(db, db_obj=installation)
    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(**timer_status)


@router.get("/installations/{installation_id}/timer", response_model=TechTimerResponse)
def get_timer_status(installation_id: int, technician_id: int, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    timer_status = crud.installation.get_timer_status(installation)
    return TechTimerResponse(**timer_status)


# ============================================================
# PAYMENT & COMPLETION
# ============================================================

@router.post("/installations/{installation_id}/confirm-payment")
def confirm_payment(installation_id: int, technician_id: int, request: TechPaymentConfirmRequest, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    installation.amount_paid = float(installation.amount_paid or 0) + request.amount

    try:
        installation.payment_method = PaymentMethod(request.method)
    except ValueError:
        pass

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
def complete_installation(installation_id: int, technician_id: int, request: TechCompleteRequest, db: Session = Depends(get_db)):
    installation = crud.installation.get(db, id=installation_id)

    if not installation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instalacion no encontrada")

    if installation.technician_id != technician_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

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
def update_availability(technician_id: int, request: TechAvailabilityRequest, db: Session = Depends(get_db)):
    technician = crud.technician.get(db, id=technician_id)

    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tecnico no encontrado")

    technician.is_available = request.is_available
    db.add(technician)
    db.commit()

    return {"message": "Disponibilidad actualizada", "is_available": technician.is_available}


@router.get("/profile")
def get_tech_profile(technician_id: int, db: Session = Depends(get_db)):
    technician = crud.technician.get(db, id=technician_id)

    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tecnico no encontrado")

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
# GPS TRACKING
# ============================================================

@router.post("/location")
def update_location(technician_id: int, request: LocationUpdateRequest, db: Session = Depends(get_db)):
    technician = crud.technician.get(db, id=technician_id)
    
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tecnico no encontrado")
    
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
    
    return {"message": "Ubicacion actualizada", "location_id": location.id, "recorded_at": location.recorded_at}


@router.get("/locations/all", response_model=List[TechnicianLocationResponse])
def get_all_technician_locations(db: Session = Depends(get_db)):
    latest_location_subq = db.query(
        TechnicianLocation.technician_id,
        func.max(TechnicianLocation.recorded_at).label('max_recorded_at')
    ).group_by(TechnicianLocation.technician_id).subquery()
    
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
        recorded_at = location.recorded_at
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
        time_diff = now - recorded_at
        minutes_ago = int(time_diff.total_seconds() / 60)
        
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
def get_technician_location_history(technician_id: int, date_filter: Optional[date] = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(TechnicianLocation).filter(TechnicianLocation.technician_id == technician_id)
    
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
