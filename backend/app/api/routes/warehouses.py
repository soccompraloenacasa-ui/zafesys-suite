"""
Warehouse API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from app.api.deps import get_db
from app.schemas.warehouse import (
    WarehouseResponse, 
    WarehouseCreate, 
    WarehouseUpdate,
    WarehouseStockResponse,
    ProductStockByWarehouse,
    ProductWarehouseStock,
)

router = APIRouter()


@router.get("/", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db)):
    """Get all warehouses."""
    result = db.execute(text("""
        SELECT id, name, code, address, city, contact_name, contact_phone, 
               notes, is_active, created_at, updated_at
        FROM warehouses 
        WHERE is_active = true
        ORDER BY code
    """))
    warehouses = []
    for row in result:
        warehouses.append({
            "id": row[0],
            "name": row[1],
            "code": row[2],
            "address": row[3],
            "city": row[4],
            "contact_name": row[5],
            "contact_phone": row[6],
            "notes": row[7],
            "is_active": row[8],
            "created_at": row[9],
            "updated_at": row[10],
        })
    return warehouses


@router.post("/", response_model=WarehouseResponse)
def create_warehouse(warehouse: WarehouseCreate, db: Session = Depends(get_db)):
    """Create a new warehouse."""
    result = db.execute(text("""
        INSERT INTO warehouses (name, code, address, city, contact_name, contact_phone, notes, is_active)
        VALUES (:name, :code, :address, :city, :contact_name, :contact_phone, :notes, :is_active)
        RETURNING id, name, code, address, city, contact_name, contact_phone, notes, is_active, created_at, updated_at
    """), {
        "name": warehouse.name,
        "code": warehouse.code,
        "address": warehouse.address,
        "city": warehouse.city,
        "contact_name": warehouse.contact_name,
        "contact_phone": warehouse.contact_phone,
        "notes": warehouse.notes,
        "is_active": warehouse.is_active,
    })
    db.commit()
    row = result.fetchone()
    return {
        "id": row[0],
        "name": row[1],
        "code": row[2],
        "address": row[3],
        "city": row[4],
        "contact_name": row[5],
        "contact_phone": row[6],
        "notes": row[7],
        "is_active": row[8],
        "created_at": row[9],
        "updated_at": row[10],
    }


@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(warehouse_id: int, warehouse: WarehouseUpdate, db: Session = Depends(get_db)):
    """Update a warehouse."""
    # Build dynamic update
    updates = []
    params = {"id": warehouse_id}
    
    if warehouse.name is not None:
        updates.append("name = :name")
        params["name"] = warehouse.name
    if warehouse.code is not None:
        updates.append("code = :code")
        params["code"] = warehouse.code
    if warehouse.address is not None:
        updates.append("address = :address")
        params["address"] = warehouse.address
    if warehouse.city is not None:
        updates.append("city = :city")
        params["city"] = warehouse.city
    if warehouse.contact_name is not None:
        updates.append("contact_name = :contact_name")
        params["contact_name"] = warehouse.contact_name
    if warehouse.contact_phone is not None:
        updates.append("contact_phone = :contact_phone")
        params["contact_phone"] = warehouse.contact_phone
    if warehouse.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = warehouse.notes
    if warehouse.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = warehouse.is_active
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append("updated_at = NOW()")
    
    result = db.execute(text(f"""
        UPDATE warehouses 
        SET {', '.join(updates)}
        WHERE id = :id
        RETURNING id, name, code, address, city, contact_name, contact_phone, notes, is_active, created_at, updated_at
    """), params)
    db.commit()
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    return {
        "id": row[0],
        "name": row[1],
        "code": row[2],
        "address": row[3],
        "city": row[4],
        "contact_name": row[5],
        "contact_phone": row[6],
        "notes": row[7],
        "is_active": row[8],
        "created_at": row[9],
        "updated_at": row[10],
    }


@router.get("/stock/{product_id}", response_model=ProductStockByWarehouse)
def get_product_stock_by_warehouse(product_id: int, db: Session = Depends(get_db)):
    """Get stock for a specific product across all warehouses."""
    # Get product info
    product_result = db.execute(text("""
        SELECT id, name, sku, stock FROM products WHERE id = :product_id
    """), {"product_id": product_id})
    product_row = product_result.fetchone()
    
    if not product_row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get stock by warehouse
    result = db.execute(text("""
        SELECT w.id, w.code, w.name, COALESCE(ws.quantity, 0) as quantity, 
               COALESCE(ws.min_stock_alert, 2) as min_stock_alert
        FROM warehouses w
        LEFT JOIN warehouse_stock ws ON ws.warehouse_id = w.id AND ws.product_id = :product_id
        WHERE w.is_active = true
        ORDER BY w.code
    """), {"product_id": product_id})
    
    warehouses = []
    total = 0
    for row in result:
        qty = row[3] or 0
        total += qty
        warehouses.append({
            "warehouse_id": row[0],
            "warehouse_code": row[1],
            "warehouse_name": row[2],
            "quantity": qty,
            "min_stock_alert": row[4] or 2,
        })
    
    return {
        "product_id": product_row[0],
        "product_name": product_row[1],
        "product_sku": product_row[2],
        "total_stock": total,
        "warehouses": warehouses,
    }


@router.put("/stock/{product_id}")
def update_product_stock_by_warehouse(product_id: int, stocks: List[ProductWarehouseStock], db: Session = Depends(get_db)):
    """Update stock for a product across warehouses."""
    total_stock = 0
    
    for stock in stocks:
        # Upsert warehouse stock
        db.execute(text("""
            INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_stock_alert, updated_at)
            VALUES (:warehouse_id, :product_id, :quantity, :min_stock_alert, NOW())
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET quantity = :quantity, min_stock_alert = :min_stock_alert, updated_at = NOW()
        """), {
            "warehouse_id": stock.warehouse_id,
            "product_id": product_id,
            "quantity": stock.quantity,
            "min_stock_alert": stock.min_stock_alert,
        })
        total_stock += stock.quantity
    
    # Update total stock in products table
    db.execute(text("""
        UPDATE products SET stock = :total_stock WHERE id = :product_id
    """), {"total_stock": total_stock, "product_id": product_id})
    
    db.commit()
    
    return {"message": "Stock updated", "total_stock": total_stock}


@router.get("/inventory-with-warehouses")
def get_inventory_with_warehouses(db: Session = Depends(get_db)):
    """Get all products with their stock by warehouse."""
    # Get all products
    products_result = db.execute(text("""
        SELECT id, name, sku, stock, min_stock_alert, features
        FROM products
        WHERE is_active = true
        ORDER BY sku
    """))
    
    products = []
    for p_row in products_result:
        product_id = p_row[0]
        
        # Get warehouse stocks for this product
        stocks_result = db.execute(text("""
            SELECT w.id, w.code, w.name, COALESCE(ws.quantity, 0) as quantity
            FROM warehouses w
            LEFT JOIN warehouse_stock ws ON ws.warehouse_id = w.id AND ws.product_id = :product_id
            WHERE w.is_active = true
            ORDER BY w.code
        """), {"product_id": product_id})
        
        warehouse_stocks = []
        for s_row in stocks_result:
            warehouse_stocks.append({
                "warehouse_id": s_row[0],
                "warehouse_code": s_row[1],
                "warehouse_name": s_row[2],
                "quantity": s_row[3],
            })
        
        products.append({
            "id": p_row[0],
            "name": p_row[1],
            "sku": p_row[2],
            "stock": p_row[3],
            "min_stock_alert": p_row[4],
            "features": p_row[5],
            "warehouse_stocks": warehouse_stocks,
        })
    
    return products
