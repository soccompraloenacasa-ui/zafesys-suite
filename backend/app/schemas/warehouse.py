from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# Warehouse schemas
class WarehouseBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class WarehouseResponse(WarehouseBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# WarehouseStock schemas
class WarehouseStockBase(BaseModel):
    warehouse_id: int
    product_id: int
    quantity: int = 0
    min_stock_alert: int = 2


class WarehouseStockCreate(WarehouseStockBase):
    pass


class WarehouseStockUpdate(BaseModel):
    quantity: Optional[int] = None
    min_stock_alert: Optional[int] = None


class WarehouseStockResponse(WarehouseStockBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Extended response with warehouse info
class WarehouseStockWithWarehouse(WarehouseStockResponse):
    warehouse_name: str
    warehouse_code: str


# Product stock by warehouse
class ProductWarehouseStock(BaseModel):
    warehouse_id: int
    warehouse_code: str
    warehouse_name: str
    quantity: int
    min_stock_alert: int


class ProductStockByWarehouse(BaseModel):
    product_id: int
    product_name: str
    product_sku: str
    total_stock: int
    warehouses: List[ProductWarehouseStock]


# Bulk stock update
class BulkStockUpdate(BaseModel):
    product_id: int
    stocks: List[WarehouseStockCreate]
