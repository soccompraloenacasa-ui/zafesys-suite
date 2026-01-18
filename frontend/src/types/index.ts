// Lead types
export type LeadStatus = 'nuevo' | 'en_conversacion' | 'potencial' | 'venta_cerrada' | 'perdido';
export type LeadSource = 'website' | 'whatsapp' | 'elevenlabs' | 'ana_voice' | 'referido' | 'otro';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  status: LeadStatus;
  source: LeadSource;
  notes?: string;
  product_interest?: string;
  assigned_to_id?: number;
  elevenlabs_conversation_id?: string;
  conversation_transcript?: string;
  created_at: string;
  updated_at?: string;
  contacted_at?: string;
}

export interface LeadKanban {
  id: number;
  name: string;
  phone: string;
  status: LeadStatus;
  source: LeadSource;
  product_interest?: string;
  created_at: string;
}

export interface KanbanData {
  nuevo: LeadKanban[];
  en_conversacion: LeadKanban[];
  potencial: LeadKanban[];
  venta_cerrada: LeadKanban[];
  perdido: LeadKanban[];
}

// Product types
export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  model: string;
  price: number;
  installation_price: number;
  stock: number;
  min_stock_alert: number;
  features?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

// Technician types
export interface Technician {
  id: number;
  user_id?: number;
  full_name: string;
  phone: string;
  email?: string;
  document_id?: string;
  zone?: string;
  specialties?: string;
  is_available: boolean;
  is_active: boolean;
  created_at: string;
}

// Installation types
export type InstallationStatus = 'pendiente' | 'programada' | 'en_camino' | 'en_progreso' | 'completada' | 'cancelada';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'nequi' | 'daviplata';

export interface Installation {
  id: number;
  lead_id: number;
  product_id: number;
  quantity: number;
  technician_id?: number;
  scheduled_date?: string;
  scheduled_time?: string;
  estimated_duration: number;
  address: string;
  city?: string;
  address_notes?: string;
  status: InstallationStatus;
  total_price: number;
  payment_status: PaymentStatus;
  payment_method?: PaymentMethod;
  amount_paid: number;
  customer_notes?: string;
  technician_notes?: string;
  internal_notes?: string;
  completed_at?: string;
  photo_proof_url?: string;
  created_at: string;
}

// User types
export type UserRole = 'admin' | 'sales' | 'technician';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
