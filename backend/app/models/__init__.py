"""
ZAFESYS Suite - Models
"""
from app.models.user import User, UserRole
from app.models.lead import Lead, LeadStatus, LeadSource
from app.models.product import Product
from app.models.technician import Technician
from app.models.installation import Installation, InstallationStatus, PaymentStatus, PaymentMethod
from app.models.inventory import InventoryMovement, MovementType
from app.models.customer import Customer
from app.models.distributor import Distributor, DistributorSale
from app.models.warehouse import Warehouse, WarehouseStock

__all__ = [
    "User",
    "UserRole",
    "Lead",
    "LeadStatus",
    "LeadSource",
    "Product",
    "Technician",
    "Installation",
    "InstallationStatus",
    "PaymentStatus",
    "PaymentMethod",
    "InventoryMovement",
    "MovementType",
    "Customer",
    "Distributor",
    "DistributorSale",
    "Warehouse",
    "WarehouseStock",
]
