"""
ZAFESYS Suite - Technician CRUD Operations
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models import Technician
from app.schemas import TechnicianCreate, TechnicianUpdate


class CRUDTechnician(CRUDBase[Technician, TechnicianCreate, TechnicianUpdate]):
    """CRUD operations for Technician model."""

    def get_by_user_id(self, db: Session, *, user_id: int) -> Optional[Technician]:
        """Get technician by user account ID."""
        return db.query(Technician).filter(Technician.user_id == user_id).first()

    def get_by_phone(self, db: Session, *, phone: str) -> Optional[Technician]:
        """Get technician by phone number."""
        return db.query(Technician).filter(Technician.phone == phone).first()

    def get_active(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Technician]:
        """Get only active technicians."""
        return (
            db.query(Technician)
            .filter(Technician.is_active == True)
            .order_by(Technician.full_name)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_available(self, db: Session) -> List[Technician]:
        """Get available technicians for assignment."""
        return (
            db.query(Technician)
            .filter(Technician.is_active == True)
            .filter(Technician.is_available == True)
            .order_by(Technician.full_name)
            .all()
        )

    def get_by_zone(
        self,
        db: Session,
        *,
        zone: str,
        available_only: bool = True
    ) -> List[Technician]:
        """Get technicians by zone."""
        query = db.query(Technician).filter(
            Technician.is_active == True,
            Technician.zone.ilike(f"%{zone}%")
        )
        if available_only:
            query = query.filter(Technician.is_available == True)
        return query.all()

    def set_availability(
        self,
        db: Session,
        *,
        db_obj: Technician,
        is_available: bool
    ) -> Technician:
        """Set technician availability status."""
        db_obj.is_available = is_available
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


technician = CRUDTechnician(Technician)
