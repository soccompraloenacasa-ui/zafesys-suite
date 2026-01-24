from sqlalchemy import Column, Integer, String, Numeric, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    model = Column(String(100))
    price = Column(Numeric(12, 2), nullable=False)
    supplier_cost = Column(Numeric(12, 2), nullable=True)  # Precio proveedor
    installation_price = Column(Numeric(12, 2), default=0)
    stock = Column(Integer, default=0)
    min_stock_alert = Column(Integer, default=5)
    description = Column(Text)
    features = Column(Text)
    image_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
