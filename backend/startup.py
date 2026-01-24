"""Startup script that handles migrations and starts the server"""
import os
import sys

def setup_alembic_version():
    """Ensure alembic_version table is set correctly for existing databases"""
    from sqlalchemy import create_engine, text
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("No DATABASE_URL found, skipping migration setup")
        return
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Check if users table exists (means DB has existing schema)
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        """))
        users_exists = result.scalar()
        print(f"Users table exists: {users_exists}")
        
        if users_exists:
            # DB has existing data - force set version to 003_tech_pin
            print("Existing database detected, setting alembic version...")
            
            # Drop and recreate alembic_version to ensure clean state
            conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
            conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                );
            """))
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('003_tech_pin');"))
            conn.commit()
            
            # Verify
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            print(f"Set alembic_version to: {version}")
        else:
            print("Fresh database, will run all migrations from scratch")

if __name__ == "__main__":
    print("=== ZAFESYS Startup Script ===")
    
    # Setup alembic version first
    try:
        setup_alembic_version()
    except Exception as e:
        print(f"Error in setup_alembic_version: {e}")
        import traceback
        traceback.print_exc()
    
    # Run alembic upgrade
    print("\n=== Running Alembic Migrations ===")
    import subprocess
    result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    if result.returncode != 0:
        print(f"Alembic upgrade failed with code {result.returncode}")
        sys.exit(1)
    
    print("\n=== Starting Server ===")
    # Start the server
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
