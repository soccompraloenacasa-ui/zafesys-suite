"""
ZAFESYS Suite - Inventory API Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.product import Product
from app.models.inventory import InventoryMovement
from app.models.installation import Installation
from app.schemas.inventory import (
    InventoryMovementCreate,
    InventoryMovementResponse,
    ProductInventoryResponse,
    InventorySummary,
    StockAdjustmentRequest,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def calculate_product_stats(db: Session, product: Product) -> dict:
    """Calculate sales statistics for a product"""
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    # Count installations (sales) in last 30 days
    sold_30d = db.query(func.count(Installation.id)).filter(
        and_(
            Installation.product_id == product.id,
            Installation.status == "completada",
            Installation.created_at >= thirty_days_ago
        )
    ).scalar() or 0
    
    # Count installations (sales) in last 7 days
    sold_7d = db.query(func.count(Installation.id)).filter(
        and_(
            Installation.product_id == product.id,
            Installation.status == "completada",
            Installation.created_at >= seven_days_ago
        )
    ).scalar() or 0
    
    # Calculate average daily sales
    avg_daily = sold_30d / 30 if sold_30d > 0 else 0
    
    # Estimate days of stock remaining
    days_of_stock = None
    if avg_daily > 0 and product.stock > 0:
        days_of_stock = int(product.stock / avg_daily)
    
    return {
        "total_sold_30d": sold_30d,
        "total_sold_7d": sold_7d,
        "avg_daily_sales": round(avg_daily, 2),
        "days_of_stock": days_of_stock
    }


def get_product_alerts(product: Product, stats: dict) -> List[str]:
    """Generate alerts for a product based on stock and sales"""
    alerts = []
    
    # Stock alerts
    if product.stock <= 0:
        alerts.append("🚨 SIN STOCK - Producto agotado")
    elif product.stock <= product.min_stock_alert:
        alerts.append(f"⚠️ STOCK BAJO - Solo quedan {product.stock} unidades")
    
    # Days of stock alert
    if stats["days_of_stock"] is not None and stats["days_of_stock"] <= 7:
        alerts.append(f"⏰ REABASTECIMIENTO - Stock para ~{stats['days_of_stock']} días")
    
    # Slow moving product alert
    if stats["total_sold_30d"] == 0 and product.stock > 0:
        alerts.append("📉 PRODUCTO LENTO - Sin ventas en 30 días")
    elif stats["total_sold_30d"] <= 2 and product.stock > 10:
        alerts.append(f"📊 MOVIMIENTO LENTO - Solo {stats['total_sold_30d']} ventas en 30 días")
    
    return alerts


def get_stock_status(product: Product) -> str:
    """Determine stock status"""
    if product.stock <= 0:
        return "critical"
    elif product.stock <= product.min_stock_alert:
        return "low"
    return "ok"


@router.get("/summary", response_model=InventorySummary)
def get_inventory_summary(db: Session = Depends(get_db)):
    """Get overall inventory summary with alerts"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    
    # Get all active products
    products = db.query(Product).filter(Product.is_active == True).all()
    
    total_products = len(products)
    total_stock_value = sum(float(p.price) * p.stock for p in products)
    products_low_stock = sum(1 for p in products if 0 < p.stock <= p.min_stock_alert)
    products_out_of_stock = sum(1 for p in products if p.stock <= 0)
    
    # Count slow moving products (no sales in 30 days but has stock)
    products_slow_moving = 0
    for product in products:
        if product.stock > 0:
            sold_30d = db.query(func.count(Installation.id)).filter(
                and_(
                    Installation.product_id == product.id,
                    Installation.status == "completada",
                    Installation.created_at >= thirty_days_ago
                )
            ).scalar() or 0
            if sold_30d <= 2:
                products_slow_moving += 1
    
    # Count movements
    movements_today = db.query(func.count(InventoryMovement.id)).filter(
        InventoryMovement.created_at >= today_start
    ).scalar() or 0
    
    movements_week = db.query(func.count(InventoryMovement.id)).filter(
        InventoryMovement.created_at >= week_start
    ).scalar() or 0
    
    return InventorySummary(
        total_products=total_products,
        total_stock_value=round(total_stock_value, 2),
        products_low_stock=products_low_stock,
        products_out_of_stock=products_out_of_stock,
        products_slow_moving=products_slow_moving,
        total_movements_today=movements_today,
        total_movements_week=movements_week
    )


@router.get("/products", response_model=List[ProductInventoryResponse])
def get_products_inventory(
    include_inactive: bool = False,
    only_alerts: bool = False,
    db: Session = Depends(get_db)
):
    """Get all products with inventory status and alerts"""
    query = db.query(Product)
    if not include_inactive:
        query = query.filter(Product.is_active == True)
    
    products = query.all()
    result = []
    
    for product in products:
        stats = calculate_product_stats(db, product)
        alerts = get_product_alerts(product, stats)
        stock_status = get_stock_status(product)
        
        # Skip if only_alerts is True and no alerts
        if only_alerts and not alerts:
            continue
        
        result.append(ProductInventoryResponse(
            id=product.id,
            sku=product.sku,
            name=product.name,
            model=product.model,
            stock=product.stock,
            min_stock_alert=product.min_stock_alert,
            price=float(product.price),
            is_active=product.is_active,
            image_url=product.image_url,
            stock_status=stock_status,
            total_sold_30d=stats["total_sold_30d"],
            total_sold_7d=stats["total_sold_7d"],
            avg_daily_sales=stats["avg_daily_sales"],
            days_of_stock=stats["days_of_stock"],
            alerts=alerts
        ))
    
    # Sort by alerts (products with alerts first, then by stock)
    result.sort(key=lambda x: (len(x.alerts) == 0, x.stock))
    
    return result


@router.get("/movements", response_model=List[InventoryMovementResponse])
def get_inventory_movements(
    product_id: int = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get inventory movements history"""
    query = db.query(InventoryMovement).order_by(InventoryMovement.created_at.desc())
    
    if product_id:
        query = query.filter(InventoryMovement.product_id == product_id)
    
    movements = query.limit(limit).all()
    
    result = []
    for movement in movements:
        product = db.query(Product).filter(Product.id == movement.product_id).first()
        result.append(InventoryMovementResponse(
            id=movement.id,
            product_id=movement.product_id,
            movement_type=movement.movement_type,
            quantity=movement.quantity,
            stock_before=movement.stock_before,
            stock_after=movement.stock_after,
            reference_type=movement.reference_type,
            reference_id=movement.reference_id,
            notes=movement.notes,
            created_by=movement.created_by,
            created_at=movement.created_at,
            product_name=product.name if product else None,
            product_model=product.model if product else None
        ))
    
    return result


@router.post("/movements", response_model=InventoryMovementResponse)
def create_inventory_movement(
    movement: InventoryMovementCreate,
    db: Session = Depends(get_db)
):
    """Create a manual inventory movement (entry or exit)"""
    product = db.query(Product).filter(Product.id == movement.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    stock_before = product.stock
    
    # Calculate new stock
    if movement.movement_type == "entrada":
        new_stock = stock_before + abs(movement.quantity)
    elif movement.movement_type == "salida":
        new_stock = stock_before - abs(movement.quantity)
        if new_stock < 0:
            raise HTTPException(status_code=400, detail="Stock insuficiente")
    else:  # ajuste
        new_stock = movement.quantity  # Direct set
    
    # Update product stock
    product.stock = new_stock
    
    # Create movement record
    db_movement = InventoryMovement(
        product_id=movement.product_id,
        movement_type=movement.movement_type,
        quantity=movement.quantity if movement.movement_type == "entrada" else -abs(movement.quantity),
        stock_before=stock_before,
        stock_after=new_stock,
        reference_type="manual",
        notes=movement.notes,
        created_by=movement.created_by
    )
    
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    
    return InventoryMovementResponse(
        id=db_movement.id,
        product_id=db_movement.product_id,
        movement_type=db_movement.movement_type,
        quantity=db_movement.quantity,
        stock_before=db_movement.stock_before,
        stock_after=db_movement.stock_after,
        reference_type=db_movement.reference_type,
        reference_id=db_movement.reference_id,
        notes=db_movement.notes,
        created_by=db_movement.created_by,
        created_at=db_movement.created_at,
        product_name=product.name,
        product_model=product.model
    )


@router.post("/adjust-stock", response_model=InventoryMovementResponse)
def adjust_stock(
    adjustment: StockAdjustmentRequest,
    db: Session = Depends(get_db)
):
    """Adjust stock to a specific value (for inventory counts)"""
    product = db.query(Product).filter(Product.id == adjustment.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    stock_before = product.stock
    difference = adjustment.new_stock - stock_before
    
    # Update product stock
    product.stock = adjustment.new_stock
    
    # Create movement record
    db_movement = InventoryMovement(
        product_id=adjustment.product_id,
        movement_type="ajuste",
        quantity=difference,
        stock_before=stock_before,
        stock_after=adjustment.new_stock,
        reference_type="stock_adjustment",
        notes=adjustment.reason,
        created_by=adjustment.created_by
    )
    
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    
    return InventoryMovementResponse(
        id=db_movement.id,
        product_id=db_movement.product_id,
        movement_type=db_movement.movement_type,
        quantity=db_movement.quantity,
        stock_before=db_movement.stock_before,
        stock_after=db_movement.stock_after,
        reference_type=db_movement.reference_type,
        reference_id=db_movement.reference_id,
        notes=db_movement.notes,
        created_by=db_movement.created_by,
        created_at=db_movement.created_at,
        product_name=product.name,
        product_model=product.model
    )
