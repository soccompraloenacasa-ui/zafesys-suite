"""
ZAFESYS Suite - Lead Schemas
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
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


# ElevenLabs Webhook Schemas
class ElevenLabsTranscriptMessage(BaseModel):
    """Single message in the conversation transcript."""
    role: str  # "agent" or "user"
    message: str
    time_in_call_secs: Optional[float] = None


class ElevenLabsAnalysisData(BaseModel):
    """Analysis data from ElevenLabs (if configured in agent)."""
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    product_interest: Optional[str] = None
    interest_level: Optional[str] = None  # "high", "medium", "low"
    summary: Optional[str] = None


class ElevenLabsWebhookPayload(BaseModel):
    """
    Payload from ElevenLabs conversation webhook.

    ElevenLabs sends this data when a conversation ends.
    The actual structure may vary, so we handle multiple formats.
    """
    # Required fields
    conversation_id: str

    # Agent info
    agent_id: Optional[str] = None

    # Conversation status
    status: Optional[str] = None  # "ended", "error", etc.

    # Transcript - can be string or array of messages
    transcript: Optional[Any] = None  # str or List[ElevenLabsTranscriptMessage]

    # Analysis data (if agent has data extraction configured)
    analysis: Optional[ElevenLabsAnalysisData] = None

    # Alternative: data extracted directly from collection
    collected_data: Optional[Dict[str, Any]] = None
    data_collection: Optional[Dict[str, Any]] = None

    # Call metadata
    call_duration_secs: Optional[float] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    # Fallback fields for simpler payloads
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    product_interest: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        extra = "allow"  # Allow extra fields we don't know about
