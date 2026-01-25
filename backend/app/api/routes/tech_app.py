"""
ZAFESYS Suite - Technician Mobile App Routes
Endpoints for the technician PWA
"""
from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db
from app import crud
from app.models.technician import Technician
from app.models.installation import Installation, InstallationStatus, PaymentStatus, PaymentMethod
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
            customer_notes=inst.customer_notes
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
        customer_notes=installation.customer_notes
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
        installation.completed_at = datetime.now()

    db.add(installation)
    db.commit()

    return {"message": "Estado actualizado", "status": request.status}


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

    installation.status = InstallationStatus.COMPLETADA
    installation.completed_at = datetime.now()

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
        "is_active": technician.is_active
    }
