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
from app.schemas.customer import (
    CustomerBase, CustomerCreate, CustomerUpdate,
    CustomerResponse, CustomerListResponse
)
from app.schemas.distributor import (
    DistributorBase, DistributorCreate, DistributorUpdate,
    DistributorResponse, DistributorListResponse, DistributorWithSales,
    DistributorSaleBase, DistributorSaleCreate, DistributorSaleUpdate,
    DistributorSaleResponse, DistributorSaleListResponse
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
    # Customer
    "CustomerBase", "CustomerCreate", "CustomerUpdate",
    "CustomerResponse", "CustomerListResponse",
    # Distributor
    "DistributorBase", "DistributorCreate", "DistributorUpdate",
    "DistributorResponse", "DistributorListResponse", "DistributorWithSales",
    "DistributorSaleBase", "DistributorSaleCreate", "DistributorSaleUpdate",
    "DistributorSaleResponse", "DistributorSaleListResponse",
]
