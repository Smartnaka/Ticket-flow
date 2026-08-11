# TicketWave - Production-Grade Event Ticketing & Payment Platform

TicketWave is an event ticketing and payment processing platform designed for organizers to host events, sell tickets, receive automated payments via Paystack and Flutterwave, and validate attendee entry via cryptographically secure QR codes.

## 🚀 Key Features

- **Multi-Role Portals**: Customer, Organizer Studio, and Admin Hub.
- **Server-Authoritative Financial Engine**: All currency calculations are executed strictly on the backend using integer minor units (Kobo) to eliminate floating-point precision flaws.
- **Payment Gateway Abstraction**: Clean provider interface (`PaymentProvider`) supporting Paystack and Flutterwave sandbox environments.
- **Webhook Idempotency Engine**: Cryptographic HMAC SHA-512 signature verification and duplicate event rejection via `webhook_events`.
- **Inventory Concurrency Locks**: Atomic reservations during checkout to prevent overselling limited ticket tiers during high-demand rushes.
- **Cryptographic QR Pass System**: Generates unique QR codes for every ticket with instant organizer scanner validation and double-entry protection.
- **Automated Reservation Expiration**: Background job runner expiring unfulfilled pending orders after 15 minutes and returning stock to inventory.
- **Full Test Suite**: Comprehensive unit and integration test runner (`npm test`).

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion.
- **Backend**: Express 4, Node.js, `tsx`, `esbuild`.
- **Database**: SQL Relational Architecture with ACID transaction isolation.
- **Payments**: Paystack Sandbox & Flutterwave Sandbox providers.
- **Security & Utilities**: `bcryptjs`, `jsonwebtoken`, `qrcode`, `crypto`.

## 📦 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Access the application at `http://localhost:3000`.

### 3. Run Automated Tests
```bash
npm test
```

## 📄 Platform Documentation

- [`PROJECT_ANALYSIS.md`](./PROJECT_ANALYSIS.md): Initial project inspection and recommended architecture.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): System design, component hierarchy, and execution flow.
- [`DATABASE.md`](./DATABASE.md): Relational database schema, indexes, and ACID locking mechanism.
- [`PAYMENTS.md`](./PAYMENTS.md): Payment abstraction, minor unit math, and sandbox checkout.
- [`WEBHOOKS.md`](./WEBHOOKS.md): Signature validation, idempotency engine, and payload handlers.
- [`API.md`](./API.md): Full REST API endpoint reference and payload examples.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md): Containerization, environment variables, and Cloud Run production setup.
