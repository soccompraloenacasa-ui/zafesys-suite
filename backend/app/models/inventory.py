"""
ZAFESYS Suite - Inventory Movement Model
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class MovementType(str, enum.Enum):
    ENTRADA = "entrada"  # Stock entry (purchase, return)
    SALIDA = "salida"    # Stock exit (sale, installation)
    AJUSTE = "ajuste"    # Manual adjustment


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    
    # Product reference
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    # Movement details
    movement_type = Column(String(20), nullable=False)  # entrada, salida, ajuste
    quantity = Column(Integer, nullable=False)  # positive for entrada, negative for salida
    
    # Stock levels at time of movement
    stock_before = Column(Integer, nullable=False)
    stock_after = Column(Integer, nullable=False)
    
    # Reference (e.g., installation_id, purchase_order, etc.)
    reference_type = Column(String(50), nullable=True)  # installation, purchase, adjustment
    reference_id = Column(Integer, nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Who made the movement
    created_by = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    product = relationship("Product", backref="movements")
