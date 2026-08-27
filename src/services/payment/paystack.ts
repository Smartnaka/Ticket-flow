import crypto from 'crypto';
import {
  InitializePaymentParams,
  InitializePaymentResponse,
  PaymentProvider,
  RefundPaymentParams,
  RefundPaymentResponse,
  VerifyPaymentResponse,
} from './types';

export class PaystackSandboxProvider implements PaymentProvider {
  public name = 'paystack';
  private secretKey: string;
  private webhookSecret: string;
  private appUrl: string;

  constructor() {
    this.secretKey = process.env.PAYMENT_SECRET_KEY || '';
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
  }

  public async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse> {
    if (!this.secretKey) {
      throw new Error(
        'Paystack Secret Key (PAYMENT_SECRET_KEY) is missing. Please enter your Paystack secret key in your environment variables.',
      );
    }

    const customerEmail = params.email || params.customer_email || 'customer@example.com';
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customerEmail,
        amount: params.amount_kobo,
        reference: params.reference,
        callback_url: params.callback_url || `${this.appUrl}/payment-status?ref=${params.reference}`,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.status || !data.data?.authorization_url) {
      throw new Error(`Paystack API Error: ${data.message || 'Payment initialization failed'}`);
    }

    return {
      success: true,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference: params.reference,
      provider: this.name,
    };
  }

  public async verifyPayment(reference: string): Promise<VerifyPaymentResponse> {
    if (!this.secretKey) {
      return {
        success: false,
        status: 'FAILED',
        reference,
        amount_kobo: 0,
        currency: 'NGN',
        channel: 'paystack',
        paid_at: new Date().toISOString(),
        raw_data: { error: 'PAYMENT_SECRET_KEY missing' },
      };
    }

    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status && data.data?.status === 'success') {
        return {
          success: true,
          status: 'SUCCESSFUL',
          reference,
          amount_kobo: data.data.amount || 0,
          currency: data.data.currency || 'NGN',
          channel: data.data.channel || 'paystack',
          paid_at: data.data.paid_at || new Date().toISOString(),
          raw_data: data.data,
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          reference,
          amount_kobo: 0,
          currency: 'NGN',
          channel: 'paystack',
          paid_at: new Date().toISOString(),
          raw_data: data,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        reference,
        amount_kobo: 0,
        currency: 'NGN',
        channel: 'paystack',
        paid_at: new Date().toISOString(),
        raw_data: { error: err.message },
      };
    }
  }

  public async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResponse> {
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST', headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: params.payment_reference, amount: params.amount_kobo }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.status) throw new Error(`Paystack refund failed: ${data.message || response.statusText}`);
    return { success: true, refund_reference: data.data?.refund_reference || data.data?.id, status: data.data?.status === 'processed' ? 'REFUNDED' : 'PENDING', amount_kobo: params.amount_kobo, raw_data: data.data };
  }

  public verifyWebhookSignature(payloadRaw: string, signature: string): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha512', this.webhookSecret);
    const expectedSignature = hmac.update(payloadRaw).digest('hex');
    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  public generateWebhookSignature(payloadRaw: string): string {
    const hmac = crypto.createHmac('sha512', this.webhookSecret);
    return hmac.update(payloadRaw).digest('hex');
  }
}
