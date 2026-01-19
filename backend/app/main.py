"""
ZAFESYS Suite - Main Application
FastAPI backend for smart lock installation management
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.api.routes import api_router
from app.database import engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def run_migrations():
    """Run manual migrations to ensure all columns exist."""
    migrations = [
        "ALTER TABLE technicians ADD COLUMN IF NOT EXISTS pin VARCHAR(6);",
        # Inventory movements table
        """
        CREATE TABLE IF NOT EXISTS inventory_movements (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id),
            movement_type VARCHAR(20) NOT NULL,
            quantity INTEGER NOT NULL,
            stock_before INTEGER NOT NULL,
            stock_after INTEGER NOT NULL,
            reference_type VARCHAR(50),
            reference_id INTEGER,
            notes TEXT,
            created_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);",
        "CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);",
    ]
    
    with engine.connect() as conn:
        for migration in migrations:
            try:
                conn.execute(text(migration))
                conn.commit()
                logger.info(f"Migration executed: {migration[:50]}...")
            except Exception as e:
                logger.warning(f"Migration skipped (may already exist): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Running database migrations...")
    try:
        run_migrations()
        logger.info("Migrations completed successfully!")
    except Exception as e:
        logger.error(f"Migration error: {e}")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API para gestión de ventas, técnicos e instalaciones de cerraduras inteligentes",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy"}


@app.get("/api/v1/health")
def api_health_check():
    """API health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
