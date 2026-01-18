"""
ZAFESYS Suite - API Routes
"""
from fastapi import APIRouter
from app.api.routes import auth, leads, products, technicians, installations, webhooks

api_router = APIRouter()

# Auth routes
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Core routes
api_router.include_router(leads.router, prefix="/leads", tags=["Leads"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(technicians.router, prefix="/technicians", tags=["Technicians"])
api_router.include_router(installations.router, prefix="/installations", tags=["Installations"])

# Webhooks (no auth required)
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
