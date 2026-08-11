# TicketWave Webhook Architecture & Idempotency Engine

Payment webhooks are the authoritative mechanism used by TicketWave to confirm payments and issue tickets. The system never relies on frontend redirects alone to mark orders as paid.

## Endpoint Specification

- **Method**: `POST`
- **Path**: `/api/webhooks/payments?provider=paystack` (or `provider=flutterwave`)
- **Headers**:
  - Paystack: `x-paystack-signature`
  - Flutterwave: `verif-hash`

## Cryptographic Signature Verification

Every incoming request is verified using timing-safe buffer comparison to prevent timing side-channel attacks:

```typescript
const hmac = crypto.createHmac('sha512', WEBHOOK_SECRET);
const expectedSignature = hmac.update(rawPayload).digest('hex');

const sigBuffer = Buffer.from(signature, 'utf-8');
const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

if (sigBuffer.length !== expectedBuffer.length) return false;
return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
```

If the signature fails verification, the request is logged to the audit trail and immediately rejected with `HTTP 401 Unauthorized`.

## Idempotency Engine Execution Flow

When webhooks arrive multiple times (due to payment provider retries or network duplications), TicketWave ensures **zero duplicate order fulfillments**:

```
[Incoming Webhook Request]
            │
            ▼
[Cryptographic Signature Check] ────(Invalid)────► Return 401 Unauthorized
            │
         (Valid)
            ▼
[Check webhook_events Table]
            │
  ┌─────────┴─────────┐
  │                   │
(Already PROCESSED)  (New Event ID)
  │                   │
  ▼                   ▼
Return 200 OK      [Execute Atomic Order Fulfillment]
{ status:          1. Update Order -> PAID
  "ignored_dup"}   2. Update Payment -> SUCCESSFUL
                   3. Generate Unique Ticket Passes & QR Data URLs
                   4. Dispatch Email Confirmation
                   5. Mark webhook_events -> PROCESSED
                   6. Record Audit Log
                   7. Return 200 OK
```

## Testing Webhooks & Idempotency

Developers can test webhook behavior in the UI:
1. Navigate to the **Developer & Sandbox Testing Studio** (`/dev-tools` icon in header).
2. Click **"Send 1st Webhook"** -> Generates tickets and fulfills order.
3. Click **"Send Duplicate Webhook"** -> Safely returns `{ status: "ignored_duplicate" }` and preserves single order state.
