"""
ZAFESYS Suite - Product Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProductBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    model: str
    price: Decimal
    supplier_cost: Optional[Decimal] = None  # Precio proveedor
    installation_price: Decimal = Decimal("0")
    stock: int = 0
    min_stock_alert: int = 5
    features: Optional[str] = None
    image_url: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    price: Optional[Decimal] = None
    supplier_cost: Optional[Decimal] = None
    installation_price: Optional[Decimal] = None
    stock: Optional[int] = None
    min_stock_alert: Optional[int] = None
    features: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


class ProductStockUpdate(BaseModel):
    """For updating stock only."""
    stock: int


class ProductResponse(ProductBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Simplified for list views - includes image_url for thumbnails."""
    id: int
    sku: str
    name: str
    model: str
    price: Decimal
    supplier_cost: Optional[Decimal] = None
    installation_price: Decimal = Decimal("0")
    stock: int
    min_stock_alert: int = 5
    is_active: bool
    image_url: Optional[str] = None

    class Config:
        from_attributes = True
