import axios from 'axios';
import type { Lead, LeadKanban, KanbanData, LeadStatus, Product, Technician, Installation, AuthToken } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
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

// Technicians
export const techniciansApi = {
  getAll: async (): Promise<Technician[]> => {
    const { data } = await api.get('/technicians/');
    return data;
  },
  getAvailable: async (): Promise<Technician[]> => {
    const { data } = await api.get('/technicians/available');
    return data;
  },
  getSchedule: async (id: number, date?: string) => {
    const params = date ? { target_date: date } : {};
    const { data } = await api.get(`/technicians/${id}/schedule`, { params });
    return data;
  },
};

// Installations
export const installationsApi = {
  getAll: async (): Promise<Installation[]> => {
    const { data } = await api.get('/installations/');
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
};

export default api;
