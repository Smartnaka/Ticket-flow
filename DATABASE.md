# TicketWave Database Schema Documentation

TicketWave uses a normalized relational SQL schema with ACID isolation and inventory locking mechanisms.

## Schema ERD & Table Specifications

### 1. `users`
Stores user credentials and roles.
- `id` (VARCHAR PRIMARY KEY): `usr_*` UUID format.
- `email` (VARCHAR UNIQUE NOT NULL): Customer or organizer email address.
- `name` (VARCHAR NOT NULL): Full name.
- `phone` (VARCHAR): Contact phone number.
- `role` (VARCHAR NOT NULL): `'CUSTOMER' | 'ORGANIZER' | 'ADMIN'`.
- `is_suspended` (BOOLEAN DEFAULT FALSE): Account status flag.
- `created_at`, `updated_at` (TIMESTAMP).

### 2. `organizers`
Profiles for event hosts.
- `id` (VARCHAR PRIMARY KEY): `org_*`.
- `user_id` (VARCHAR FOREIGN KEY -> `users.id`).
- `organization_name` (VARCHAR NOT NULL).
- `bio`, `website`, `bank_name`, `account_number`, `account_name`.
- `is_verified` (BOOLEAN).

### 3. `events`
Event listings.
- `id` (VARCHAR PRIMARY KEY): `evt_*`.
- `organizer_id` (VARCHAR FOREIGN KEY -> `organizers.id`).
- `title` (VARCHAR NOT NULL).
- `slug` (VARCHAR UNIQUE NOT NULL): URL-friendly identifier.
- `description` (TEXT).
- `cover_image` (VARCHAR).
- `location`, `venue`, `city`, `country`, `category`.
- `start_date`, `end_date` (TIMESTAMP).
- `status` (VARCHAR): `'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'`.
- `max_capacity` (INTEGER).

### 4. `ticket_types`
Ticket pricing tiers and inventory counts.
- `id` (VARCHAR PRIMARY KEY): `tt_*`.
- `event_id` (VARCHAR FOREIGN KEY -> `events.id`).
- `name` (VARCHAR): e.g., "Regular Pass", "VIP Experience".
- `price_kobo` (BIGINT NOT NULL): Price stored in integer minor units (Kobo). `500000` = ₦5,000.
- `currency` (VARCHAR): DEFAULT `'NGN'`.
- `quantity_available` (INTEGER NOT NULL): Total tickets created.
- `quantity_reserved` (INTEGER DEFAULT 0): Currently locked in pending checkout orders.
- `quantity_sold` (INTEGER DEFAULT 0): Paid tickets sold.
- `max_per_customer` (INTEGER DEFAULT 5).

### 5. `orders`
Customer checkout purchases.
- `id` (VARCHAR PRIMARY KEY): `ord_*`.
- `customer_id` (VARCHAR FOREIGN KEY -> `users.id`).
- `event_id` (VARCHAR FOREIGN KEY -> `events.id`).
- `subtotal_kobo`, `platform_fee_kobo`, `processing_fee_kobo`, `total_kobo` (BIGINT).
- `status` (VARCHAR): `'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED'`.
- `payment_reference` (VARCHAR UNIQUE NOT NULL): `TW-PAY-*`.
- `idempotency_key` (VARCHAR).
- `expires_at` (TIMESTAMP): 15-minute reservation window.

### 6. `tickets`
Issued ticket passes.
- `id` (VARCHAR PRIMARY KEY): `tkt_*`.
- `ticket_number` (VARCHAR UNIQUE NOT NULL): e.g. `TKT-2026-REG-99128`.
- `order_id` (VARCHAR FOREIGN KEY -> `orders.id`).
- `qr_code_hash` (VARCHAR UNIQUE NOT NULL): Cryptographic token.
- `status` (VARCHAR): `'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED'`.
- `scanned_at`, `scanned_by`.

### 7. `payments`
Gateway transaction records.
- `id` (VARCHAR PRIMARY KEY): `pay_*`.
- `order_id` (VARCHAR FOREIGN KEY -> `orders.id`).
- `amount_kobo` (BIGINT).
- `provider` (VARCHAR): `'paystack' | 'flutterwave'`.
- `provider_reference` (VARCHAR).
- `status` (VARCHAR): `'PENDING' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED'`.

### 8. `webhook_events`
Idempotency log of all received provider webhooks.
- `id` (VARCHAR PRIMARY KEY): Provider event reference.
- `provider` (VARCHAR).
- `event_type` (VARCHAR).
- `payload_json` (TEXT).
- `processing_status` (VARCHAR): `'RECEIVED' | 'PROCESSED' | 'FAILED' | 'DUPLICATE_IGNORED'`.

### 9. `audit_logs`
Traceable action history.
- `id` (VARCHAR PRIMARY KEY).
- `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `details_json`, `created_at`.
