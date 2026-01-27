"""
ZAFESYS Suite - Lead CRUD Operations
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models import Lead, LeadStatus, LeadSource
from app.schemas import LeadCreate, LeadUpdate


class CRUDLead(CRUDBase[Lead, LeadCreate, LeadUpdate]):
    """CRUD operations for Lead model."""

    def get_by_phone(self, db: Session, *, phone: str) -> Optional[Lead]:
        """Get lead by phone number."""
        return db.query(Lead).filter(Lead.phone == phone).first()

    def get_by_status(
        self,
        db: Session,
        *,
        status: LeadStatus,
        skip: int = 0,
        limit: int = 100
    ) -> List[Lead]:
        """Get leads by status."""
        return (
            db.query(Lead)
            .filter(Lead.status == status.value)
            .order_by(Lead.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_kanban_data(self, db: Session) -> dict:
        """Get leads organized by status for kanban board."""
        leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
        kanban = {status.value: [] for status in LeadStatus}
        for lead in leads:
            kanban[lead.status].append(lead)
        return kanban

    def update_status(
        self,
        db: Session,
        *,
        db_obj: Lead,
        status: LeadStatus
    ) -> Lead:
        """Update lead status."""
        db_obj.status = status.value
        if status == LeadStatus.EN_CONVERSACION and not db_obj.contacted_at:
            db_obj.contacted_at = datetime.utcnow()
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_elevenlabs_conversation(
        self,
        db: Session,
        *,
        conversation_id: str
    ) -> Optional[Lead]:
        """Get lead by ElevenLabs conversation ID."""
        return (
            db.query(Lead)
            .filter(Lead.elevenlabs_conversation_id == conversation_id)
            .first()
        )

    def create_from_elevenlabs(
        self,
        db: Session,
        *,
        conversation_id: str,
        name: str,
        phone: str,
        email: Optional[str] = None,
        address: Optional[str] = None,
        product_interest: Optional[str] = None,
        transcript: Optional[str] = None,
        notes: Optional[str] = None,
        status: LeadStatus = LeadStatus.NUEVO,
        source: LeadSource = LeadSource.ANA_VOICE,
    ) -> Lead:
        """Create a lead from ElevenLabs/Ana voice conversation data."""
        db_obj = Lead(
            name=name,
            phone=phone,
            email=email,
            address=address,
            source=source.value,
            product_interest=product_interest,
            elevenlabs_conversation_id=conversation_id,
            conversation_transcript=transcript,
            notes=notes,
            status=status.value,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def count_by_status(self, db: Session) -> dict:
        """Count leads by status."""
        counts = {}
        for status in LeadStatus:
            counts[status.value] = (
                db.query(Lead)
                .filter(Lead.status == status.value)
                .count()
            )
        return counts


lead = CRUDLead(Lead)
