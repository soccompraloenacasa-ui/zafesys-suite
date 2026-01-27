"""
ZAFESYS Suite - Installation Model
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, Date, Time, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class InstallationStatus(str, enum.Enum):
    PENDIENTE = "pendiente"           # Waiting for scheduling
    PROGRAMADA = "programada"         # Scheduled
    EN_CAMINO = "en_camino"           # Technician on the way
    EN_PROGRESO = "en_progreso"       # Installation in progress
    COMPLETADA = "completada"         # Done
    CANCELADA = "cancelada"           # Cancelled


class PaymentStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    PARCIAL = "parcial"
    PAGADO = "pagado"


class PaymentMethod(str, enum.Enum):
    EFECTIVO = "efectivo"
    TRANSFERENCIA = "transferencia"
    TARJETA = "tarjeta"
    NEQUI = "nequi"
    DAVIPLATA = "daviplata"


# Timer started by - use string values directly
TIMER_STARTED_BY_ADMIN = "admin"
TIMER_STARTED_BY_TECHNICIAN = "technician"


class Installation(Base):
    __tablename__ = "installations"

    id = Column(Integer, primary_key=True, index=True)

    # Lead/Customer reference
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    lead = relationship("Lead", foreign_keys=[lead_id])
    
    # Customer reference (optional - for converted leads)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)

    # Product
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product = relationship("Product", foreign_keys=[product_id])
    quantity = Column(Integer, default=1)

    # Technician
    technician_id = Column(Integer, ForeignKey("technicians.id"), nullable=True)
    technician = relationship("Technician", back_populates="installations")

    # Scheduling
    scheduled_date = Column(Date, nullable=True)
    scheduled_time = Column(Time, nullable=True)
    estimated_duration = Column(Integer, default=60)  # Minutes

    # Location
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=True)
    address_notes = Column(Text, nullable=True)  # e.g., "Apartamento 302, edificio azul"

    # Status
    status = Column(
        SQLEnum(InstallationStatus, values_callable=lambda x: [e.value for e in x]),
        default=InstallationStatus.PENDIENTE,
        nullable=False,
        index=True
    )

    # Payment
    total_price = Column(Numeric(10, 2), nullable=False)
    payment_status = Column(
        SQLEnum(PaymentStatus, values_callable=lambda x: [e.value for e in x]),
        default=PaymentStatus.PENDIENTE,
        nullable=False
    )
    payment_method = Column(
        SQLEnum(PaymentMethod, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    amount_paid = Column(Numeric(10, 2), default=0)

    # Notes
    customer_notes = Column(Text, nullable=True)  # Notes from customer
    technician_notes = Column(Text, nullable=True)  # Notes from technician after installation
    internal_notes = Column(Text, nullable=True)  # Admin notes

    # Installation Timer - Track actual installation duration
    # Using String instead of Enum to avoid requiring DB migration for new enum type
    timer_started_at = Column(DateTime(timezone=True), nullable=True)  # When timer was started
    timer_ended_at = Column(DateTime(timezone=True), nullable=True)    # When timer was stopped
    timer_started_by = Column(String(20), nullable=True)  # 'admin' or 'technician'
    installation_duration_minutes = Column(Integer, nullable=True)     # Calculated duration in minutes

    # Completion
    completed_at = Column(DateTime(timezone=True), nullable=True)
    photo_proof_url = Column(String(500), nullable=True)  # Photo of installed lock

    # Media - Photos, Signature, Video
    signature_url = Column(String(500), nullable=True)  # Customer signature
    photos_before = Column(Text, nullable=True)  # JSON array of photo URLs before installation
    photos_after = Column(Text, nullable=True)   # JSON array of photo URLs after installation
    video_url = Column(String(500), nullable=True)  # Installation video URL

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
