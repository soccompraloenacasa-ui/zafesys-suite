from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Warehouse(Base):
    """Warehouse/Bodega model."""
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)  # e.g., "BOD1", "BOD2", "BOD3"
    address = Column(String(255))
    city = Column(String(100))
    contact_name = Column(String(100))
    contact_phone = Column(String(20))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    stock_items = relationship("WarehouseStock", back_populates="warehouse")


class WarehouseStock(Base):
    """Stock per product per warehouse."""
    __tablename__ = "warehouse_stock"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    min_stock_alert = Column(Integer, default=2)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Unique constraint: one entry per product per warehouse
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'product_id', name='uq_warehouse_product'),
    )

    # Relationships
    warehouse = relationship("Warehouse", back_populates="stock_items")
