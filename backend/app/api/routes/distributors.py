"""
ZAFESYS Suite - Distributor API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from decimal import Decimal

from app.api.deps import get_db
from app.models.distributor import Distributor, DistributorSale
from app.models.product import Product
from app.schemas.distributor import (
    DistributorCreate, DistributorUpdate, DistributorResponse, 
    DistributorListResponse, DistributorWithSales,
    DistributorSaleCreate, DistributorSaleUpdate, 
    DistributorSaleResponse, DistributorSaleListResponse
)

router = APIRouter()


# ============ Distributor Routes ============

@router.get("/", response_model=List[DistributorListResponse])
def get_distributors(
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """Get all distributors with sales summary."""
    query = db.query(Distributor)
    if not include_inactive:
        query = query.filter(Distributor.is_active == True)
    
    distributors = query.order_by(Distributor.created_at.desc()).offset(skip).limit(limit).all()
    
    # Add computed fields
    result = []
    for dist in distributors:
        # Calculate totals
        sales_data = db.query(
            func.sum(DistributorSale.total_price).label('total_sales'),
            func.sum(DistributorSale.quantity).label('total_units')
        ).filter(DistributorSale.distributor_id == dist.id).first()
        
        dist_dict = {
            "id": dist.id,
            "name": dist.name,
            "company_name": dist.company_name,
            "phone": dist.phone,
            "city": dist.city,
            "discount_percentage": dist.discount_percentage,
            "is_active": dist.is_active,
            "total_sales": sales_data.total_sales or Decimal("0"),
            "total_units": sales_data.total_units or 0
        }
        result.append(dist_dict)
    
    return result


@router.get("/{distributor_id}", response_model=DistributorWithSales)
def get_distributor(distributor_id: int, db: Session = Depends(get_db)):
    """Get a specific distributor with their sales history."""
    distributor = db.query(Distributor).filter(Distributor.id == distributor_id).first()
    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distributor not found"
        )
    
    # Get sales with product info
    sales = db.query(DistributorSale).options(
        joinedload(DistributorSale.product)
    ).filter(
        DistributorSale.distributor_id == distributor_id
    ).order_by(DistributorSale.sale_date.desc()).all()
    
    # Calculate totals
    total_sales = sum(s.total_price for s in sales) if sales else Decimal("0")
    total_units = sum(s.quantity for s in sales) if sales else 0
    
    # Format sales
    sales_list = []
    for sale in sales:
        sales_list.append({
            "id": sale.id,
            "distributor_id": sale.distributor_id,
            "product_id": sale.product_id,
            "quantity": sale.quantity,
            "unit_price": sale.unit_price,
            "total_price": sale.total_price,
            "sale_date": sale.sale_date,
            "payment_status": sale.payment_status,
            "product_name": sale.product.name if sale.product else None,
            "distributor_name": distributor.name
        })
    
    return {
        **distributor.__dict__,
        "sales": sales_list,
        "total_sales_amount": total_sales,
        "total_units_sold": total_units
    }


@router.post("/", response_model=DistributorResponse, status_code=status.HTTP_201_CREATED)
def create_distributor(distributor_data: DistributorCreate, db: Session = Depends(get_db)):
    """Create a new distributor."""
    distributor = Distributor(**distributor_data.model_dump())
    db.add(distributor)
    db.commit()
    db.refresh(distributor)
    return distributor


@router.put("/{distributor_id}", response_model=DistributorResponse)
def update_distributor(
    distributor_id: int,
    distributor_data: DistributorUpdate,
    db: Session = Depends(get_db)
):
    """Update a distributor."""
    distributor = db.query(Distributor).filter(Distributor.id == distributor_id).first()
    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distributor not found"
        )
    
    update_data = distributor_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(distributor, field, value)
    
    db.commit()
    db.refresh(distributor)
    return distributor


@router.delete("/{distributor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_distributor(distributor_id: int, db: Session = Depends(get_db)):
    """Soft delete a distributor."""
    distributor = db.query(Distributor).filter(Distributor.id == distributor_id).first()
    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distributor not found"
        )
    
    distributor.is_active = False
    db.commit()
    return None


# ============ Distributor Sale Routes ============

@router.get("/sales/all", response_model=List[DistributorSaleListResponse])
def get_all_sales(
    skip: int = 0,
    limit: int = 100,
    distributor_id: Optional[int] = None,
    product_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get all distributor sales with filters."""
    query = db.query(DistributorSale).options(
        joinedload(DistributorSale.product),
        joinedload(DistributorSale.distributor)
    )
    
    if distributor_id:
        query = query.filter(DistributorSale.distributor_id == distributor_id)
    if product_id:
        query = query.filter(DistributorSale.product_id == product_id)
    if from_date:
        query = query.filter(DistributorSale.sale_date >= from_date)
    if to_date:
        query = query.filter(DistributorSale.sale_date <= to_date)
    
    sales = query.order_by(DistributorSale.sale_date.desc()).offset(skip).limit(limit).all()
    
    result = []
    for sale in sales:
        result.append({
            "id": sale.id,
            "distributor_id": sale.distributor_id,
            "product_id": sale.product_id,
            "quantity": sale.quantity,
            "unit_price": sale.unit_price,
            "total_price": sale.total_price,
            "sale_date": sale.sale_date,
            "payment_status": sale.payment_status,
            "product_name": sale.product.name if sale.product else None,
            "distributor_name": sale.distributor.name if sale.distributor else None
        })
    
    return result


@router.post("/{distributor_id}/sales", response_model=DistributorSaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    distributor_id: int,
    sale_data: DistributorSaleCreate,
    db: Session = Depends(get_db)
):
    """Create a new sale for a distributor."""
    # Verify distributor exists
    distributor = db.query(Distributor).filter(Distributor.id == distributor_id).first()
    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distributor not found"
        )
    
    # Verify product exists
    product = db.query(Product).filter(Product.id == sale_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Calculate total price
    total_price = sale_data.unit_price * sale_data.quantity
    
    sale = DistributorSale(
        distributor_id=distributor_id,
        product_id=sale_data.product_id,
        quantity=sale_data.quantity,
        unit_price=sale_data.unit_price,
        total_price=total_price,
        sale_date=sale_data.sale_date,
        invoice_number=sale_data.invoice_number,
        notes=sale_data.notes
    )
    
    # Update product stock
    if product.stock >= sale_data.quantity:
        product.stock -= sale_data.quantity
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough stock. Available: {product.stock}"
        )
    
    db.add(sale)
    db.commit()
    db.refresh(sale)
    
    return {
        **sale.__dict__,
        "product_name": product.name,
        "product_sku": product.sku,
        "distributor_name": distributor.name
    }


@router.put("/sales/{sale_id}", response_model=DistributorSaleResponse)
def update_sale(
    sale_id: int,
    sale_data: DistributorSaleUpdate,
    db: Session = Depends(get_db)
):
    """Update a sale (mainly for payment status)."""
    sale = db.query(DistributorSale).options(
        joinedload(DistributorSale.product),
        joinedload(DistributorSale.distributor)
    ).filter(DistributorSale.id == sale_id).first()
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found"
        )
    
    update_data = sale_data.model_dump(exclude_unset=True)
    
    # Recalculate total if quantity or unit_price changed
    if 'quantity' in update_data or 'unit_price' in update_data:
        qty = update_data.get('quantity', sale.quantity)
        price = update_data.get('unit_price', sale.unit_price)
        update_data['total_price'] = qty * price
    
    for field, value in update_data.items():
        setattr(sale, field, value)
    
    db.commit()
    db.refresh(sale)
    
    return {
        **sale.__dict__,
        "product_name": sale.product.name if sale.product else None,
        "product_sku": sale.product.sku if sale.product else None,
        "distributor_name": sale.distributor.name if sale.distributor else None
    }


@router.delete("/sales/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sale(sale_id: int, db: Session = Depends(get_db)):
    """Delete a sale and restore stock."""
    sale = db.query(DistributorSale).filter(DistributorSale.id == sale_id).first()
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found"
        )
    
    # Restore product stock
    product = db.query(Product).filter(Product.id == sale.product_id).first()
    if product:
        product.stock += sale.quantity
    
    db.delete(sale)
    db.commit()
    return None
