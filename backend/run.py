import os
import subprocess
import sys
import uvicorn

def run_migrations():
    """Run Alembic migrations before starting the server."""
    print("Running database migrations...")
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        if result.returncode == 0:
            print("Migrations completed successfully")
            if result.stdout:
                print(result.stdout)
        else:
            print(f"Migration warning: {result.stderr}")
            # Don't exit on error - the tables might already exist
    except Exception as e:
        print(f"Migration error (non-fatal): {e}")

if __name__ == "__main__":
    # Run migrations first
    run_migrations()

    # Start the server
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
