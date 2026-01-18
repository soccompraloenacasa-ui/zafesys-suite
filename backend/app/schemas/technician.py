"""
ZAFESYS Suite - Technician Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class TechnicianBase(BaseModel):
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    zone: Optional[str] = None
    specialties: Optional[str] = None


class TechnicianCreate(TechnicianBase):
    user_id: Optional[int] = None


class TechnicianUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    zone: Optional[str] = None
    specialties: Optional[str] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None


class TechnicianResponse(TechnicianBase):
    id: int
    user_id: Optional[int] = None
    is_available: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TechnicianListResponse(BaseModel):
    """Simplified for selection dropdowns."""
    id: int
    full_name: str
    phone: str
    zone: Optional[str] = None
    is_available: bool

    class Config:
        from_attributes = True
