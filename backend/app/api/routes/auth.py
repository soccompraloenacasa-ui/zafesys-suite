"""
ZAFESYS Suite - Authentication Routes
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.core.security import create_access_token
from app.config import settings
from app import crud
from app.schemas import Token, UserResponse, UserCreate
from app.models import User, Technician

router = APIRouter()


# === Schemas para login de técnicos ===
class TechnicianLoginRequest(BaseModel):
    """Request body para login de técnico."""
    document_id: str  # Cédula del técnico
    pin: str  # PIN de 4-6 dígitos


class TechnicianLoginResponse(BaseModel):
    """Response del login de técnico."""
    access_token: str
    token_type: str = "bearer"
    technician_id: int
    technician_name: str


class TechnicianMeResponse(BaseModel):
    """Response con datos del técnico autenticado."""
    id: int
    full_name: str
    phone: str
    email: str | None
    document_id: str | None
    zone: str | None
    is_available: bool
    is_active: bool
    tracking_enabled: bool


# === Endpoints de Admins (Dashboard) ===
@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Login para administradores del dashboard."""
    user = crud.user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse)
def register(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate
):
    """Register a new user (admin only in production)."""
    existing_user = crud.user.get_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    user = crud.user.create(db, obj_in=user_in)
    return user


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information."""
    return current_user


# === Endpoints de Técnicos (App Móvil) ===
@router.post("/technician/login", response_model=TechnicianLoginResponse)
def technician_login(
    *,
    db: Session = Depends(get_db),
    login_data: TechnicianLoginRequest
):
    """
    Login para técnicos desde la app móvil.
    
    Requiere:
    - document_id: Cédula del técnico
    - pin: PIN de 4-6 dígitos asignado por el administrador
    
    Retorna token JWT para usar en las peticiones de la app.
    """
    # Buscar técnico por cédula
    technician = db.query(Technician).filter(
        Technician.document_id == login_data.document_id,
        Technician.is_active == True
    ).first()
    
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cédula no encontrada o técnico inactivo"
        )
    
    # Verificar que el técnico tenga PIN configurado
    if not technician.pin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PIN no configurado. Contacte al administrador."
        )
    
    # Verificar PIN (comparación simple, el PIN se guarda en texto plano por simplicidad)
    if technician.pin != login_data.pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto"
        )
    
    # Crear token JWT con rol de técnico
    access_token_expires = timedelta(days=30)  # Token válido por 30 días para la app
    access_token = create_access_token(
        subject=f"tech_{technician.id}",  # Prefijo para identificar que es técnico
        role="technician",
        expires_delta=access_token_expires
    )
    
    return TechnicianLoginResponse(
        access_token=access_token,
        technician_id=technician.id,
        technician_name=technician.full_name
    )


@router.get("/technician/me", response_model=TechnicianMeResponse)
def get_technician_me(
    db: Session = Depends(get_db),
    token: str = None
):
    """
    Obtener información del técnico autenticado.
    
    Este endpoint está protegido, requiere token válido de técnico.
    """
    from app.core.security import decode_access_token
    from fastapi import Header
    
    # Este endpoint se implementará con la dependencia apropiada
    # Por ahora retorna error si no hay implementación
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Use the header Authorization: Bearer <token>"
    )


@router.post("/technician/validate-token")
def validate_technician_token(
    db: Session = Depends(get_db),
    authorization: str = None
):
    """
    Validar que un token de técnico sea válido.
    
    Útil para la app al iniciar para verificar si la sesión sigue activa.
    """
    from app.core.security import decode_access_token
    from fastapi import Header
    
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido"
        )
    
    # Extraer token del header "Bearer <token>"
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado"
            )
        
        # Verificar que sea un token de técnico
        subject = payload.get("sub", "")
        if not subject.startswith("tech_"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token no es de técnico"
            )
        
        # Extraer ID del técnico
        technician_id = int(subject.replace("tech_", ""))
        
        # Verificar que el técnico siga activo
        technician = db.query(Technician).filter(
            Technician.id == technician_id,
            Technician.is_active == True
        ).first()
        
        if not technician:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Técnico no encontrado o inactivo"
            )
        
        return {
            "valid": True,
            "technician_id": technician.id,
            "technician_name": technician.full_name
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Error validando token: {str(e)}"
        )
