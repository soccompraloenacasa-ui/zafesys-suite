"""
ZAFESYS Suite - Inventory Schemas
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum


class MovementTypeEnum(str, Enum):
    entrada = "entrada"
    salida = "salida"
    ajuste = "ajuste"


# Movement Schemas
class InventoryMovementCreate(BaseModel):
    product_id: int
    movement_type: MovementTypeEnum
    quantity: int
    notes: Optional[str] = None
    created_by: Optional[str] = None


class InventoryMovementResponse(BaseModel):
    id: int
    product_id: int
    movement_type: str
    quantity: int
    stock_before: int
    stock_after: int
    reference_type: Optional[str]
    reference_id: Optional[int]
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    
    # Include product info
    product_name: Optional[str] = None
    product_model: Optional[str] = None
    
    class Config:
        from_attributes = True


# Product Inventory View
class ProductInventoryResponse(BaseModel):
    id: int
    sku: str
    name: str
    model: str
    stock: int
    min_stock_alert: int
    price: float
    is_active: bool
    
    # Calculated fields
    stock_status: str  # ok, low, critical
    total_sold_30d: int  # units sold in last 30 days
    total_sold_7d: int   # units sold in last 7 days
    avg_daily_sales: float  # average daily sales
    days_of_stock: Optional[int]  # estimated days until stockout
    
    # Alerts
    alerts: List[str]
    
    class Config:
        from_attributes = True


# Dashboard Summary
class InventorySummary(BaseModel):
    total_products: int
    total_stock_value: float
    products_low_stock: int
    products_out_of_stock: int
    products_slow_moving: int
    total_movements_today: int
    total_movements_week: int


# Stock Adjustment
class StockAdjustmentRequest(BaseModel):
    product_id: int
    new_stock: int
    reason: str
    created_by: Optional[str] = None
