"""
ZAFESYS Suite - Installation Schemas
"""
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, date, time
from decimal import Decimal
from app.models.installation import InstallationStatus, PaymentStatus, PaymentMethod


# Timer started by type - matches the string values in the model
TimerStartedByType = Literal["admin", "technician"]


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


# Timer Schemas
class TimerStartRequest(BaseModel):
    """Request to start installation timer."""
    started_by: TimerStartedByType


class TimerStopRequest(BaseModel):
    """Request to stop installation timer."""
    pass  # No additional data needed, just stop the timer


class TimerResponse(BaseModel):
    """Response with timer information."""
    installation_id: int
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None
    is_running: bool = False
    elapsed_minutes: Optional[int] = None  # Current elapsed time if running

    class Config:
        from_attributes = True


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
    # Timer fields
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None
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
    product_image: Optional[str] = None
    technician_name: Optional[str] = None
    technician_phone: Optional[str] = None


class InstallationAppResponse(BaseModel):
    """Response for technician app with lead and product details."""
    id: int
    lead_id: int
    product_id: int
    quantity: int
    address: str
    city: Optional[str] = None
    address_notes: Optional[str] = None
    total_price: Decimal
    customer_notes: Optional[str] = None
    technician_id: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    estimated_duration: int = 60
    status: InstallationStatus
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    amount_paid: Decimal = Decimal("0")
    technician_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    timer_started_at: Optional[datetime] = None
    timer_ended_at: Optional[datetime] = None
    timer_started_by: Optional[str] = None
    installation_duration_minutes: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Media
    signature_url: Optional[str] = None
    photos_before: Optional[list[str]] = None
    photos_after: Optional[list[str]] = None
    # Related data
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    product_name: Optional[str] = None
    product_model: Optional[str] = None
    product_image: Optional[str] = None
    technician_name: Optional[str] = None

    class Config:
        from_attributes = True


class TechnicianDaySchedule(BaseModel):
    """Installations for a technician on a specific day."""
    date: date
    installations: list[InstallationResponse]
    total_count: int
