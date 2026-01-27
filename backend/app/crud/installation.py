"""
ZAFESYS Suite - Installation CRUD Operations
"""
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models import Installation, InstallationStatus, PaymentStatus
from app.schemas import InstallationCreate, InstallationUpdate
from app.core.timezone import now_colombia, today_colombia, COLOMBIA_TZ


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
                    InstallationStatus.CANCELADA.value,
                    InstallationStatus.COMPLETADA.value
                ])
            )
            .order_by(Installation.scheduled_time)
            .all()
        )

    def get_pending(self, db: Session) -> List[Installation]:
        """Get installations pending scheduling."""
        return (
            db.query(Installation)
            .filter(Installation.status == InstallationStatus.PENDIENTE.value)
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
            .filter(Installation.status == status.value)
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
        db_obj.status = status.value
        if status == InstallationStatus.COMPLETADA:
            db_obj.completed_at = now_colombia()
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
        db_obj.payment_status = payment_status.value
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
        db_obj.status = InstallationStatus.COMPLETADA.value
        db_obj.completed_at = now_colombia()
        if technician_notes:
            db_obj.technician_notes = technician_notes
        if photo_proof_url:
            db_obj.photo_proof_url = photo_proof_url
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def start_timer(
        self,
        db: Session,
        *,
        db_obj: Installation,
        started_by: str  # 'admin' or 'technician'
    ) -> Installation:
        """
        Start the installation timer.
        Can be started by admin or technician.
        If timer is already running, this is a no-op.
        """
        # Only start if not already running
        if db_obj.timer_started_at is None or db_obj.timer_ended_at is not None:
            db_obj.timer_started_at = now_colombia()
            db_obj.timer_ended_at = None  # Reset end time in case of restart
            db_obj.timer_started_by = started_by
            db_obj.installation_duration_minutes = None  # Reset duration
            # Also update status to EN_PROGRESO if not already
            if db_obj.status not in [InstallationStatus.EN_PROGRESO.value, InstallationStatus.COMPLETADA.value]:
                db_obj.status = InstallationStatus.EN_PROGRESO.value
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
        return db_obj

    def stop_timer(
        self,
        db: Session,
        *,
        db_obj: Installation
    ) -> Installation:
        """
        Stop the installation timer and calculate duration.
        """
        if db_obj.timer_started_at is not None and db_obj.timer_ended_at is None:
            db_obj.timer_ended_at = now_colombia()
            # Calculate duration in minutes
            if db_obj.timer_started_at:
                # Ensure both datetimes are timezone-aware for accurate calculation
                started = db_obj.timer_started_at
                ended = db_obj.timer_ended_at
                if started.tzinfo is None:
                    started = started.replace(tzinfo=COLOMBIA_TZ)
                if ended.tzinfo is None:
                    ended = ended.replace(tzinfo=COLOMBIA_TZ)
                delta = ended - started
                db_obj.installation_duration_minutes = int(delta.total_seconds() / 60)
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
        return db_obj

    def get_timer_status(
        self,
        db_obj: Installation
    ) -> dict:
        """
        Get current timer status for an installation.
        Returns dict with timer info and current elapsed time if running.
        """
        is_running = (
            db_obj.timer_started_at is not None and 
            db_obj.timer_ended_at is None
        )
        elapsed_minutes = None
        
        if is_running and db_obj.timer_started_at:
            started = db_obj.timer_started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=COLOMBIA_TZ)
            delta = now_colombia() - started
            elapsed_minutes = int(delta.total_seconds() / 60)
        
        return {
            "installation_id": db_obj.id,
            "timer_started_at": db_obj.timer_started_at,
            "timer_ended_at": db_obj.timer_ended_at,
            "timer_started_by": db_obj.timer_started_by,
            "installation_duration_minutes": db_obj.installation_duration_minutes,
            "is_running": is_running,
            "elapsed_minutes": elapsed_minutes
        }

    def count_by_status(self, db: Session) -> dict:
        """Count installations by status."""
        counts = {}
        for status in InstallationStatus:
            counts[status.value] = (
                db.query(Installation)
                .filter(Installation.status == status.value)
                .count()
            )
        return counts

    def get_today_count(self, db: Session) -> int:
        """Get count of today's installations (Colombia timezone)."""
        today = today_colombia()
        return (
            db.query(Installation)
            .filter(Installation.scheduled_date == today)
            .count()
        )

    def get_technician_avg_duration(
        self,
        db: Session,
        *,
        technician_id: int
    ) -> Optional[float]:
        """
        Calculate average installation duration for a technician.
        Only considers completed installations with timer data.
        """
        from sqlalchemy import func as sql_func
        result = (
            db.query(sql_func.avg(Installation.installation_duration_minutes))
            .filter(
                Installation.technician_id == technician_id,
                Installation.installation_duration_minutes.isnot(None)
            )
            .scalar()
        )
        return float(result) if result else None


installation = CRUDInstallation(Installation)
