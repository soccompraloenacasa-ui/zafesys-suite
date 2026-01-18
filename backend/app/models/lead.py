"""
ZAFESYS Suite - Lead Model
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class LeadStatus(str, enum.Enum):
    NUEVO = "nuevo"
    EN_CONVERSACION = "en_conversacion"
    POTENCIAL = "potencial"
    VENTA_CERRADA = "venta_cerrada"
    PERDIDO = "perdido"


class LeadSource(str, enum.Enum):
    WEBSITE = "website"
    WHATSAPP = "whatsapp"
    ELEVENLABS = "elevenlabs"  # Legacy
    ANA_VOICE = "ana_voice"  # Ana voice assistant (ElevenLabs)
    REFERIDO = "referido"
    OTRO = "otro"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)

    # Contact info
    name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)

    # Lead info
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.NUEVO, nullable=False, index=True)
    source = Column(SQLEnum(LeadSource), default=LeadSource.WEBSITE, nullable=False)
    notes = Column(Text, nullable=True)

    # Product interest
    product_interest = Column(String(255), nullable=True)  # Model they're interested in

    # Assignment
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])

    # ElevenLabs conversation data
    elevenlabs_conversation_id = Column(String(255), nullable=True)
    conversation_transcript = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    contacted_at = Column(DateTime(timezone=True), nullable=True)
