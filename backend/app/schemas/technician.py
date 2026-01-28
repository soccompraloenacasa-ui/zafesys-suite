"""
ZAFESYS Suite - Technician Schemas
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import re


class TechnicianBase(BaseModel):
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    zone: Optional[str] = None
    specialties: Optional[str] = None


class TechnicianCreate(TechnicianBase):
    user_id: Optional[int] = None
    pin: Optional[str] = None
    
    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v):
        if v is not None:
            if not re.match(r'^\d{4,6}$', v):
                raise ValueError('El PIN debe tener entre 4 y 6 dígitos numéricos')
        return v


class TechnicianUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    zone: Optional[str] = None
    specialties: Optional[str] = None
    pin: Optional[str] = None
    is_available: Optional[bool] = None
    is_active: Optional[bool] = None
    tracking_enabled: Optional[bool] = None
    
    @field_validator('pin')
    @classmethod
    def validate_pin(cls, v):
        if v is not None:
            if not re.match(r'^\d{4,6}$', v):
                raise ValueError('El PIN debe tener entre 4 y 6 dígitos numéricos')
        return v


class TechnicianResponse(TechnicianBase):
    id: int
    user_id: Optional[int] = None
    pin: Optional[str] = None  # Se devuelve para que el admin pueda verlo
    is_available: bool
    is_active: bool
    tracking_enabled: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TechnicianListResponse(BaseModel):
    """Simplified for listing and selection dropdowns."""
    id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    document_id: Optional[str] = None
    zone: Optional[str] = None
    specialties: Optional[str] = None
    pin: Optional[str] = None  # Incluido para gestión desde dashboard
    is_available: bool
    is_active: bool
    tracking_enabled: bool = True

    class Config:
        from_attributes = True
