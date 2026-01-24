from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Distributor(Base):
    """Distribuidores B2B que compran al por mayor"""
    __tablename__ = "distributors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255))  # Nombre de la empresa
    nit = Column(String(50))
    phone = Column(String(50), nullable=False)
    email = Column(String(255))
    address = Column(String(500))
    city = Column(String(100))
    zone = Column(String(100))  # Zona de operación
    contact_person = Column(String(255))  # Persona de contacto
    notes = Column(Text)
    
    # Pricing tier (descuento que aplica)
    discount_percentage = Column(Numeric(5, 2), default=0)  # % de descuento
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    sales = relationship("DistributorSale", back_populates="distributor", cascade="all, delete-orphan")


class DistributorSale(Base):
    """Ventas/Asignaciones de productos a distribuidores"""
    __tablename__ = "distributor_sales"

    id = Column(Integer, primary_key=True, index=True)
    distributor_id = Column(Integer, ForeignKey("distributors.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)  # Precio al que se le vendió
    total_price = Column(Numeric(12, 2), nullable=False)
    
    sale_date = Column(Date, nullable=False)
    invoice_number = Column(String(100))
    payment_status = Column(String(20), default="pendiente")  # pendiente, parcial, pagado
    amount_paid = Column(Numeric(12, 2), default=0)
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    distributor = relationship("Distributor", back_populates="sales")
    product = relationship("Product")
