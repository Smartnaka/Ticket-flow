# TicketWave Payment Architecture Documentation

## Financial Calculations & Minor Currency Units

To prevent precision loss from JavaScript floating-point arithmetic (e.g. `0.1 + 0.2 = 0.30000000000000004`), **all financial values in TicketWave are stored and calculated strictly in integer minor units (Kobo)**.

- ₦1 = 100 Kobo
- ₦5,000 = `500000` Kobo
- ₦15,000 = `1500000` Kobo

### Fee Breakdown Formula
```typescript
const subtotalKobo = items.reduce((sum, item) => sum + (item.price_kobo * item.quantity), 0);
const platformFeeKobo = Math.round(subtotalKobo * 0.05); // 5% Platform Fee
const processingFeeKobo = subtotalKobo > 0 ? 30000 : 0;   // ₦300 Gateway Processing Fee
const totalKobo = subtotalKobo + platformFeeKobo + processingFeeKobo;
```

## Payment Provider Abstraction Interface

TicketWave uses a polymorphic payment abstraction interface:

```typescript
export interface PaymentProvider {
  name: string;
  initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse>;
  verifyPayment(reference: string): Promise<VerifyPaymentResponse>;
  refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResponse>;
  verifyWebhookSignature(payloadRaw: string, signature: string): boolean;
}
```

### Supported Providers
1. **Paystack Sandbox (`PaystackSandboxProvider`)**:
   - Uses HMAC SHA-512 cryptographic verification (`x-paystack-signature`).
   - Simulates card authorization URLs and postback triggers.

2. **Flutterwave Sandbox (`FlutterwaveSandboxProvider`)**:
   - Uses `verif-hash` secret signature verification.
   - Handles sandbox redirects and charge webhooks.

## Payment States Machine

```
                 [Customer Initiates Checkout]
                               │
                        (Order: PENDING)
                        (Payment: PENDING)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [Payment Webhook: Success]     [Payment Webhook: Declined]
               │                               │
       (Order: PAID)                 (Order: CANCELLED)
   (Payment: SUCCESSFUL)             (Payment: FAILED)
   [Generate Tickets & Email]        [Release Inventory Stock]
               │
               ▼
    [Refund Requested / Executed]
               │
       (Order: REFUNDED)
     (Payment: REFUNDED)
     (Tickets: REFUNDED)
```
