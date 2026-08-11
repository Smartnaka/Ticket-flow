import crypto from 'crypto';
import {
  InitializePaymentParams,
  InitializePaymentResponse,
  PaymentProvider,
  RefundPaymentParams,
  RefundPaymentResponse,
  VerifyPaymentResponse,
} from './types';

export class FlutterwaveSandboxProvider implements PaymentProvider {
  public name = 'flutterwave';
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
        'Flutterwave Secret Key (PAYMENT_SECRET_KEY) is missing. Please enter your Flutterwave secret key in your environment variables.',
      );
    }

    const customerEmail = params.email || params.customer_email || 'customer@example.com';
    const customerName = params.customer_name || 'Valued Customer';

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: params.reference,
        amount: params.amount_kobo / 100,
        currency: params.currency || 'NGN',
        redirect_url: params.callback_url || `${this.appUrl}/payment-status?ref=${params.reference}`,
        customer: {
          email: customerEmail,
          name: customerName,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.data?.link) {
      throw new Error(`Flutterwave API Error: ${data.message || 'Payment initialization failed'}`);
    }

    return {
      success: true,
      authorization_url: data.data.link,
      access_code: params.reference,
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
        channel: 'flutterwave',
        paid_at: new Date().toISOString(),
        raw_data: { error: 'PAYMENT_SECRET_KEY missing' },
      };
    }

    try {
      const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'success' && data.data?.status === 'successful') {
        return {
          success: true,
          status: 'SUCCESSFUL',
          reference,
          amount_kobo: Math.round((data.data.amount || 0) * 100),
          currency: data.data.currency || 'NGN',
          channel: data.data.payment_type || 'flutterwave',
          paid_at: data.data.created_at || new Date().toISOString(),
          raw_data: data.data,
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          reference,
          amount_kobo: 0,
          currency: 'NGN',
          channel: 'flutterwave',
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
        channel: 'flutterwave',
        paid_at: new Date().toISOString(),
        raw_data: { error: err.message },
      };
    }
  }

  public async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResponse> {
    const refundRef = `flw_rf_${crypto.randomBytes(6).toString('hex')}`;
    return {
      success: true,
      refund_reference: refundRef,
      status: 'REFUNDED',
      amount_kobo: params.amount_kobo,
      raw_data: { provider: 'flutterwave_sandbox', reason: params.reason },
    };
  }

  public verifyWebhookSignature(payloadRaw: string, signature: string): boolean {
    if (!signature) return false;
    // Flutterwave secret verif-hash comparison
    return signature === this.webhookSecret;
  }
}
