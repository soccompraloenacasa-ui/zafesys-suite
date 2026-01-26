"""
ZAFESYS Suite - Timezone Utilities

All dates and times in the application should use Colombia timezone (America/Bogota)
to ensure consistency for users in Colombia regardless of where the server is hosted.
"""
from datetime import datetime, date, time
from zoneinfo import ZoneInfo

# Colombia timezone (UTC-5)
COLOMBIA_TZ = ZoneInfo("America/Bogota")
UTC_TZ = ZoneInfo("UTC")


def now_colombia() -> datetime:
    """Get current datetime in Colombia timezone."""
    return datetime.now(COLOMBIA_TZ)


def today_colombia() -> date:
    """Get current date in Colombia timezone."""
    return datetime.now(COLOMBIA_TZ).date()


def now_utc() -> datetime:
    """Get current datetime in UTC."""
    return datetime.now(UTC_TZ)


def to_colombia(dt: datetime) -> datetime:
    """Convert a datetime to Colombia timezone."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume UTC if no timezone
        dt = dt.replace(tzinfo=UTC_TZ)
    return dt.astimezone(COLOMBIA_TZ)


def to_utc(dt: datetime) -> datetime:
    """Convert a datetime to UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Assume Colombia if no timezone
        dt = dt.replace(tzinfo=COLOMBIA_TZ)
    return dt.astimezone(UTC_TZ)


def colombia_date_to_utc_range(target_date: date) -> tuple[datetime, datetime]:
    """
    Convert a Colombia date to UTC datetime range.
    Returns (start_of_day_utc, end_of_day_utc) for the given Colombia date.
    
    Useful for querying database with UTC timestamps while filtering by Colombia date.
    """
    # Start of day in Colombia
    start_colombia = datetime.combine(target_date, time.min, tzinfo=COLOMBIA_TZ)
    # End of day in Colombia (23:59:59.999999)
    end_colombia = datetime.combine(target_date, time.max, tzinfo=COLOMBIA_TZ)
    
    return start_colombia.astimezone(UTC_TZ), end_colombia.astimezone(UTC_TZ)
