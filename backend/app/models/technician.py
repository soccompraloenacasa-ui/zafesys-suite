"""
ZAFESYS Suite - Technician Model
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
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

    # Auth for mobile app (simple PIN)
    pin = Column(String(6), nullable=True)  # 4-6 digit PIN for tech app login

    # Status
    is_available = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    
    # GPS Tracking - enabled by default for work hours
    tracking_enabled = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    installations = relationship("Installation", back_populates="technician")
    locations = relationship("TechnicianLocation", back_populates="technician", order_by="desc(TechnicianLocation.recorded_at)")


class TechnicianLocation(Base):
    """
    GPS location history for technicians.
    Records location every 2-3 minutes during work hours.
    """
    __tablename__ = "technician_locations"

    id = Column(Integer, primary_key=True, index=True)
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=False, index=True)
    
    # GPS coordinates
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)  # GPS accuracy in meters
    
    # Optional context
    speed = Column(Float, nullable=True)  # Speed in m/s if available
    heading = Column(Float, nullable=True)  # Direction in degrees
    altitude = Column(Float, nullable=True)
    
    # Battery level (useful to know if phone is dying)
    battery_level = Column(Integer, nullable=True)  # 0-100
    
    # Activity context
    activity = Column(String(50), nullable=True)  # idle, moving, at_installation
    installation_id = Column(Integer, ForeignKey("installations.id"), nullable=True)
    
    # Timestamp
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    technician = relationship("Technician", back_populates="locations")
    installation = relationship("Installation")
