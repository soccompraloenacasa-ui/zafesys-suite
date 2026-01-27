"""
ZAFESYS Suite - Main Application
FastAPI backend for smart lock installation management
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
        
        # Warehouses table
        """
        CREATE TABLE IF NOT EXISTS warehouses (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(20) UNIQUE NOT NULL,
            address VARCHAR(255),
            city VARCHAR(100),
            contact_name VARCHAR(100),
            contact_phone VARCHAR(20),
            notes TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE
        );
        """,
        
        # Warehouse stock table
        """
        CREATE TABLE IF NOT EXISTS warehouse_stock (
            id SERIAL PRIMARY KEY,
            warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 0,
            min_stock_alert INTEGER DEFAULT 2,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(warehouse_id, product_id)
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);",
        "CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON warehouse_stock(product_id);",
        
        # Insert default warehouses if they don't exist
        """
        INSERT INTO warehouses (name, code, address, city, notes)
        SELECT 'Bodega Principal', 'BOD1', '', '', 'Bodega principal'
        WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'BOD1');
        """,
        """
        INSERT INTO warehouses (name, code, address, city, notes)
        SELECT 'Bodega 2', 'BOD2', '', '', 'Segunda bodega'
        WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'BOD2');
        """,
        """
        INSERT INTO warehouses (name, code, address, city, notes)
        SELECT 'Bodega 3', 'BOD3', '', '', 'Tercera bodega'
        WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE code = 'BOD3');
        """,
        
        # GPS Tracking - add column to technicians
        "ALTER TABLE technicians ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT TRUE;",
        
        # Technician locations table for GPS tracking
        """
        CREATE TABLE IF NOT EXISTS technician_locations (
            id SERIAL PRIMARY KEY,
            technician_id INTEGER NOT NULL REFERENCES technicians(id),
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            accuracy DOUBLE PRECISION,
            speed DOUBLE PRECISION,
            heading DOUBLE PRECISION,
            altitude DOUBLE PRECISION,
            battery_level INTEGER,
            activity VARCHAR(50),
            installation_id INTEGER REFERENCES installations(id),
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        """,
        "CREATE INDEX IF NOT EXISTS idx_tech_locations_technician ON technician_locations(technician_id);",
        "CREATE INDEX IF NOT EXISTS idx_tech_locations_recorded_at ON technician_locations(recorded_at);",
        "CREATE INDEX IF NOT EXISTS idx_tech_locations_tech_time ON technician_locations(technician_id, recorded_at DESC);",
        
        # Installation Timer columns - for tracking actual installation duration
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_ended_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_started_by VARCHAR(20);",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS installation_duration_minutes INTEGER;",

        # Installation Media columns - photos, signature, video
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS signature_url VARCHAR(500);",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS photos_before TEXT;",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS photos_after TEXT;",
        "ALTER TABLE installations ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);",

        # Convert enum columns to VARCHAR (fixes PostgreSQL native enum issues)
        # These will fail silently if already VARCHAR
        "ALTER TABLE installations ALTER COLUMN status TYPE VARCHAR(30) USING status::text;",
        "ALTER TABLE installations ALTER COLUMN payment_status TYPE VARCHAR(30) USING payment_status::text;",
        "ALTER TABLE installations ALTER COLUMN payment_method TYPE VARCHAR(30) USING payment_method::text;",
        "ALTER TABLE leads ALTER COLUMN status TYPE VARCHAR(30) USING status::text;",
        "ALTER TABLE leads ALTER COLUMN source TYPE VARCHAR(30) USING source::text;",

        # Normalize existing data to lowercase
        "UPDATE installations SET status = LOWER(status) WHERE status IS NOT NULL;",
        "UPDATE installations SET payment_status = LOWER(payment_status) WHERE payment_status IS NOT NULL;",
        "UPDATE installations SET payment_method = LOWER(payment_method) WHERE payment_method IS NOT NULL;",
        "UPDATE leads SET status = LOWER(status) WHERE status IS NOT NULL;",
        "UPDATE leads SET source = LOWER(source) WHERE source IS NOT NULL;",
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


# Global exception handler to log errors with CORS headers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)

    # Get origin from request
    origin = request.headers.get("origin", "")

    # Build CORS headers if origin is allowed
    headers = {}
    if origin in cors_origins:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }

    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=headers
    )


# CORS middleware - hardcoded origins to ensure it works
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://zafesys-suite.vercel.app",
    "https://zafesys-suite-git-main-soccompraloenacasa-ui.vercel.app",
    "https://zafesys-suite-soccompraloenacasa-ui.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
        "docs": "/docs",
        "deployed": "2026-01-27T10:30:00Z"  # Force redeploy marker
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
