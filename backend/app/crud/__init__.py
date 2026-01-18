"""
ZAFESYS Suite - CRUD Operations
"""
from app.crud.user import user
from app.crud.lead import lead
from app.crud.product import product
from app.crud.technician import technician
from app.crud.installation import installation

__all__ = ["user", "lead", "product", "technician", "installation"]
