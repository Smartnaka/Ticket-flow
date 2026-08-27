import crypto from 'crypto';
import {
  InitializePaymentParams,
  InitializePaymentResponse,
  PaymentProvider,
  RefundPaymentParams,
  RefundPaymentResponse,
  VerifyPaymentResponse,
} from './types';

export class BachsPaymentProvider implements PaymentProvider {
  public name = 'bachs';
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
        'Bachs API Secret Key (PAYMENT_SECRET_KEY) is missing. Please enter your Bachs secret key in your environment variables.',
      );
    }

    const isSandboxKey =
      this.secretKey.includes('test') ||
      this.secretKey.includes('sandbox') ||
      this.secretKey.startsWith('bachs_sk_test');

    const baseUrl = isSandboxKey ? 'https://sandbox-api.bachs.io' : 'https://api.bachs.io';

    const customerEmail = params.email || params.customer_email || 'customer@example.com';
    const customerName = params.customer_name || params.metadata?.customer_name || 'Valued Customer';

    const response = await fetch(`${baseUrl}/v1/collections`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount_kobo,
        currency: params.currency || 'NGN',
        customer: {
          email: customerEmail,
          name: customerName,
        },
        custom_reference: params.reference,
        reference: params.reference,
        redirect_url: params.callback_url || `${this.appUrl}/payment-status?ref=${params.reference}`,
        callback_url: params.callback_url || `${this.appUrl}/payment-status?ref=${params.reference}`,
      }),
    });

    const data = await response.json().catch(() => ({}));

    const authorizationUrl =
      data.checkout_url ||
      data.authorization_url ||
      data.link ||
      data.data?.checkout_url ||
      data.data?.authorization_url ||
      data.data?.link ||
      data.data?.payment_url;

    if (!response.ok || !authorizationUrl) {
      const errMsg =
        data.message ||
        data.error ||
        data.detail ||
        (data.data && data.data.message) ||
        `Bachs API returned HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Bachs API Error: ${errMsg}`);
    }

    return {
      success: true,
      authorization_url: authorizationUrl,
      access_code: data.access_code || data.data?.access_code || params.reference,
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
        channel: 'bachs',
        paid_at: new Date().toISOString(),
        raw_data: { error: 'PAYMENT_SECRET_KEY missing' },
      };
    }

    const isSandboxKey = this.secretKey.includes('test') || this.secretKey.includes('sandbox');
    const baseUrl = isSandboxKey ? 'https://sandbox-api.bachs.io' : 'https://api.bachs.io';

    try {
      const res = await fetch(`${baseUrl}/v1/collections/${reference}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data) {
        const isPaid =
          data.status === 'SUCCESSFUL' ||
          data.status === 'paid' ||
          data.status === 'succeeded' ||
          data.status === 'SUCCESS' ||
          data.data?.status === 'SUCCESSFUL' ||
          data.data?.status === 'paid';

        return {
          success: isPaid,
          status: isPaid ? 'SUCCESSFUL' : data.status || 'PENDING',
          reference,
          amount_kobo: data.amount || data.data?.amount || 0,
          currency: data.currency || data.data?.currency || 'NGN',
          channel: data.payment_method || data.channel || 'bachs',
          paid_at: data.paid_at || new Date().toISOString(),
          raw_data: data,
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          reference,
          amount_kobo: 0,
          currency: 'NGN',
          channel: 'bachs',
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
        channel: 'bachs',
        paid_at: new Date().toISOString(),
        raw_data: { error: err.message },
      };
    }
  }

  public async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResponse> {
    throw new Error('Bachs refunds are not implemented. Configure a supported provider before enabling refunds.');
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

// Export backward compatible alias
export const BachsSandboxProvider = BachsPaymentProvider;
