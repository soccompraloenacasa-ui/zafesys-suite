"""
ZAFESYS Suite - Users API Routes
User management endpoints.
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.api.deps import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)
router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "sales"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """Get all users, optionally filtered by role or status."""
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.order_by(User.full_name).all()

    return [
        UserResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            phone=u.phone,
            role=u.role if isinstance(u.role, str) else u.role.value,
            is_active=u.is_active,
        )
        for u in users
    ]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role if isinstance(user.role, str) else user.role.value,
        is_active=user.is_active,
    )


@router.post("/", response_model=UserResponse)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate role
    valid_roles = ["admin", "sales", "technician", "warehouse"]
    if user_data.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )

    # Create user
    hashed_password = pwd_context.hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"User created: {new_user.email} with role {new_user.role}")

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        phone=new_user.phone,
        role=new_user.role if isinstance(new_user.role, str) else new_user.role.value,
        is_active=new_user.is_active,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    if user_data.email is not None:
        # Check if email is taken by another user
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_data.email

    if user_data.password is not None:
        user.hashed_password = pwd_context.hash(user_data.password)

    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    if user_data.phone is not None:
        user.phone = user_data.phone

    if user_data.role is not None:
        valid_roles = ["admin", "sales", "technician", "warehouse"]
        if user_data.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        user.role = user_data.role

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    db.commit()
    db.refresh(user)

    logger.info(f"User updated: {user.email}")

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role if isinstance(user.role, str) else user.role.value,
        is_active=user.is_active,
    )


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user (soft delete - sets is_active to False)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Soft delete
    user.is_active = False
    db.commit()

    logger.info(f"User deactivated: {user.email}")

    return {"success": True, "message": "User deactivated"}
