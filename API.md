# TicketWave REST API Reference

## Authentication Endpoints

### `POST /api/auth/register`
Register a new customer or organizer account.
- **Request**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecretPassword123!",
    "name": "Chidi Okonkwo",
    "role": "CUSTOMER" // or "ORGANIZER"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": { "id": "usr_123", "email": "user@example.com", "role": "CUSTOMER" }
  }
  ```

### `POST /api/auth/login`
Authenticate existing user.
- **Request**: `{ "email": "user@example.com", "password": "SecretPassword123!" }`
- **Response** (`200 OK`): `{ "token": "...", "user": { ... } }`

---

## Event Endpoints

### `GET /api/events`
Get public list of published events with category/search filters.
- **Query Params**: `category=Technology&search=lagos`
- **Response** (`200 OK`): Array of events with ticket type tiers.

### `GET /api/events/:slug`
Get event detail by URL slug or ID.

### `POST /api/events`
Create a new event with ticket tiers (Requires Organizer JWT).
- **Request**:
  ```json
  {
    "title": "Lagos AI Summit 2026",
    "description": "Premier AI summit",
    "venue": "Eko Hotel",
    "city": "Lagos",
    "start_date": "2026-10-01T09:00:00Z",
    "end_date": "2026-10-02T18:00:00Z",
    "ticket_types": [
      { "name": "Regular Pass", "price": "5000", "quantity": "500" },
      { "name": "VIP Pass", "price": "15000", "quantity": "100" }
    ]
  }
  ```

---

## Checkout & Payment Endpoints

### `POST /api/checkout`
Server-authoritative checkout validation and stock reservation.
- **Request**:
  ```json
  {
    "event_id": "evt_tech_summit_2026",
    "customer_name": "Chidi Okonkwo",
    "customer_email": "customer@example.com",
    "items": [
      { "ticket_type_id": "tt_regular_001", "quantity": 2 }
    ]
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "order": {
      "id": "ord_8812",
      "subtotal_kobo": 1000000,
      "platform_fee_kobo": 50000,
      "processing_fee_kobo": 30000,
      "total_kobo": 1080000,
      "payment_reference": "TW-PAY-882910394",
      "status": "PENDING",
      "expires_at": "2026-08-11T13:40:00.000Z"
    }
  }
  ```

### `POST /api/payments/initialize`
Initialize payment authorization with sandbox provider.
- **Request**: `{ "order_id": "ord_8812", "provider_name": "paystack" }`
- **Response** (`200 OK`): `{ "authorization_url": "http://localhost:3000/sandbox-checkout?...", "reference": "TW-PAY-882910394" }`

### `POST /api/webhooks/payments`
Cryptographic payment webhook listener.

---

## Ticket Scanner Endpoints

### `POST /api/tickets/validate`
Organizer ticket scanner validation endpoint.
- **Request**: `{ "ticket_data": "TKT-2026-REG-99128" }`
- **Response**: `{ "success": true, "message": "✓ Ticket Valid!", "ticket": { ... } }`

---

## Refund Endpoints

### `POST /api/refunds`
Process provider refund for paid order (Requires Organizer / Admin JWT).
- **Request**: `{ "order_id": "ord_8812", "reason": "Customer request" }`
- **Response**: `{ "id": "ref_101", "status": "REFUNDED", "amount_kobo": 1080000 }`
