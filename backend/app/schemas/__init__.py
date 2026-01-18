"""
ZAFESYS Suite - Schemas
"""
from app.schemas.user import (
    UserBase, UserCreate, UserUpdate, UserResponse,
    UserLogin, Token, TokenPayload
)
from app.schemas.lead import (
    LeadBase, LeadCreate, LeadUpdate, LeadResponse,
    LeadStatusUpdate, LeadKanbanResponse, ElevenLabsWebhookPayload
)
from app.schemas.product import (
    ProductBase, ProductCreate, ProductUpdate, ProductResponse,
    ProductListResponse, ProductStockUpdate
)
from app.schemas.technician import (
    TechnicianBase, TechnicianCreate, TechnicianUpdate,
    TechnicianResponse, TechnicianListResponse
)
from app.schemas.installation import (
    InstallationBase, InstallationCreate, InstallationUpdate,
    InstallationResponse, InstallationStatusUpdate, InstallationPaymentUpdate,
    InstallationCompleteRequest, InstallationWithDetails, TechnicianDaySchedule
)

__all__ = [
    # User
    "UserBase", "UserCreate", "UserUpdate", "UserResponse",
    "UserLogin", "Token", "TokenPayload",
    # Lead
    "LeadBase", "LeadCreate", "LeadUpdate", "LeadResponse",
    "LeadStatusUpdate", "LeadKanbanResponse", "ElevenLabsWebhookPayload",
    # Product
    "ProductBase", "ProductCreate", "ProductUpdate", "ProductResponse",
    "ProductListResponse", "ProductStockUpdate",
    # Technician
    "TechnicianBase", "TechnicianCreate", "TechnicianUpdate",
    "TechnicianResponse", "TechnicianListResponse",
    # Installation
    "InstallationBase", "InstallationCreate", "InstallationUpdate",
    "InstallationResponse", "InstallationStatusUpdate", "InstallationPaymentUpdate",
    "InstallationCompleteRequest", "InstallationWithDetails", "TechnicianDaySchedule",
]
