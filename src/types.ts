/**
 * Core Domain Types for TicketWave Event Ticketing & Payment Platform
 */

export type UserRole = 'CUSTOMER' | 'ORGANIZER' | 'ADMIN';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED';

export type WebhookProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'DUPLICATE_IGNORED';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  is_suspended?: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizerProfile {
  id: string;
  user_id: string;
  organization_name: string;
  bio?: string;
  website?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  is_verified: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  organizer_id: string;
  organizer_name?: string;
  title: string;
  slug: string;
  description: string;
  cover_image: string;
  location: string;
  venue: string;
  city: string;
  country: string;
  category: string;
  start_date: string;
  end_date: string;
  status: EventStatus;
  is_published: boolean;
  ticket_sales_start: string;
  ticket_sales_end: string;
  max_capacity: number;
  created_at: string;
  updated_at: string;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price_kobo: number; // Stored in minor unit (kobo: 500000 = ₦5,000)
  currency: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_sold: number;
  sales_start: string;
  sales_end: string;
  max_per_customer: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_type_id: string;
  ticket_type_name: string;
  quantity: number;
  unit_price_kobo: number;
  subtotal_kobo: number;
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  event_id: string;
  event_title?: string;
  currency: string;
  subtotal_kobo: number;
  platform_fee_kobo: number;
  processing_fee_kobo: number;
  total_kobo: number;
  status: OrderStatus;
  payment_reference: string;
  idempotency_key?: string;
  expires_at: string; // ISO timestamp for pending order expiration (15 mins)
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  tickets?: Ticket[];
}

export interface Payment {
  id: string;
  order_id: string;
  amount_kobo: number;
  currency: string;
  provider: string; // 'paystack' | 'flutterwave'
  provider_reference: string;
  status: PaymentStatus;
  authorization_url?: string;
  channel?: string;
  raw_response?: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string; // e.g. TKT-2026-88492
  order_id: string;
  event_id: string;
  event_title?: string;
  event_date?: string;
  event_venue?: string;
  ticket_type_id: string;
  ticket_type_name: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  qr_code_hash: string; // Secure token embedded in QR
  qr_code_data_url?: string;
  status: TicketStatus;
  scanned_at?: string;
  scanned_by?: string;
  created_at: string;
}

export interface Refund {
  id: string;
  order_id: string;
  payment_id: string;
  amount_kobo: number;
  currency: string;
  reason: string;
  requested_by: string;
  provider_reference?: string;
  status: 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_id: string; // Provider's event ID / reference
  event_type: string; // e.g. charge.success
  payload_json: string;
  processing_status: WebhookProcessingStatus;
  error_message?: string;
  received_at: string;
  processed_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_role?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: string;
  ip_address?: string;
  created_at: string;
}

export interface SentEmail {
  id: string;
  to: string;
  subject: string;
  template: string;
  data_json: string;
  sent_at: string;
}

export interface OrganizerAnalytics {
  total_revenue_kobo: number;
  tickets_sold: number;
  tickets_remaining: number;
  total_orders: number;
  total_attendees_scanned: number;
  total_refunds_kobo: number;
  conversion_rate: number;
  recent_transactions: Order[];
  ticket_type_sales: {
    name: string;
    sold: number;
    available: number;
    revenue_kobo: number;
  }[];
  sales_over_time: {
    date: string;
    revenue_kobo: number;
    tickets: number;
  }[];
}

export interface PlatformAnalytics {
  total_platform_revenue_kobo: number;
  total_gross_volume_kobo: number;
  total_organizers: number;
  total_events: number;
  total_tickets_sold: number;
  total_refunds_processed: number;
  webhooks_processed: number;
}
