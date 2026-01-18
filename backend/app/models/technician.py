"""
ZAFESYS Suite - Technician Model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)

    # Link to user account (optional - technician may have login)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    user = relationship("User", foreign_keys=[user_id])

    # Personal info
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)

    # Work info
    document_id = Column(String(20), nullable=True)  # Cedula
    zone = Column(String(100), nullable=True)  # Area they cover
    specialties = Column(Text, nullable=True)  # Types of locks they can install

    # Status
    is_available = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    installations = relationship("Installation", back_populates="technician")
