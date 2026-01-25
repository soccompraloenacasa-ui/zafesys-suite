import axios from 'axios';
import type { Lead, KanbanData, LeadStatus, Product, Technician, Installation, AuthToken, Customer, Distributor, DistributorSale } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'https://zafesys-suite-production.up.railway.app';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: async (email: string, password: string): Promise<AuthToken> => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  },
  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// Leads
export const leadsApi = {
  getAll: async (): Promise<Lead[]> => {
    const { data } = await api.get('/leads/');
    return data;
  },
  getKanban: async (): Promise<KanbanData> => {
    const { data } = await api.get('/leads/kanban');
    return data;
  },
  getById: async (id: number): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },
  create: async (lead: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.post('/leads/', lead);
    return data;
  },
  update: async (id: number, lead: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.put(`/leads/${id}`, lead);
    return data;
  },
  updateStatus: async (id: number, status: LeadStatus): Promise<Lead> => {
    const { data } = await api.patch(`/leads/${id}/status`, { status });
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/leads/${id}`);
  },
  getStats: async () => {
    const { data } = await api.get('/leads/stats');
    return data;
  },
};

// Products
export const productsApi = {
  getAll: async (): Promise<Product[]> => {
    const { data } = await api.get('/products/');
    return data;
  },
  getById: async (id: number): Promise<Product> => {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },
  create: async (product: Partial<Product>): Promise<Product> => {
    const { data } = await api.post('/products/', product);
    return data;
  },
  update: async (id: number, product: Partial<Product>): Promise<Product> => {
    const { data } = await api.put(`/products/${id}`, product);
    return data;
  },
  updateStock: async (id: number, stock: number): Promise<Product> => {
    const { data } = await api.patch(`/products/${id}/stock`, { stock });
    return data;
  },
};

// Customers
export const customersApi = {
  getAll: async (): Promise<Customer[]> => {
    const { data } = await api.get('/customers/');
    return data;
  },
  getById: async (id: number): Promise<Customer> => {
    const { data } = await api.get(`/customers/${id}`);
    return data;
  },
  create: async (customer: Partial<Customer>): Promise<Customer> => {
    const { data } = await api.post('/customers/', customer);
    return data;
  },
  update: async (id: number, customer: Partial<Customer>): Promise<Customer> => {
    const { data } = await api.put(`/customers/${id}`, customer);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },
  createFromLead: async (leadId: number): Promise<Customer> => {
    const { data } = await api.post(`/customers/from-lead/${leadId}`);
    return data;
  },
};

// Distributors
export interface DistributorWithSales extends Distributor {
  sales: DistributorSale[];
  total_sales_amount: number;
  total_units_sold: number;
}

export const distributorsApi = {
  getAll: async (): Promise<Distributor[]> => {
    const { data } = await api.get('/distributors/');
    return data;
  },
  getById: async (id: number): Promise<DistributorWithSales> => {
    const { data } = await api.get(`/distributors/${id}`);
    return data;
  },
  create: async (distributor: Partial<Distributor>): Promise<Distributor> => {
    const { data } = await api.post('/distributors/', distributor);
    return data;
  },
  update: async (id: number, distributor: Partial<Distributor>): Promise<Distributor> => {
    const { data } = await api.put(`/distributors/${id}`, distributor);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/distributors/${id}`);
  },
  // Sales
  getAllSales: async (filters?: { distributor_id?: number; product_id?: number; from_date?: string; to_date?: string }): Promise<DistributorSale[]> => {
    const { data } = await api.get('/distributors/sales/all', { params: filters });
    return data;
  },
  createSale: async (distributorId: number, sale: Partial<DistributorSale>): Promise<DistributorSale> => {
    const { data } = await api.post(`/distributors/${distributorId}/sales`, sale);
    return data;
  },
  updateSale: async (saleId: number, sale: Partial<DistributorSale>): Promise<DistributorSale> => {
    const { data } = await api.put(`/distributors/sales/${saleId}`, sale);
    return data;
  },
  deleteSale: async (saleId: number): Promise<void> => {
    await api.delete(`/distributors/sales/${saleId}`);
  },
};

// Technicians
export const techniciansApi = {
  getAll: async (): Promise<Technician[]> => {
    // Get all technicians including inactive ones
    const { data } = await api.get('/technicians/', { params: { active_only: false } });
    return data;
  },
  getAvailable: async (): Promise<Technician[]> => {
    const { data } = await api.get('/technicians/available');
    return data;
  },
  getById: async (id: number): Promise<Technician> => {
    const { data } = await api.get(`/technicians/${id}`);
    return data;
  },
  create: async (technician: Partial<Technician>): Promise<Technician> => {
    const { data } = await api.post('/technicians/', technician);
    return data;
  },
  update: async (id: number, technician: Partial<Technician>): Promise<Technician> => {
    const { data } = await api.put(`/technicians/${id}`, technician);
    return data;
  },
  getSchedule: async (id: number, date?: string) => {
    const params = date ? { target_date: date } : {};
    const { data } = await api.get(`/technicians/${id}/schedule`, { params });
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/technicians/${id}`);
  },
};

// Installations
export const installationsApi = {
  getAll: async (): Promise<Installation[]> => {
    const { data } = await api.get('/installations/');
    return data;
  },
  getById: async (id: number): Promise<Installation> => {
    const { data } = await api.get(`/installations/${id}`);
    return data;
  },
  getByDate: async (date: string, technicianId?: number) => {
    const params: Record<string, string | number> = { target_date: date };
    if (technicianId) params.technician_id = technicianId;
    const { data } = await api.get('/installations/by-date', { params });
    return data;
  },
  create: async (installation: Partial<Installation>): Promise<Installation> => {
    const { data } = await api.post('/installations/', installation);
    return data;
  },
  update: async (id: number, installation: Partial<Installation>): Promise<Installation> => {
    const { data } = await api.put(`/installations/${id}`, installation);
    return data;
  },
  updateStatus: async (id: number, status: string): Promise<Installation> => {
    const { data } = await api.patch(`/installations/${id}/status`, { status });
    return data;
  },
  complete: async (id: number, notes?: string, photoUrl?: string): Promise<Installation> => {
    const { data } = await api.post(`/installations/${id}/complete`, {
      technician_notes: notes,
      photo_proof_url: photoUrl,
    });
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/installations/${id}`);
  },
};

// Inventory
export interface InventorySummary {
  total_products: number;
  total_stock_value: number;
  products_low_stock: number;
  products_out_of_stock: number;
  products_slow_moving: number;
  total_movements_today: number;
  total_movements_week: number;
}

export interface ProductInventory {
  id: number;
  sku: string;
  name: string;
  model: string;
  stock: number;
  min_stock_alert: number;
  price: number;
  is_active: boolean;
  stock_status: 'ok' | 'low' | 'critical';
  total_sold_30d: number;
  total_sold_7d: number;
  avg_daily_sales: number;
  days_of_stock: number | null;
  alerts: string[];
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product_name: string | null;
  product_model: string | null;
}

export const inventoryApi = {
  getSummary: async (): Promise<InventorySummary> => {
    const { data } = await api.get('/inventory/summary');
    return data;
  },
  getProducts: async (onlyAlerts: boolean = false): Promise<ProductInventory[]> => {
    const { data } = await api.get('/inventory/products', {
      params: { only_alerts: onlyAlerts },
    });
    return data;
  },
  getMovements: async (productId?: number, limit: number = 50): Promise<InventoryMovement[]> => {
    const params: Record<string, number> = { limit };
    if (productId) params.product_id = productId;
    const { data } = await api.get('/inventory/movements', { params });
    return data;
  },
  createMovement: async (
    productId: number,
    movementType: 'entrada' | 'salida' | 'ajuste',
    quantity: number,
    notes?: string
  ): Promise<InventoryMovement> => {
    const { data } = await api.post('/inventory/movements', {
      product_id: productId,
      movement_type: movementType,
      quantity,
      notes,
    });
    return data;
  },
  adjustStock: async (productId: number, newStock: number, reason: string): Promise<InventoryMovement> => {
    const { data } = await api.post('/inventory/adjust-stock', {
      product_id: productId,
      new_stock: newStock,
      reason,
    });
    return data;
  },
};

// Technician Mobile App API
export const techApi = {
  login: async (phone: string, pin: string) => {
    const { data } = await api.post('/tech/login', { phone, pin });
    return data;
  },
  getMyInstallations: async (technicianId: number, date?: string) => {
    const params: Record<string, string | number> = { technician_id: technicianId };
    if (date) params.target_date = date;
    const { data } = await api.get('/tech/my-installations', { params });
    return data;
  },
  getInstallation: async (installationId: number, technicianId: number) => {
    const { data } = await api.get(`/tech/installations/${installationId}`, {
      params: { technician_id: technicianId },
    });
    return data;
  },
  updateStatus: async (installationId: number, technicianId: number, status: string) => {
    const { data } = await api.patch(`/tech/installations/${installationId}/status`,
      { status },
      { params: { technician_id: technicianId } }
    );
    return data;
  },
  confirmPayment: async (installationId: number, technicianId: number, amount: number, method: string) => {
    const { data } = await api.post(`/tech/installations/${installationId}/confirm-payment`,
      { amount, method },
      { params: { technician_id: technicianId } }
    );
    return data;
  },
  completeInstallation: async (installationId: number, technicianId: number, notes?: string, photoUrl?: string) => {
    const { data } = await api.post(`/tech/installations/${installationId}/complete`,
      { technician_notes: notes, photo_proof_url: photoUrl },
      { params: { technician_id: technicianId } }
    );
    return data;
  },
  updateAvailability: async (technicianId: number, isAvailable: boolean) => {
    const { data } = await api.patch('/tech/availability',
      { is_available: isAvailable },
      { params: { technician_id: technicianId } }
    );
    return data;
  },
  getProfile: async (technicianId: number) => {
    const { data } = await api.get('/tech/profile', {
      params: { technician_id: technicianId },
    });
    return data;
  },
};

export default api;
