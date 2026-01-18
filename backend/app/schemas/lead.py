"""
ZAFESYS Suite - Lead Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.lead import LeadStatus, LeadSource


class LeadBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    source: LeadSource = LeadSource.WEBSITE
    notes: Optional[str] = None
    product_interest: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: Optional[LeadStatus] = None
    source: Optional[LeadSource] = None
    notes: Optional[str] = None
    product_interest: Optional[str] = None
    assigned_to_id: Optional[int] = None


class LeadStatusUpdate(BaseModel):
    status: LeadStatus


class LeadResponse(LeadBase):
    id: int
    status: LeadStatus
    assigned_to_id: Optional[int] = None
    elevenlabs_conversation_id: Optional[str] = None
    conversation_transcript: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadKanbanResponse(BaseModel):
    """Simplified response for kanban board."""
    id: int
    name: str
    phone: str
    status: LeadStatus
    source: LeadSource
    product_interest: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ElevenLabs Webhook
class ElevenLabsWebhookPayload(BaseModel):
    """Payload from ElevenLabs conversation webhook."""
    conversation_id: str
    agent_id: Optional[str] = None
    status: Optional[str] = None
    transcript: Optional[str] = None
    # Customer data extracted from conversation
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    product_interest: Optional[str] = None
    notes: Optional[str] = None
