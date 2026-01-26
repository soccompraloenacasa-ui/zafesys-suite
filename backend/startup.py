"""Startup script that creates missing tables and starts the server"""
import os
import sys

def create_missing_tables():
    """Create customers, distributors tables if they don't exist"""
    from sqlalchemy import create_engine, text
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("No DATABASE_URL found, skipping")
        return
    
    print("Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Check if customers table already exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'customers'
            );
        """))
        customers_exists = result.scalar()
        
        if not customers_exists:
            print("Creating missing tables...")
            
            # Create customers table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50) NOT NULL,
                    email VARCHAR(255),
                    document_type VARCHAR(20),
                    document_number VARCHAR(50),
                    address VARCHAR(500),
                    city VARCHAR(100),
                    notes TEXT,
                    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            """))
            print("Created customers table")
            
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_customers_id ON customers(id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_customers_phone ON customers(phone);"))
            
            # Create distributors table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS distributors (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    company_name VARCHAR(255),
                    nit VARCHAR(50),
                    phone VARCHAR(50) NOT NULL,
                    email VARCHAR(255),
                    address VARCHAR(500),
                    city VARCHAR(100),
                    zone VARCHAR(100),
                    contact_person VARCHAR(255),
                    notes TEXT,
                    discount_percentage NUMERIC(5, 2) DEFAULT 0,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            """))
            print("Created distributors table")
            
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_distributors_id ON distributors(id);"))
            
            # Create distributor_sales table
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS distributor_sales (
                    id SERIAL PRIMARY KEY,
                    distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
                    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                    quantity INTEGER NOT NULL,
                    unit_price NUMERIC(12, 2) NOT NULL,
                    total_price NUMERIC(12, 2) NOT NULL,
                    sale_date DATE NOT NULL,
                    invoice_number VARCHAR(100),
                    payment_status VARCHAR(20) DEFAULT 'pendiente',
                    amount_paid NUMERIC(12, 2) DEFAULT 0,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            """))
            print("Created distributor_sales table")
            
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_distributor_sales_id ON distributor_sales(id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_distributor_sales_distributor_id ON distributor_sales(distributor_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_distributor_sales_sale_date ON distributor_sales(sale_date);"))
            
            conn.commit()
            print("All new tables created successfully!")
        else:
            print("Tables already exist, skipping creation")
        
        # Always run these column additions (IF NOT EXISTS makes them safe)
        print("Checking for missing columns...")
        
        # Add supplier_cost to products if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(12, 2);"))
            print("Checked supplier_cost column on products")
        except Exception as e:
            print(f"supplier_cost: {e}")
        
        # Add customer_id to installations if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;"))
            print("Checked customer_id column on installations")
        except Exception as e:
            print(f"customer_id: {e}")
        
        # Add timer columns to installations (for tracking installation duration)
        try:
            conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP WITH TIME ZONE;"))
            print("Checked timer_started_at column on installations")
        except Exception as e:
            print(f"timer_started_at: {e}")
        
        try:
            conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_ended_at TIMESTAMP WITH TIME ZONE;"))
            print("Checked timer_ended_at column on installations")
        except Exception as e:
            print(f"timer_ended_at: {e}")
        
        try:
            conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS timer_started_by VARCHAR(20);"))
            print("Checked timer_started_by column on installations")
        except Exception as e:
            print(f"timer_started_by: {e}")
        
        try:
            conn.execute(text("ALTER TABLE installations ADD COLUMN IF NOT EXISTS installation_duration_minutes INTEGER;"))
            print("Checked installation_duration_minutes column on installations")
        except Exception as e:
            print(f"installation_duration_minutes: {e}")
        
        conn.commit()
        print("Database setup complete!")

if __name__ == "__main__":
    print("=== ZAFESYS Startup Script ===")
    
    try:
        create_missing_tables()
    except Exception as e:
        print(f"Error creating tables: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n=== Starting Server ===")
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
