"""
ZAFESYS Suite - Models
"""
from app.models.user import User, UserRole
from app.models.lead import Lead, LeadStatus, LeadSource
from app.models.product import Product
from app.models.technician import Technician
from app.models.installation import Installation, InstallationStatus, PaymentStatus, PaymentMethod

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
]
