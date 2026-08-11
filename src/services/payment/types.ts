import { PaymentStatus } from '../../types';

export interface InitializePaymentParams {
  order_id: string;
  amount_kobo: number;
  currency: string;
  email: string;
  customer_email?: string;
  customer_name?: string;
  reference: string;
  callback_url: string;
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  success: boolean;
  authorization_url: string;
  access_code: string;
  reference: string;
  provider: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status: PaymentStatus;
  reference: string;
  amount_kobo: number;
  currency: string;
  channel?: string;
  paid_at?: string;
  raw_data?: any;
}

export interface RefundPaymentParams {
  payment_reference: string;
  amount_kobo: number;
  reason: string;
}

export interface RefundPaymentResponse {
  success: boolean;
  refund_reference: string;
  status: 'PENDING' | 'REFUNDED' | 'FAILED';
  amount_kobo: number;
  raw_data?: any;
}

export interface PaymentProvider {
  name: string;
  initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse>;
  verifyPayment(reference: string): Promise<VerifyPaymentResponse>;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResponse>;
  verifyWebhookSignature(payloadRaw: string, signature: string): boolean;
  generateWebhookSignature?(payloadRaw: string): string;
}
