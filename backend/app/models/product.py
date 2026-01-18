"""
ZAFESYS Suite - Product Model
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    # Product info
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    model = Column(String(100), nullable=False)  # e.g., OS566F, OS709TYFA

    # Pricing
    price = Column(Numeric(10, 2), nullable=False)
    installation_price = Column(Numeric(10, 2), default=0)

    # Inventory
    stock = Column(Integer, default=0)
    min_stock_alert = Column(Integer, default=5)

    # Features (stored as comma-separated or JSON)
    features = Column(Text, nullable=True)  # e.g., "huella,tarjeta,app,clave"

    # Media
    image_url = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
