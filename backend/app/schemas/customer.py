"""
ZAFESYS Suite - Customer Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    document_type: Optional[str] = None  # CC, NIT, CE
    document_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    lead_id: Optional[int] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    """Simplified for list views."""
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
