"""
ZAFESYS Suite - Distributor Schemas
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# ============ Distributor Schemas ============

class DistributorBase(BaseModel):
    name: str
    company_name: Optional[str] = None
    nit: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None
    discount_percentage: Decimal = Decimal("0")


class DistributorCreate(DistributorBase):
    pass


class DistributorUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    nit: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zone: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None
    discount_percentage: Optional[Decimal] = None
    is_active: Optional[bool] = None


class DistributorResponse(DistributorBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DistributorListResponse(BaseModel):
    """Simplified for list views."""
    id: int
    name: str
    company_name: Optional[str] = None
    phone: str
    city: Optional[str] = None
    discount_percentage: Decimal = Decimal("0")
    is_active: bool
    total_sales: Optional[Decimal] = None  # Computed field
    total_units: Optional[int] = None  # Computed field

    class Config:
        from_attributes = True


# ============ Distributor Sale Schemas ============

class DistributorSaleBase(BaseModel):
    distributor_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    sale_date: date
    invoice_number: Optional[str] = None
    payment_status: str = "pendiente"
    amount_paid: Decimal = Decimal("0")
    notes: Optional[str] = None


class DistributorSaleCreate(BaseModel):
    distributor_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    sale_date: date
    invoice_number: Optional[str] = None
    notes: Optional[str] = None


class DistributorSaleUpdate(BaseModel):
    quantity: Optional[int] = None
    unit_price: Optional[Decimal] = None
    sale_date: Optional[date] = None
    invoice_number: Optional[str] = None
    payment_status: Optional[str] = None
    amount_paid: Optional[Decimal] = None
    notes: Optional[str] = None


class DistributorSaleResponse(DistributorSaleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Include related data
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    distributor_name: Optional[str] = None

    class Config:
        from_attributes = True


class DistributorSaleListResponse(BaseModel):
    """For list views with minimal data."""
    id: int
    distributor_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    sale_date: date
    payment_status: str
    product_name: Optional[str] = None
    distributor_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Distributor with Sales ============

class DistributorWithSales(DistributorResponse):
    """Distributor with their sales history."""
    sales: List[DistributorSaleListResponse] = []
    total_sales_amount: Decimal = Decimal("0")
    total_units_sold: int = 0
