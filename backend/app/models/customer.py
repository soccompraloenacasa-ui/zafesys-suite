from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Customer(Base):
    """Clientes que ya han comprado - diferente de Leads"""
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255))
    document_type = Column(String(20))  # CC, NIT, CE
    document_number = Column(String(50))
    address = Column(String(500))
    city = Column(String(100))
    notes = Column(Text)
    
    # Reference to lead if converted
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    lead = relationship("Lead", backref="customer")
    installations = relationship("Installation", backref="customer_ref", foreign_keys="Installation.customer_id")
