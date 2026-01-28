// Lead types
export type LeadStatus = 'nuevo' | 'en_conversacion' | 'potencial' | 'agendado' | 'instalado' | 'venta_cerrada' | 'perdido';
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
  agendado: LeadKanban[];
  instalado: LeadKanban[];
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
  supplier_cost?: number;
  installation_price: number;
  stock: number;
  min_stock_alert: number;
  features?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

// Customer types
export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  document_type?: string;
  document_number?: string;
  address?: string;
  city?: string;
  notes?: string;
  lead_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Distributor types
export interface Distributor {
  id: number;
  name: string;
  company_name?: string;
  nit?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  zone?: string;
  contact_person?: string;
  notes?: string;
  discount_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  total_sales?: number;
  total_units?: number;
}

export interface DistributorSale {
  id: number;
  distributor_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  sale_date: string;
  invoice_number?: string;
  payment_status: string;
  amount_paid: number;
  notes?: string;
  product_name?: string;
  product_sku?: string;
  distributor_name?: string;
  created_at: string;
  updated_at?: string;
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
  pin?: string;  // PIN para acceso a la app móvil
  is_available: boolean;
  is_active: boolean;
  tracking_enabled?: boolean;
  created_at: string;
}

// Installation types
export type InstallationStatus = 'pendiente' | 'programada' | 'en_camino' | 'en_progreso' | 'completada' | 'cancelada';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'nequi' | 'daviplata';
export type TimerStartedBy = 'admin' | 'technician';

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
  // Timer fields
  timer_started_at?: string;
  timer_ended_at?: string;
  timer_started_by?: TimerStartedBy;
  installation_duration_minutes?: number;
  created_at: string;
}

// Timer response type
export interface TimerResponse {
  installation_id: number;
  timer_started_at?: string;
  timer_ended_at?: string;
  timer_started_by?: TimerStartedBy;
  installation_duration_minutes?: number;
  is_running: boolean;
  elapsed_minutes?: number;
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

// Google Ads types
export interface GoogleAdsAccount {
  connected: boolean;
  email?: string;
  customer_id?: string;
  account_name?: string;
}

export interface GoogleAdsStatus {
  account1: GoogleAdsAccount;
  account2: GoogleAdsAccount;
}

export interface GoogleAdsSpendSummary {
  account: 1 | 2;
  customer_id: string;
  account_name: string;
  total_spend: number;
  spend_this_month: number;
  spend_last_7_days: number;
  currency: string;
}

export interface DailySpend {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
}

export interface ROIMetrics {
  total_sales: number;
  total_installations: number;
  roi_percentage: number;
  cost_per_installation: number;
}

export interface GoogleAdsMetrics {
  account: 1 | 2;
  period_start: string;
  period_end: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  average_ctr: number;
  average_cpc: number;
  daily_spend: DailySpend[];
  campaigns: CampaignMetrics[];
  roi: ROIMetrics | null;
  currency: string;
}
