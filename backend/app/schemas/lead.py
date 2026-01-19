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


# ============================================================
# ElevenLabs Webhook Schemas
# ============================================================

class ElevenLabsTranscriptMessage(BaseModel):
    """Single message in the conversation transcript."""
    role: str  # "agent" or "user"
    message: Optional[str] = None
    time_in_call_secs: Optional[float] = None
    # Additional fields that might be present
    agent_metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"


class ElevenLabsAnalysisData(BaseModel):
    """Analysis data from ElevenLabs (if configured in agent)."""
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    product_interest: Optional[str] = None
    interest_level: Optional[str] = None
    summary: Optional[str] = None

    class Config:
        extra = "allow"


class ElevenLabsConversationData(BaseModel):
    """
    Inner data object from ElevenLabs webhook.
    This is the actual conversation data inside the "data" field.
    """
    conversation_id: str
    agent_id: Optional[str] = None
    status: Optional[str] = None  # "done", "error", etc.

    # Transcript - array of messages
    transcript: Optional[List[Dict[str, Any]]] = None

    # Analysis data (if configured)
    analysis: Optional[ElevenLabsAnalysisData] = None

    # Data collection
    collected_data: Optional[Dict[str, Any]] = None
    data_collection: Optional[Dict[str, Any]] = None

    # Call metadata
    call_duration_secs: Optional[float] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

    # Additional fields
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"


class ElevenLabsWebhookPayload(BaseModel):
    """
    Full webhook payload from ElevenLabs.

    Structure:
    {
        "type": "post_call_transcription",
        "event_timestamp": 1768821764,
        "data": {
            "agent_id": "...",
            "conversation_id": "...",
            "status": "done",
            "transcript": [...]
        }
    }
    """
    # Wrapper fields
    type: Optional[str] = None  # "post_call_transcription", etc.
    event_timestamp: Optional[int] = None

    # Nested data object
    data: Optional[ElevenLabsConversationData] = None

    # Fallback: Allow flat structure too (in case format changes)
    conversation_id: Optional[str] = None
    agent_id: Optional[str] = None
    status: Optional[str] = None
    transcript: Optional[Any] = None
    analysis: Optional[ElevenLabsAnalysisData] = None

    class Config:
        extra = "allow"

    def get_conversation_id(self) -> Optional[str]:
        """Get conversation_id from nested data or flat structure."""
        if self.data and self.data.conversation_id:
            return self.data.conversation_id
        return self.conversation_id

    def get_agent_id(self) -> Optional[str]:
        """Get agent_id from nested data or flat structure."""
        if self.data and self.data.agent_id:
            return self.data.agent_id
        return self.agent_id

    def get_transcript(self) -> Optional[Any]:
        """Get transcript from nested data or flat structure."""
        if self.data and self.data.transcript:
            return self.data.transcript
        return self.transcript

    def get_status(self) -> Optional[str]:
        """Get status from nested data or flat structure."""
        if self.data and self.data.status:
            return self.data.status
        return self.status

    def get_analysis(self) -> Optional[ElevenLabsAnalysisData]:
        """Get analysis from nested data or flat structure."""
        if self.data and self.data.analysis:
            return self.data.analysis
        return self.analysis

    def get_collected_data(self) -> Optional[Dict[str, Any]]:
        """Get collected_data from nested data."""
        if self.data:
            return self.data.collected_data or self.data.data_collection
        return None
