import { useState, useEffect } from 'react';
import { Plus, Package, Search, Edit2, Trash2, X, ImageIcon, Crown, Award, Star } from 'lucide-react';
import { productsApi } from '../services/api';
import type { Product, ProductCategory } from '../types';
import Modal from '../components/common/Modal';

interface ProductFormData {
  name: string;
  sku: string;
  model: string;
  category: ProductCategory;
  price: string;
  supplier_cost: string;
  installation_price: string;
  stock: string;
  min_stock_alert: string;
  description: string;
  features: string;
  image_url: string;
}

const initialFormData: ProductFormData = {
  name: '',
  sku: '',
  model: '',
  category: 'silver',
  price: '',
  supplier_cost: '0',
  installation_price: '0',
  stock: '0',
  min_stock_alert: '5',
  description: '',
  features: '',
  image_url: '',
};

// Category configuration
const CATEGORIES: { key: ProductCategory; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
  { 
    key: 'gold', 
    label: 'Gold - Premium', 
    icon: <Crown className="w-5 h-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-gradient-to-r from-amber-50 to-yellow-50',
    borderColor: 'border-amber-300'
  },
  { 
    key: 'silver', 
    label: 'Silver - Estándar', 
    icon: <Award className="w-5 h-5" />,
    color: 'text-gray-500',
    bgColor: 'bg-gradient-to-r from-gray-50 to-slate-50',
    borderColor: 'border-gray-300'
  },
  { 
    key: 'black', 
    label: 'Black - Económico', 
    icon: <Star className="w-5 h-5" />,
    color: 'text-gray-800',
    bgColor: 'bg-gradient-to-r from-gray-100 to-gray-50',
    borderColor: 'border-gray-400'
  },
];

const getCategoryConfig = (category: ProductCategory) => {
  return CATEGORIES.find(c => c.key === category) || CATEGORIES[1];
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const fetchProducts = async () => {
    try {
      const data = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group products by category
  const groupedProducts = CATEGORIES.map(cat => ({
    ...cat,
    products: filteredProducts
      .filter(p => (p.category || 'silver') === cat.key)
      .sort((a, b) => b.price - a.price) // Sort by price descending within category
  }));

  const handleOpenModal = () => {
    setFormData(initialFormData);
    setEditingProduct(null);
    setError(null);
    setImagePreviewUrl(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      model: product.model || '',
      category: product.category || 'silver',
      price: product.price.toString(),
      supplier_cost: (product.supplier_cost || 0).toString(),
      installation_price: (product.installation_price || 0).toString(),
      stock: product.stock.toString(),
      min_stock_alert: (product.min_stock_alert || 5).toString(),
      description: product.description || '',
      features: product.features || '',
      image_url: product.image_url || '',
    });
    setImagePreviewUrl(product.image_url || null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setEditingProduct(null);
    setError(null);
    setImagePreviewUrl(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Update image preview when URL changes
    if (name === 'image_url') {
      setImagePreviewUrl(value || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const productData = {
        name: formData.name,
        sku: formData.sku,
        model: formData.model,
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        supplier_cost: parseFloat(formData.supplier_cost) || 0,
        installation_price: parseFloat(formData.installation_price) || 0,
        stock: parseInt(formData.stock) || 0,
        min_stock_alert: parseInt(formData.min_stock_alert) || 5,
        description: formData.description || undefined,
        features: formData.features || undefined,
        image_url: formData.image_url || undefined,
      };

      if (editingProduct) {
        await productsApi.update(editingProduct.id, productData);
      } else {
        await productsApi.create(productData);
      }
      handleCloseModal();
      fetchProducts();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || `Error al ${editingProduct ? 'actualizar' : 'crear'} el producto`);
    } finally {
      setSaving(false);
    }
  };

  const handleImageClick = (product: Product) => {
    if (product.image_url) {
      setEnlargedImage({ url: product.image_url, name: product.name });
    }
  };

  // Calculate profit margin
  const getProfit = (price: number, supplierCost: number) => {
    if (!supplierCost) return null;
    const profit = price - supplierCost;
    const margin = (profit / price) * 100;
    return { profit, margin };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">Gestiona tu inventario de cerraduras</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
        />
      </div>

      {/* Products by Category */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Package className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay productos registrados</p>
          <button
            onClick={handleOpenModal}
            className="mt-4 text-cyan-600 hover:underline"
          >
            Agregar primer producto
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedProducts.map((group) => {
            if (group.products.length === 0) return null;
            
            const config = getCategoryConfig(group.key);
            
            return (
              <div key={group.key} className="space-y-4">
                {/* Category Header */}
                <div className={`flex items-center gap-3 pb-3 border-b-2 ${config.borderColor}`}>
                  <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <h2 className={`text-lg font-bold ${config.color}`}>{config.label}</h2>
                    <p className="text-sm text-gray-500">{group.products.length} producto{group.products.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.products.map((product) => {
                    const profitData = getProfit(product.price, product.supplier_cost || 0);
                    const catConfig = getCategoryConfig(product.category || 'silver');
                    
                    return (
                      <div
                        key={product.id}
                        className={`bg-white rounded-xl p-4 border-2 ${catConfig.borderColor} shadow-sm hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          {/* Product Image or Icon */}
                          {product.image_url ? (
                            <div 
                              onClick={() => handleImageClick(product)}
                              className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                              title="Click para ampliar"
                            >
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-cyan-50 flex items-center justify-center"><svg class="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>';
                                }}
                              />
                            </div>
                          ) : (
                            <div className={`p-2 rounded-lg ${catConfig.bgColor}`}>
                              <Package className={`w-6 h-6 ${catConfig.color}`} />
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleEditProduct(product)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Editar producto"
                            >
                              <Edit2 className="w-4 h-4 text-gray-400 hover:text-cyan-500" />
                            </button>
                            <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                        <p className="text-xs text-gray-500 mb-3">SKU: {product.sku}</p>

                        {/* Price and Stock */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-cyan-600">
                            ${product.price.toLocaleString()}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded ${
                              product.stock > 10
                                ? 'bg-green-100 text-green-700'
                                : product.stock > 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            Stock: {product.stock}
                          </span>
                        </div>

                        {/* Profit Info */}
                        {profitData && (
                          <div className="pt-2 border-t border-gray-100 text-xs">
                            <div className="flex justify-between text-gray-500">
                              <span>Costo: ${(product.supplier_cost || 0).toLocaleString()}</span>
                              <span className="text-green-600 font-medium">
                                Ganancia: ${profitData.profit.toLocaleString()} ({profitData.margin.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-white rounded-xl overflow-hidden">
              <img 
                src={enlargedImage.url} 
                alt={enlargedImage.name}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="p-4 bg-gray-50 border-t">
                <p className="font-semibold text-gray-900">{enlargedImage.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle={editingProduct ? `Editando: ${editingProduct.sku}` : 'Agrega una cerradura al inventario'}
        size="lg"
        footer={
          <>
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !formData.name || !formData.sku || !formData.model || !formData.price}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej: Cerradura OS566F"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU *
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                placeholder="Ej: OS566F-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo *
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleInputChange}
                placeholder="Ej: OS566F"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Venta (COP) *
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                placeholder="Ej: 650000"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Costo Proveedor (COP)
              </label>
              <input
                type="number"
                name="supplier_cost"
                value={formData.supplier_cost}
                onChange={handleInputChange}
                placeholder="Ej: 400000"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Instalacion
              </label>
              <input
                type="number"
                name="installation_price"
                value={formData.installation_price}
                onChange={handleInputChange}
                placeholder="Ej: 189000"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Profit Preview */}
          {formData.price && formData.supplier_cost && parseFloat(formData.supplier_cost) > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Ganancia estimada por unidad:</span>
                <span className="font-bold text-green-700">
                  ${(parseFloat(formData.price) - parseFloat(formData.supplier_cost)).toLocaleString()} 
                  ({(((parseFloat(formData.price) - parseFloat(formData.supplier_cost)) / parseFloat(formData.price)) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock {editingProduct ? 'Actual' : 'Inicial'}
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alerta Stock Minimo
              </label>
              <input
                type="number"
                name="min_stock_alert"
                value={formData.min_stock_alert}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={2}
              placeholder="Descripcion del producto..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caracteristicas
            </label>
            <textarea
              name="features"
              value={formData.features}
              onChange={handleInputChange}
              rows={2}
              placeholder="Huella digital, WiFi, App movil..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de Imagen
            </label>
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
            {/* Image Preview */}
            {imagePreviewUrl && (
              <div className="mt-2 relative">
                <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img 
                    src={imagePreviewUrl} 
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><span>Error cargando imagen</span></div>';
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, image_url: '' }));
                    setImagePreviewUrl(null);
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {!imagePreviewUrl && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <ImageIcon className="w-4 h-4" />
                <span>La imagen aparecerá aquí al pegar una URL válida</span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
