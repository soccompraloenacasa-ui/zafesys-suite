"""
ZAFESYS Suite - Admin Routes
Database initialization and administrative tasks
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import engine, Base
from app.api.deps import get_db
from app.models import User, Lead, Product, Technician, Installation  # Import all models
from app.models.user import UserRole

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


@router.post("/seed-warehouse-user")
async def seed_warehouse_reviewer(db: Session = Depends(get_db)):
    """
    Create a test warehouse user for Google Play review.
    """
    email = "reviewer@zafesys.com"
    password = "ZafesysReview2024"

    # Check if user already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return {
            "status": "exists",
            "message": "User already exists",
            "user": {
                "id": existing.id,
                "email": existing.email,
                "full_name": existing.full_name,
                "role": existing.role
            }
        }

    # Create new user
    hashed_password = pwd_context.hash(password)
    new_user = User(
        email=email,
        hashed_password=hashed_password,
        full_name="Google Play Reviewer",
        role=UserRole.WAREHOUSE,
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "status": "created",
        "message": "Warehouse reviewer user created successfully",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role
        }
    }
