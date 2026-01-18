"""
ZAFESYS Suite - Admin Routes
Database initialization and administrative tasks
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.database import engine, Base
from app.models import User, Lead, Product, Technician, Installation  # Import all models

router = APIRouter()


@router.post("/init-db")
async def init_database():
    """
    Create all database tables.

    This endpoint creates all tables defined in the SQLAlchemy models.
    Use this for initial setup or when deploying to a new environment.
    """
    try:
        Base.metadata.create_all(bind=engine)
        return {
            "status": "success",
            "message": "Database tables created successfully",
            "tables": list(Base.metadata.tables.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health-db")
async def check_database():
    """
    Check database connection.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
