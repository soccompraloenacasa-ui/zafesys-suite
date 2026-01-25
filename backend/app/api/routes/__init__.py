"""
ZAFESYS Suite - API Routes
"""
from fastapi import APIRouter
from app.api.routes import auth, leads, products, technicians, installations, webhooks, admin, tech_app, customers, distributors, warehouses
from app.api import inventory

api_router = APIRouter()

# Auth routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Core routes
api_router.include_router(leads.router, prefix="/leads", tags=["Leads"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(technicians.router, prefix="/technicians", tags=["Technicians"])
api_router.include_router(installations.router, prefix="/installations", tags=["Installations"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(distributors.router, prefix="/distributors", tags=["Distributors"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["Warehouses"])

# Inventory management
api_router.include_router(inventory.router, tags=["Inventory"])

# Webhooks (no auth required)
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])

# Admin routes (no auth for initial setup)
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])

# Technician Mobile App routes (no admin auth - uses own PIN auth)
api_router.include_router(tech_app.router, prefix="/tech", tags=["Technician App"])
