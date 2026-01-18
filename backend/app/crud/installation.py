"""
ZAFESYS Suite - Installation CRUD Operations
"""
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models import Installation, InstallationStatus, PaymentStatus
from app.schemas import InstallationCreate, InstallationUpdate


class CRUDInstallation(CRUDBase[Installation, InstallationCreate, InstallationUpdate]):
    """CRUD operations for Installation model."""

    def get_by_lead(
        self,
        db: Session,
        *,
        lead_id: int
    ) -> List[Installation]:
        """Get all installations for a lead."""
        return (
            db.query(Installation)
            .filter(Installation.lead_id == lead_id)
            .order_by(Installation.created_at.desc())
            .all()
        )

    def get_by_technician(
        self,
        db: Session,
        *,
        technician_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Installation]:
        """Get installations assigned to a technician."""
        return (
            db.query(Installation)
            .filter(Installation.technician_id == technician_id)
            .order_by(Installation.scheduled_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_date(
        self,
        db: Session,
        *,
        target_date: date,
        technician_id: Optional[int] = None
    ) -> List[Installation]:
        """Get installations scheduled for a specific date."""
        query = db.query(Installation).filter(Installation.scheduled_date == target_date)
        if technician_id:
            query = query.filter(Installation.technician_id == technician_id)
        return query.order_by(Installation.scheduled_time).all()

    def get_technician_day_schedule(
        self,
        db: Session,
        *,
        technician_id: int,
        target_date: date
    ) -> List[Installation]:
        """Get a technician's installations for a specific day."""
        return (
            db.query(Installation)
            .filter(
                Installation.technician_id == technician_id,
                Installation.scheduled_date == target_date,
                Installation.status.notin_([
                    InstallationStatus.CANCELADA,
                    InstallationStatus.COMPLETADA
                ])
            )
            .order_by(Installation.scheduled_time)
            .all()
        )

    def get_pending(self, db: Session) -> List[Installation]:
        """Get installations pending scheduling."""
        return (
            db.query(Installation)
            .filter(Installation.status == InstallationStatus.PENDIENTE)
            .order_by(Installation.created_at)
            .all()
        )

    def get_by_status(
        self,
        db: Session,
        *,
        status: InstallationStatus,
        skip: int = 0,
        limit: int = 100
    ) -> List[Installation]:
        """Get installations by status."""
        return (
            db.query(Installation)
            .filter(Installation.status == status)
            .order_by(Installation.scheduled_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def update_status(
        self,
        db: Session,
        *,
        db_obj: Installation,
        status: InstallationStatus
    ) -> Installation:
        """Update installation status."""
        db_obj.status = status
        if status == InstallationStatus.COMPLETADA:
            db_obj.completed_at = datetime.utcnow()
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_payment(
        self,
        db: Session,
        *,
        db_obj: Installation,
        payment_status: PaymentStatus,
        payment_method: Optional[str] = None,
        amount_paid: Optional[float] = None
    ) -> Installation:
        """Update installation payment info."""
        db_obj.payment_status = payment_status
        if payment_method:
            db_obj.payment_method = payment_method
        if amount_paid is not None:
            db_obj.amount_paid = amount_paid
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def complete(
        self,
        db: Session,
        *,
        db_obj: Installation,
        technician_notes: Optional[str] = None,
        photo_proof_url: Optional[str] = None
    ) -> Installation:
        """Mark installation as completed."""
        db_obj.status = InstallationStatus.COMPLETADA
        db_obj.completed_at = datetime.utcnow()
        if technician_notes:
            db_obj.technician_notes = technician_notes
        if photo_proof_url:
            db_obj.photo_proof_url = photo_proof_url
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def count_by_status(self, db: Session) -> dict:
        """Count installations by status."""
        counts = {}
        for status in InstallationStatus:
            counts[status.value] = (
                db.query(Installation)
                .filter(Installation.status == status)
                .count()
            )
        return counts

    def get_today_count(self, db: Session) -> int:
        """Get count of today's installations."""
        today = date.today()
        return (
            db.query(Installation)
            .filter(Installation.scheduled_date == today)
            .count()
        )


installation = CRUDInstallation(Installation)
