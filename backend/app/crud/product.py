"""
ZAFESYS Suite - Product CRUD Operations
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models import Product
from app.schemas import ProductCreate, ProductUpdate


class CRUDProduct(CRUDBase[Product, ProductCreate, ProductUpdate]):
    """CRUD operations for Product model."""

    def get_by_sku(self, db: Session, *, sku: str) -> Optional[Product]:
        """Get product by SKU."""
        return db.query(Product).filter(Product.sku == sku).first()

    def get_by_model(self, db: Session, *, model: str) -> Optional[Product]:
        """Get product by model name."""
        return db.query(Product).filter(Product.model == model).first()

    def get_active(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Get only active products."""
        return (
            db.query(Product)
            .filter(Product.is_active == True)
            .order_by(Product.name)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_low_stock(self, db: Session) -> List[Product]:
        """Get products with stock below minimum alert level."""
        return (
            db.query(Product)
            .filter(Product.is_active == True)
            .filter(Product.stock <= Product.min_stock_alert)
            .all()
        )

    def update_stock(
        self,
        db: Session,
        *,
        db_obj: Product,
        quantity: int,
        operation: str = "set"
    ) -> Product:
        """Update product stock.

        Args:
            operation: "set" to set absolute value, "add" to add, "subtract" to subtract
        """
        if operation == "set":
            db_obj.stock = quantity
        elif operation == "add":
            db_obj.stock += quantity
        elif operation == "subtract":
            db_obj.stock = max(0, db_obj.stock - quantity)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def search(
        self,
        db: Session,
        *,
        query: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        """Search products by name, model, or SKU."""
        search_term = f"%{query}%"
        return (
            db.query(Product)
            .filter(
                (Product.name.ilike(search_term)) |
                (Product.model.ilike(search_term)) |
                (Product.sku.ilike(search_term))
            )
            .offset(skip)
            .limit(limit)
            .all()
        )


product = CRUDProduct(Product)
