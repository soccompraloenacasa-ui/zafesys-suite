"""
ZAFESYS Suite - Analytics API Routes
Installation metrics and statistics endpoints.
"""
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.installation import Installation
from app.models.technician import Technician
from app.models.product import Product

logger = logging.getLogger(__name__)
router = APIRouter()


# Response Models
class TopTechnician(BaseModel):
    name: str
    count: int


class Summary(BaseModel):
    total_installations: int
    avg_per_day: float
    avg_duration_minutes: float
    top_technician: Optional[TopTechnician] = None


class DayData(BaseModel):
    date: str
    count: int


class ProductData(BaseModel):
    product_name: str
    count: int
    percentage: float


class TechnicianData(BaseModel):
    id: int
    name: str
    installations: int
    avg_per_day: float
    avg_duration: float
    ranking: int


class DurationByProduct(BaseModel):
    product_name: str
    avg_minutes: float


class AnalyticsResponse(BaseModel):
    summary: Summary
    by_day: List[DayData]
    by_product: List[ProductData]
    by_technician: List[TechnicianData]
    duration_by_product: List[DurationByProduct]


@router.get("/installations", response_model=AnalyticsResponse)
async def get_installation_analytics(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    technician_id: Optional[int] = Query(None, description="Filter by technician ID"),
    db: Session = Depends(get_db),
):
    """
    Get installation analytics for the specified period.
    If no dates provided, defaults to current month.
    """
    # Default to current month if no dates provided
    if not start_date:
        today = date.today()
        start_date = today.replace(day=1)
    if not end_date:
        end_date = date.today()

    # Calculate number of days in period
    days_in_period = (end_date - start_date).days + 1

    # Base query - completed installations only
    base_query = db.query(Installation).filter(
        Installation.status == "completada",
        Installation.scheduled_date >= start_date,
        Installation.scheduled_date <= end_date,
    )

    if technician_id:
        base_query = base_query.filter(Installation.technician_id == technician_id)

    installations = base_query.all()

    # === SUMMARY ===
    total_installations = len(installations)
    avg_per_day = round(total_installations / days_in_period, 1) if days_in_period > 0 else 0

    # Calculate average duration
    durations = [
        i.installation_duration_minutes
        for i in installations
        if i.installation_duration_minutes is not None
    ]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    # Top technician
    tech_counts = defaultdict(int)
    tech_names = {}
    for inst in installations:
        if inst.technician_id:
            tech_counts[inst.technician_id] += 1
            if inst.technician:
                tech_names[inst.technician_id] = inst.technician.name

    top_tech = None
    if tech_counts:
        top_tech_id = max(tech_counts, key=tech_counts.get)
        top_tech = TopTechnician(
            name=tech_names.get(top_tech_id, "Desconocido"),
            count=tech_counts[top_tech_id]
        )

    summary = Summary(
        total_installations=total_installations,
        avg_per_day=avg_per_day,
        avg_duration_minutes=avg_duration,
        top_technician=top_tech,
    )

    # === BY DAY ===
    day_counts = defaultdict(int)
    for inst in installations:
        if inst.scheduled_date:
            day_str = inst.scheduled_date.isoformat()
            day_counts[day_str] += 1

    # Fill in missing dates with 0
    by_day = []
    current = start_date
    while current <= end_date:
        day_str = current.isoformat()
        by_day.append(DayData(date=day_str, count=day_counts.get(day_str, 0)))
        current += timedelta(days=1)

    # === BY PRODUCT ===
    product_counts = defaultdict(int)
    product_names = {}
    for inst in installations:
        if inst.product_id:
            product_counts[inst.product_id] += 1
            if inst.product:
                product_names[inst.product_id] = inst.product.name

    by_product = []
    for pid, count in sorted(product_counts.items(), key=lambda x: -x[1]):
        pct = round((count / total_installations) * 100, 1) if total_installations > 0 else 0
        by_product.append(ProductData(
            product_name=product_names.get(pid, f"Producto {pid}"),
            count=count,
            percentage=pct,
        ))

    # === BY TECHNICIAN ===
    tech_data = defaultdict(lambda: {"count": 0, "durations": [], "days": set()})
    for inst in installations:
        if inst.technician_id:
            tech_data[inst.technician_id]["count"] += 1
            if inst.installation_duration_minutes:
                tech_data[inst.technician_id]["durations"].append(inst.installation_duration_minutes)
            if inst.scheduled_date:
                tech_data[inst.technician_id]["days"].add(inst.scheduled_date)

    by_technician = []
    for tid, data in tech_data.items():
        days_worked = len(data["days"]) or 1
        avg_dur = round(sum(data["durations"]) / len(data["durations"]), 1) if data["durations"] else 0
        by_technician.append({
            "id": tid,
            "name": tech_names.get(tid, f"Tecnico {tid}"),
            "installations": data["count"],
            "avg_per_day": round(data["count"] / days_worked, 1),
            "avg_duration": avg_dur,
        })

    # Sort by installations and add ranking
    by_technician.sort(key=lambda x: -x["installations"])
    by_technician_final = [
        TechnicianData(**{**t, "ranking": i + 1})
        for i, t in enumerate(by_technician)
    ]

    # === DURATION BY PRODUCT ===
    product_durations = defaultdict(list)
    for inst in installations:
        if inst.product_id and inst.installation_duration_minutes:
            product_durations[inst.product_id].append(inst.installation_duration_minutes)

    duration_by_product = []
    for pid, durations in product_durations.items():
        avg = round(sum(durations) / len(durations), 1) if durations else 0
        duration_by_product.append(DurationByProduct(
            product_name=product_names.get(pid, f"Producto {pid}"),
            avg_minutes=avg,
        ))

    # Sort by duration descending
    duration_by_product.sort(key=lambda x: -x.avg_minutes)

    return AnalyticsResponse(
        summary=summary,
        by_day=by_day,
        by_product=by_product,
        by_technician=by_technician_final,
        duration_by_product=duration_by_product,
    )


@router.get("/technicians")
async def get_technicians_list(db: Session = Depends(get_db)):
    """Get list of technicians for filter dropdown."""
    technicians = db.query(Technician).filter(Technician.is_active == True).all()
    return [{"id": t.id, "name": t.name} for t in technicians]
