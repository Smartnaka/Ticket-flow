# TicketWave Production Deployment Guide

This guide outlines the complete procedure for deploying **TicketWave** to production environments (such as Google Cloud Run, AWS ECS, DigitalOcean App Platform, or custom Linux VPS instances) with PostgreSQL database integration, secure environment variables, payment provider webhooks, and production server setup.

---

## 1. Architecture Overview

TicketWave operates as a unified Express + Vite Node.js service:
- **Frontend**: Single-Page React Application served statically in production from `./dist`.
- **Backend Service**: Express API bundled into CommonJS (`dist/server.cjs`) via `esbuild`.
- **Database Layer**: PostgreSQL database instance handling transactional operations, inventory locking, and audit logs.
- **Port & Ingress**: Listens on port `3000` (host `0.0.0.0`) behind NGINX / Cloud Run load balancers.

---

## 2. Environment Variables & Production Secrets

Create a `.env` file in the root directory (or inject variables via your Cloud Provider Secrets Manager):

```env
# ------------------------------------------------------------------------------
# 1. Security & Authentication
# ------------------------------------------------------------------------------
# High-entropy secret key for signing JWT tokens (min 32 random bytes)
JWT_SECRET="e9a4f8b2c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5"

# ------------------------------------------------------------------------------
# 2. Database Configuration
# ------------------------------------------------------------------------------
# Connection string for production PostgreSQL
DATABASE_URL="postgresql://ticketwave_user:SECURE_PASSWORD@pg-host.example.com:5432/ticketwave_prod?sslmode=require"

# ------------------------------------------------------------------------------
# 3. Payment Gateway Credentials
# ------------------------------------------------------------------------------
# Provider choice: 'bachs' | 'paystack' | 'flutterwave'
PAYMENT_PROVIDER="bachs"

# Secret API Key from your payment provider portal
PAYMENT_SECRET_KEY="bachs_sk_live_9f8d7c6b5a4e3d2c1b0a"

# Public Client Key from payment provider portal
PAYMENT_PUBLIC_KEY="bachs_pk_live_1a2b3c4d5e6f7g8h9i0j"

# Webhook Secret used to verify HMAC SHA-512 signatures from payment webhooks
PAYMENT_WEBHOOK_SECRET="bachs_whsec_live_7x8y9z0a1b2c3d4e5f"

# ------------------------------------------------------------------------------
# 4. Application & Domain Settings
# ------------------------------------------------------------------------------
# Canonical URL of your deployed application
APP_URL="https://ticketwave.app"

# Application Environment Mode
NODE_ENV="production"

# Platform Service Fee Percentage (e.g., 5 = 5%)
PLATFORM_FEE_PERCENTAGE="5"

# ------------------------------------------------------------------------------
# 5. Transactional Email Provider
# ------------------------------------------------------------------------------
EMAIL_PROVIDER_KEY="re_123456789_resend_live_key"
FROM_EMAIL="tickets@ticketwave.app"
```

---

## 3. Database Migration & Schema Setup

### Step A: Provision PostgreSQL Instance
Ensure your PostgreSQL database server is provisioned (PostgreSQL v14+) and accepts SSL connections.

### Step B: Run Schema Migrations
Execute the migration tool to initialize all tables, foreign keys, indexes, and constraints:

```bash
# Run database migrations
npm run db:migrate
```

Or apply DDL schema scripts directly:

```sql
-- Core Schema Initializer
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  role VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_passwords (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE events (
  id VARCHAR(64) PRIMARY KEY,
  organizer_id VARCHAR(64) NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL,
  venue VARCHAR(255) NOT NULL,
  city VARCHAR(128) NOT NULL,
  state VARCHAR(128),
  country VARCHAR(128) DEFAULT 'Nigeria',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  image_url TEXT,
  status VARCHAR(32) DEFAULT 'PUBLISHED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_types (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  price_kobo BIGINT NOT NULL DEFAULT 0,
  quantity_available INT NOT NULL,
  quantity_sold INT NOT NULL DEFAULT 0,
  max_per_order INT NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  subtotal_kobo BIGINT NOT NULL,
  platform_fee_kobo BIGINT NOT NULL,
  processing_fee_kobo BIGINT NOT NULL,
  total_kobo BIGINT NOT NULL,
  currency VARCHAR(8) DEFAULT 'NGN',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  payment_reference VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id),
  event_id VARCHAR(64) NOT NULL REFERENCES events(id),
  ticket_type_id VARCHAR(64) NOT NULL REFERENCES ticket_types(id),
  ticket_number VARCHAR(128) UNIQUE NOT NULL,
  qr_code_data TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'VALID',
  scanned_at TIMESTAMP,
  scanned_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_events (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(64) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload_json TEXT NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64),
  actor_role VARCHAR(32),
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64),
  entity_id VARCHAR(64),
  details_json TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_orders_reference ON orders(payment_reference);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
```

---

## 4. Building the Application Services

Run the build process to compile both the frontend React client and the backend Express bundle:

```bash
# Clean & compile production build
npm run build
```

This command executes:
1. `vite build`: Compiles the React SPA into static assets in `/dist`.
2. `esbuild server.ts`: Bundles `server.ts` into a CommonJS production file at `dist/server.cjs`.

---

## 5. Starting the Production Server

Start the application using Node.js:

```bash
# Start server in production mode
NODE_ENV=production PORT=3000 node dist/server.cjs
```

### Health Check Verification
To verify the deployment is operating normally:

```bash
curl -f http://localhost:3000/api/health
```
Expected output:
```json
{"status":"ok","timestamp":"2026-08-11T15:58:00.000Z"}
```

---

## 6. Configuring Payment Provider Webhooks

In your payment provider developer dashboard (Bachs.io, Paystack, or Flutterwave), set up your live webhook endpoint:

- **Webhook URL**: `https://your-domain.com/api/webhooks/payment`
- **Events Subscribed**: `collection.succeeded`, `collection.failed`, `charge.success`
- **Secret Signature Key**: Copy the provider's webhook secret into your production `PAYMENT_WEBHOOK_SECRET` environment variable.

---

## 7. Containerization (Docker)

If deploying via Docker or Kubernetes, use the following Dockerfile:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```
