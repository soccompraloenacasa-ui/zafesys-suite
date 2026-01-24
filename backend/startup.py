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
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Check if alembic_version table exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'alembic_version'
            );
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            # Create alembic_version table
            conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                );
            """))
            conn.commit()
            print("Created alembic_version table")
        
        # Check current version
        result = conn.execute(text("SELECT version_num FROM alembic_version"))
        current_version = result.scalar()
        
        # Check if users table exists (means DB has existing schema)
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        """))
        users_exists = result.scalar()
        
        if users_exists and not current_version:
            # DB has data but no alembic version - stamp it at 003_tech_pin
            conn.execute(text("""
                INSERT INTO alembic_version (version_num) VALUES ('003_tech_pin')
                ON CONFLICT (version_num) DO NOTHING;
            """))
            conn.commit()
            print("Stamped existing database at 003_tech_pin")
        elif current_version:
            print(f"Current alembic version: {current_version}")
        else:
            print("Fresh database, will run all migrations")

if __name__ == "__main__":
    # Setup alembic version first
    setup_alembic_version()
    
    # Run alembic upgrade
    import subprocess
    result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    
    if result.returncode != 0:
        print(f"Alembic upgrade failed with code {result.returncode}")
        sys.exit(1)
    
    # Start the server
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
