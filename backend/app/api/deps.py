"""
ZAFESYS Suite - API Dependencies
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.core.security import decode_access_token
from app.models import User, UserRole
import logging

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    logger.info(f"get_current_user called with token: {token[:50] if token else 'None'}...")

    payload = decode_access_token(token)
    logger.info(f"Decoded payload: {payload}")

    if payload is None:
        logger.error("Payload is None - token decode failed")
        raise credentials_exception

    # Get user_id from payload - handle both int and string
    sub_value = payload.get("sub")
    logger.info(f"sub value: {sub_value}, type: {type(sub_value)}")

    if sub_value is None:
        logger.error("sub is None in payload")
        raise credentials_exception

    # Convert to int if it's a string
    try:
        user_id = int(sub_value)
    except (ValueError, TypeError) as e:
        logger.error(f"Failed to convert sub to int: {e}")
        raise credentials_exception

    logger.info(f"Looking up user with id: {user_id}")

    user = db.query(User).filter(User.id == user_id).first()
    logger.info(f"User query result: {user}")

    if user is None:
        logger.error(f"User not found with id: {user_id}")
        raise credentials_exception

    if not user.is_active:
        logger.error(f"User {user_id} is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    logger.info(f"Successfully authenticated user: {user.email}")
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current admin user."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


def get_optional_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False))
) -> Optional[User]:
    """Get current user if authenticated, None otherwise."""
    if token is None:
        return None

    payload = decode_access_token(token)
    if payload is None:
        return None

    sub_value = payload.get("sub")
    if sub_value is None:
        return None

    try:
        user_id = int(sub_value)
    except (ValueError, TypeError):
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user if user and user.is_active else None
