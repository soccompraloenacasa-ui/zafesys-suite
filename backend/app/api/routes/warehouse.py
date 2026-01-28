"""
ZAFESYS Suite - Warehouse API Routes
Endpoints for the Bodega app - managing order preparation and delivery.
"""
import logging
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_

from passlib.context import CryptContext
from app.api.deps import get_db
from app.core.security import create_access_token
from app.config import settings
from app.models.installation import Installation
from app.models.product import Product
from app.models.lead import Lead
from app.models.technician import Technician
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter()


# Pydantic models
class WarehouseUser(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True


class OrderProduct(BaseModel):
    product_id: int
    product_name: str
    product_model: Optional[str] = None
    product_sku: Optional[str] = None
    product_image_url: Optional[str] = None
    quantity: int


class OrderResponse(BaseModel):
    installation_id: int
    client_name: str
    address: str
    city: Optional[str] = None
    scheduled_date: str
    scheduled_time: Optional[str] = None
    technician_name: Optional[str] = None
    technician_id: Optional[int] = None
    products: List[OrderProduct]
    warehouse_status: str
    prepared_by: Optional[str] = None
    prepared_at: Optional[str] = None
    notes: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    user_id: int


class WarehouseLoginRequest(BaseModel):
    email: str
    password: str


class WarehouseLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: WarehouseUser


# ============== ENDPOINTS ==============

@router.post("/login", response_model=WarehouseLoginResponse)
async def warehouse_login(
    request: WarehouseLoginRequest,
    db: Session = Depends(get_db),
):
    """Login for warehouse app users."""
    logger.info(f"POST /warehouse/login called for email: {request.email}")

    # Find user by email
    user = db.query(User).filter(
        User.email == request.email,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos"
        )

    # Verify password
    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Email o contraseña incorrectos"
        )

    # Check role (allow admin and warehouse)
    user_role = user.role if isinstance(user.role, str) else user.role.value
    if user_role not in ['admin', 'warehouse', 'bodega']:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos para acceder a la app de bodega"
        )

    # Create access token
    from datetime import timedelta
    access_token = create_access_token(
        subject=user.id,
        role=user_role,
        expires_delta=timedelta(days=30)
    )

    logger.info(f"Warehouse login successful for user: {user.email}")

    return WarehouseLoginResponse(
        access_token=access_token,
        user=WarehouseUser(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
        )
    )

@router.get("/users", response_model=List[WarehouseUser])
async def get_warehouse_users(db: Session = Depends(get_db)):
    """Get list of users that can work in warehouse (admin and warehouse roles)."""
    logger.info("GET /warehouse/users called")

    # Get users with admin or warehouse role (or all active users for now)
    users = db.query(User).filter(
        User.is_active == True,
        User.role.in_(['admin', 'warehouse', 'bodega'])
    ).all()

    # If no warehouse users found, return all active users
    if not users:
        users = db.query(User).filter(User.is_active == True).all()

    return [
        WarehouseUser(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            is_active=u.is_active,
        )
        for u in users
    ]


@router.get("/orders", response_model=List[OrderResponse])
async def get_warehouse_orders(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by warehouse_status"),
    db: Session = Depends(get_db),
):
    """Get orders/installations for warehouse preparation."""
    logger.info(f"GET /warehouse/orders called: start={start_date}, end={end_date}, status={status}")

    # Default to today if no dates provided
    today = date.today()
    if not start_date:
        start_date = today.isoformat()
    if not end_date:
        end_date = start_date

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Build query
    query = db.query(Installation).filter(
        and_(
            Installation.scheduled_date >= start,
            Installation.scheduled_date <= end,
            Installation.status.in_(['pendiente', 'programada', 'en_camino', 'en_progreso'])
        )
    )

    if status:
        query = query.filter(Installation.warehouse_status == status)

    installations = query.order_by(
        Installation.scheduled_date,
        Installation.scheduled_time
    ).all()

    # Build response
    orders = []
    for inst in installations:
        # Get product info
        product = db.query(Product).filter(Product.id == inst.product_id).first()
        products = []
        if product:
            products.append(OrderProduct(
                product_id=product.id,
                product_name=product.name,
                product_model=product.model,
                product_sku=product.sku,
                product_image_url=product.image_url,
                quantity=inst.quantity or 1,
            ))

        # Get lead/client info
        lead = db.query(Lead).filter(Lead.id == inst.lead_id).first()
        client_name = lead.name if lead else "Cliente"

        # Get technician info
        technician = None
        if inst.technician_id:
            technician = db.query(Technician).filter(Technician.id == inst.technician_id).first()

        # Get prepared_by user name
        prepared_by_name = None
        if inst.prepared_by_id:
            prepared_user = db.query(User).filter(User.id == inst.prepared_by_id).first()
            prepared_by_name = prepared_user.full_name if prepared_user else None

        orders.append(OrderResponse(
            installation_id=inst.id,
            client_name=client_name,
            address=inst.address or "",
            city=inst.city,
            scheduled_date=inst.scheduled_date.isoformat() if inst.scheduled_date else "",
            scheduled_time=str(inst.scheduled_time)[:5] if inst.scheduled_time else None,
            technician_name=technician.full_name if technician else None,
            technician_id=inst.technician_id,
            products=products,
            warehouse_status=inst.warehouse_status or "pendiente",
            prepared_by=prepared_by_name,
            prepared_at=inst.prepared_at.isoformat() if inst.prepared_at else None,
            notes=inst.customer_notes,
        ))

    logger.info(f"Returning {len(orders)} orders")
    return orders


@router.get("/orders/{installation_id}", response_model=OrderResponse)
async def get_order_detail(
    installation_id: int,
    db: Session = Depends(get_db),
):
    """Get detailed order info for a single installation."""
    logger.info(f"GET /warehouse/orders/{installation_id} called")

    inst = db.query(Installation).filter(Installation.id == installation_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get product info
    product = db.query(Product).filter(Product.id == inst.product_id).first()
    products = []
    if product:
        products.append(OrderProduct(
            product_id=product.id,
            product_name=product.name,
            product_model=product.model,
            product_sku=product.sku,
            product_image_url=product.image_url,
            quantity=inst.quantity or 1,
        ))

    # Get lead/client info
    lead = db.query(Lead).filter(Lead.id == inst.lead_id).first()
    client_name = lead.name if lead else "Cliente"

    # Get technician info
    technician = None
    if inst.technician_id:
        technician = db.query(Technician).filter(Technician.id == inst.technician_id).first()

    # Get prepared_by user name
    prepared_by_name = None
    if inst.prepared_by_id:
        prepared_user = db.query(User).filter(User.id == inst.prepared_by_id).first()
        prepared_by_name = prepared_user.full_name if prepared_user else None

    return OrderResponse(
        installation_id=inst.id,
        client_name=client_name,
        address=inst.address or "",
        city=inst.city,
        scheduled_date=inst.scheduled_date.isoformat() if inst.scheduled_date else "",
        scheduled_time=str(inst.scheduled_time)[:5] if inst.scheduled_time else None,
        technician_name=technician.full_name if technician else None,
        technician_id=inst.technician_id,
        products=products,
        warehouse_status=inst.warehouse_status or "pendiente",
        prepared_by=prepared_by_name,
        prepared_at=inst.prepared_at.isoformat() if inst.prepared_at else None,
        notes=inst.customer_notes,
    )


@router.patch("/orders/{installation_id}/prepare", response_model=OrderResponse)
async def mark_as_prepared(
    installation_id: int,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db),
):
    """Mark an order as prepared by warehouse staff."""
    logger.info(f"PATCH /warehouse/orders/{installation_id}/prepare called by user {request.user_id}")

    inst = db.query(Installation).filter(Installation.id == installation_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update status
    inst.warehouse_status = "preparado"
    inst.prepared_by_id = request.user_id
    inst.prepared_at = datetime.utcnow()
    db.commit()
    db.refresh(inst)

    logger.info(f"Order {installation_id} marked as prepared")

    # Return updated order
    return await get_order_detail(installation_id, db)


@router.patch("/orders/{installation_id}/deliver", response_model=OrderResponse)
async def mark_as_delivered(
    installation_id: int,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db),
):
    """Mark an order as delivered to technician."""
    logger.info(f"PATCH /warehouse/orders/{installation_id}/deliver called by user {request.user_id}")

    inst = db.query(Installation).filter(Installation.id == installation_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update status
    inst.warehouse_status = "entregado"
    inst.delivered_by_id = request.user_id
    inst.delivered_at = datetime.utcnow()
    db.commit()
    db.refresh(inst)

    logger.info(f"Order {installation_id} marked as delivered")

    # Return updated order
    return await get_order_detail(installation_id, db)


logger.info("Warehouse router initialized")
