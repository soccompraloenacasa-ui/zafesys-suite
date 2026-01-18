"""
ZAFESYS Suite - Product Routes
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_admin
from app import crud
from app.schemas import (
    ProductCreate, ProductUpdate, ProductResponse, ProductListResponse, ProductStockUpdate
)
from app.models import User

router = APIRouter()


@router.get("/", response_model=List[ProductListResponse])
def get_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
):
    """Get all products."""
    if active_only:
        return crud.product.get_active(db, skip=skip, limit=limit)
    return crud.product.get_multi(db, skip=skip, limit=limit)


@router.get("/search", response_model=List[ProductListResponse])
def search_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    q: str = Query(..., min_length=2)
):
    """Search products by name, model, or SKU."""
    return crud.product.search(db, query=q)


@router.get("/low-stock", response_model=List[ProductListResponse])
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get products with low stock."""
    return crud.product.get_low_stock(db)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific product."""
    product = crud.product.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    return product


@router.post("/", response_model=ProductResponse)
def create_product(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    product_in: ProductCreate
):
    """Create a new product (admin only)."""
    existing = crud.product.get_by_sku(db, sku=product_in.sku)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product with this SKU already exists"
        )
    product = crud.product.create(db, obj_in=product_in)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    product_in: ProductUpdate
):
    """Update a product (admin only)."""
    product = crud.product.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    product = crud.product.update(db, db_obj=product, obj_in=product_in)
    return product


@router.patch("/{product_id}/stock", response_model=ProductResponse)
def update_product_stock(
    product_id: int,
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    stock_in: ProductStockUpdate
):
    """Update product stock."""
    product = crud.product.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    product = crud.product.update_stock(db, db_obj=product, quantity=stock_in.stock)
    return product


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a product (admin only)."""
    product = crud.product.get(db, id=product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    crud.product.remove(db, id=product_id)
    return {"message": "Product deleted"}
