import { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  RefreshCw,
  Plus,
  Minus,
  X,
  Warehouse,
  Edit2,
} from 'lucide-react';
import { inventoryApi, warehousesApi, type InventorySummary, type ProductInventory, type InventoryMovement, type Warehouse as WarehouseType, type ProductWithWarehouseStock } from '../services/api';

type TabType = 'productos' | 'movimientos' | 'alertas' | 'bodegas';

const extractColorFromFeatures = (features: string | null | undefined): string => {
  if (!features) return '';
  const match = features.match(/\[Etiqueta:\s*(\w+)\]/);
  return match ? match[1].toLowerCase() : '';
};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [products, setProducts] = useState<ProductInventory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [productsWithWarehouses, setProductsWithWarehouses] = useState<ProductWithWarehouseStock[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'entrada' | 'salida'>('entrada');
  const [modalProduct, setModalProduct] = useState<ProductInventory | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [warehouseModalProduct, setWarehouseModalProduct] = useState<ProductWithWarehouseStock | null>(null);
  const [warehouseStocks, setWarehouseStocks] = useState<{[key: number]: number}>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryData, productsData, movementsData, warehousesData, productsWithWarehousesData] = await Promise.all([
        inventoryApi.getSummary(),
        inventoryApi.getProducts(),
        inventoryApi.getMovements(),
        warehousesApi.getAll().catch(() => []),
        warehousesApi.getInventoryWithWarehouses().catch(() => []),
      ]);
      setSummary(summaryData);
      setProducts(productsData);
      setMovements(movementsData);
      setWarehouses(warehousesData);
      setProductsWithWarehouses(productsWithWarehousesData);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openMovementModal = (product: ProductInventory, type: 'entrada' | 'salida') => {
    setModalProduct(product);
    setModalType(type);
    setQuantity('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openWarehouseStockModal = (product: ProductWithWarehouseStock) => {
    setWarehouseModalProduct(product);
    const stocks: {[key: number]: number} = {};
    product.warehouse_stocks.forEach(ws => {
      stocks[ws.warehouse_id] = ws.quantity;
    });
    setWarehouseStocks(stocks);
    setIsWarehouseModalOpen(true);
  };

  const handleSaveMovement = async () => {
    if (!modalProduct || !quantity) return;
    setSaving(true);
    try {
      await inventoryApi.createMovement(modalProduct.id, modalType, parseInt(quantity), notes || undefined);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating movement:', error);
      alert('Error al registrar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWarehouseStocks = async () => {
    if (!warehouseModalProduct) return;
    setSaving(true);
    try {
      const stocks = warehouses.map(w => ({
        warehouse_id: w.id,
        warehouse_code: w.code,
        warehouse_name: w.name,
        quantity: warehouseStocks[w.id] || 0,
        min_stock_alert: 2,
      }));
      await warehousesApi.updateProductStock(warehouseModalProduct.id, stocks);
      setIsWarehouseModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating warehouse stocks:', error);
      alert('Error al actualizar el stock por bodega');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-100 text-green-700';
      case 'low': return 'bg-yellow-100 text-yellow-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok': return 'OK';
      case 'low': return 'Bajo';
      case 'critical': return 'Crítico';
      default: return status;
    }
  };

  const getColorBadgeStyle = (color: string) => {
    switch (color) {
      case 'gold': return 'bg-yellow-400 text-yellow-900';
      case 'silver': return 'bg-gray-300 text-gray-800';
      case 'black': return 'bg-gray-800 text-white';
      default: return '';
    }
  };

  const productsWithAlerts = products.filter((p) => p.alerts.length > 0);
  const totalWarehouseStock = (product: ProductWithWarehouseStock) => 
    product.warehouse_stocks.reduce((sum, ws) => sum + ws.quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500">Control de stock y movimientos</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.total_products}</p>
                <p className="text-xs text-gray-500">Productos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.products_low_stock}</p>
                <p className="text-xs text-gray-500">Stock bajo</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.products_out_of_stock}</p>
                <p className="text-xs text-gray-500">Sin stock</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{warehouses.length}</p>
                <p className="text-xs text-gray-500">Bodegas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('productos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'productos' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          Productos
        </button>
        <button onClick={() => setActiveTab('bodegas')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'bodegas' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          <Warehouse className="w-4 h-4" />
          Por Bodega
        </button>
        <button onClick={() => setActiveTab('alertas')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'alertas' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          Alertas
          {productsWithAlerts.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{productsWithAlerts.length}</span>}
        </button>
        <button onClick={() => setActiveTab('movimientos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'movimientos' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          Movimientos
        </button>
      </div>

      {activeTab === 'productos' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Producto</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Stock</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Ventas 30d</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Días stock</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.model} • {product.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg font-bold text-gray-900">{product.stock}</span>
                    <span className="text-xs text-gray-500 ml-1">/ min {product.min_stock_alert}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(product.stock_status)}`}>{getStatusLabel(product.stock_status)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {product.total_sold_30d > 0 ? (<><TrendingUp className="w-4 h-4 text-green-500" /><span className="font-medium text-gray-900">{product.total_sold_30d}</span></>) : (<><TrendingDown className="w-4 h-4 text-orange-500" /><span className="text-orange-600">0</span></>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {product.days_of_stock !== null ? <span className={`font-medium ${product.days_of_stock <= 7 ? 'text-red-600' : 'text-gray-900'}`}>~{product.days_of_stock} días</span> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openMovementModal(product, 'entrada')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Entrada"><Plus className="w-4 h-4" /></button>
                      <button onClick={() => openMovementModal(product, 'salida')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Salida"><Minus className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bodegas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {warehouses.map((warehouse) => {
              const totalStock = productsWithWarehouses.reduce((sum, p) => {
                const ws = p.warehouse_stocks.find(ws => ws.warehouse_id === warehouse.id);
                return sum + (ws?.quantity || 0);
              }, 0);
              return (
                <div key={warehouse.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Warehouse className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{warehouse.name}</p>
                      <p className="text-sm text-gray-500">{warehouse.code}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-3xl font-bold text-gray-900">{totalStock}</p>
                    <p className="text-xs text-gray-500">unidades totales</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Producto</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Total</th>
                  {warehouses.map((w) => <th key={w.id} className="text-center px-4 py-3 text-sm font-semibold text-gray-600">{w.code}</th>)}
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productsWithWarehouses.map((product) => {
                  const colorLabel = extractColorFromFeatures(product.features);
                  return (
                    <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {colorLabel && <span className={`text-xs px-2 py-0.5 rounded ${getColorBadgeStyle(colorLabel)}`}>{colorLabel.charAt(0).toUpperCase() + colorLabel.slice(1)}</span>}
                          <div>
                            <p className="font-medium text-gray-900">{product.sku}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{product.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-lg font-bold text-gray-900">{totalWarehouseStock(product)}</span></td>
                      {warehouses.map((w) => {
                        const ws = product.warehouse_stocks.find(ws => ws.warehouse_id === w.id);
                        const qty = ws?.quantity || 0;
                        return <td key={w.id} className="px-4 py-3 text-center"><span className={`font-medium ${qty === 0 ? 'text-gray-400' : qty <= 2 ? 'text-red-600' : 'text-gray-900'}`}>{qty}</span></td>;
                      })}
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openWarehouseStockModal(product)} className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg" title="Editar stock por bodega"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alertas' && (
        <div className="space-y-4">
          {productsWithAlerts.length === 0 ? (
            <div className="bg-green-50 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Package className="w-8 h-8 text-green-600" /></div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">¡Todo en orden!</h3>
              <p className="text-green-600">No hay alertas de inventario en este momento.</p>
            </div>
          ) : productsWithAlerts.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.model} • Stock: {product.stock}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(product.stock_status)}`}>{getStatusLabel(product.stock_status)}</span>
              </div>
              <div className="space-y-2">
                {product.alerts.map((alert, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${alert.includes('SIN STOCK') || alert.includes('CRÍTICO') ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    <AlertTriangle className="w-4 h-4" /><span>{alert}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => openMovementModal(product, 'entrada')} className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">
                <Plus className="w-4 h-4" />Agregar Stock
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'movimientos' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {movements.length === 0 ? <div className="p-8 text-center text-gray-500">No hay movimientos registrados</div> : movements.map((m) => (
              <div key={m.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.movement_type === 'entrada' ? 'bg-green-100' : m.movement_type === 'salida' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    {m.movement_type === 'entrada' ? <ArrowDownCircle className="w-5 h-5 text-green-600" /> : m.movement_type === 'salida' ? <ArrowUpCircle className="w-5 h-5 text-red-600" /> : <RefreshCw className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{m.product_name || `Producto #${m.product_id}`}</span>
                      <span className={`text-sm font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                    </div>
                    <p className="text-sm text-gray-500">{m.stock_before} → {m.stock_after} unidades{m.notes && ` • ${m.notes}`}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3 h-3" />{new Date(m.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    <span className={`text-xs px-2 py-0.5 rounded ${m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : m.movement_type === 'salida' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{m.movement_type.charAt(0).toUpperCase() + m.movement_type.slice(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isModalOpen && modalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className={`px-6 py-4 rounded-t-xl flex items-center justify-between ${modalType === 'entrada' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              <div>
                <h2 className="text-lg font-bold">{modalType === 'entrada' ? 'Entrada de Stock' : 'Salida de Stock'}</h2>
                <p className="text-sm opacity-90">{modalProduct.name}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Stock actual</p>
                <p className="text-3xl font-bold text-gray-900">{modalProduct.stock}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" placeholder="0" className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-center" />
                {quantity && <p className="text-sm text-gray-500 mt-2 text-center">Nuevo stock: <span className="font-semibold">{modalType === 'entrada' ? modalProduct.stock + parseInt(quantity || '0') : modalProduct.stock - parseInt(quantity || '0')}</span></p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Compra proveedor..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button onClick={handleSaveMovement} disabled={!quantity || saving} className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${modalType === 'entrada' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>{saving ? 'Guardando...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWarehouseModalOpen && warehouseModalProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-6 py-4 rounded-t-xl flex items-center justify-between bg-purple-500 text-white">
              <div>
                <h2 className="text-lg font-bold">Stock por Bodega</h2>
                <p className="text-sm opacity-90">{warehouseModalProduct.sku} - {warehouseModalProduct.name}</p>
              </div>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Stock total actual</p>
                <p className="text-3xl font-bold text-gray-900">{totalWarehouseStock(warehouseModalProduct)}</p>
              </div>
              <div className="space-y-3">
                {warehouses.map((w) => (
                  <div key={w.id} className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700">{w.name}</label>
                      <p className="text-xs text-gray-500">{w.code}</p>
                    </div>
                    <input type="number" value={warehouseStocks[w.id] || 0} onChange={(e) => setWarehouseStocks(prev => ({...prev, [w.id]: parseInt(e.target.value) || 0}))} min="0" className="w-24 px-3 py-2 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-center" />
                  </div>
                ))}
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-sm text-purple-700">Nuevo total: <span className="font-bold">{Object.values(warehouseStocks).reduce((sum, qty) => sum + qty, 0)}</span> unidades</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsWarehouseModalOpen(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button onClick={handleSaveWarehouseStocks} disabled={saving} className="flex-1 px-4 py-2 text-white bg-purple-500 hover:bg-purple-600 rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
