"""
ZAFESYS Suite - Installation Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date, time
from decimal import Decimal
from app.models.installation import InstallationStatus, PaymentStatus, PaymentMethod


class InstallationBase(BaseModel):
    lead_id: int
    product_id: int
    quantity: int = 1
    address: str
    city: Optional[str] = None
    address_notes: Optional[str] = None
    total_price: Decimal
    customer_notes: Optional[str] = None


class InstallationCreate(InstallationBase):
    technician_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None


class InstallationUpdate(BaseModel):
    product_id: Optional[int] = None
    quantity: Optional[int] = None
    technician_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    estimated_duration: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    address_notes: Optional[str] = None
    status: Optional[InstallationStatus] = None
    total_price: Optional[Decimal] = None
    payment_status: Optional[PaymentStatus] = None
    payment_method: Optional[PaymentMethod] = None
    amount_paid: Optional[Decimal] = None
    customer_notes: Optional[str] = None
    technician_notes: Optional[str] = None
    internal_notes: Optional[str] = None


class InstallationStatusUpdate(BaseModel):
    status: InstallationStatus


class InstallationPaymentUpdate(BaseModel):
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    amount_paid: Decimal


class InstallationCompleteRequest(BaseModel):
    technician_notes: Optional[str] = None
    photo_proof_url: Optional[str] = None


class InstallationResponse(InstallationBase):
    id: int
    technician_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    estimated_duration: int
    status: InstallationStatus
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    amount_paid: Decimal
    technician_notes: Optional[str] = None
    internal_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    photo_proof_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InstallationWithDetails(InstallationResponse):
    """Full response with related data for detail views."""
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    product_name: Optional[str] = None
    product_model: Optional[str] = None
    technician_name: Optional[str] = None
    technician_phone: Optional[str] = None


class TechnicianDaySchedule(BaseModel):
    """Installations for a technician on a specific day."""
    date: date
    installations: list[InstallationResponse]
    total_count: int
