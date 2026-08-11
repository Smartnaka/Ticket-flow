# Project Analysis & Architecture Plan

## 1. Current Architecture
- **Framework & Runtime**: React 19, TypeScript, Vite 6 with `@tailwindcss/vite` v4 plugin.
- **Dependencies**: Express 4, Motion 12, Lucide React 0.546, `@google/genai`, `dotenv`, `qrcode`, `bcryptjs`, `jsonwebtoken`.
- **Existing Setup**: Fresh template entry point (`src/main.tsx`, `src/App.tsx`) with no prior custom business logic.

## 2. Existing Features
- Base React root component and global CSS with Tailwind v4 setup.
- Basic Vite dev server configuration on port 3000.

## 3. What Needs to Change
- **Full-Stack Server (`server.ts`)**: Transform the single-page shell into an Express + Vite full-stack server running on port 3000 with proper production build scripts (`esbuild` bundle to `dist/server.cjs`).
- **Database Architecture**: Implement a normalized SQL database engine with ACID transactions, parameterized queries, UUID primary keys, and table schemas for users, organizers, events, ticket_types, orders, order_items, tickets, payments, refunds, webhook_events, and audit_logs.
- **Payment Lifecycle & Idempotency**: Build a strict payment provider abstraction interface (`PaymentProvider`) with Paystack/Flutterwave sandbox implementation, cryptographic HMAC SHA-512 webhook signature verification, and duplicate-proof event execution via `webhook_events`.
- **Concurrency & Inventory Locking**: Implement atomic row locking/transactional reservations during checkout so concurrent purchases cannot oversell limited ticket quantities.
- **Role-Based Authentication**: Support JWT auth with pass-hashing (`bcryptjs`), covering Customer, Organizer, and Admin roles with authorization middleware.
- **State Machines**: Enforce deterministic states for Orders (`PENDING`, `PAID`, `CANCELLED`, `REFUNDED`, `EXPIRED`), Payments (`PENDING`, `PROCESSING`, `SUCCESSFUL`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`), and Tickets (`VALID`, `USED`, `CANCELLED`, `REFUNDED`).
- **Ticket Verification System**: Secure QR code generation containing cryptographic validation tokens and an organizer ticket scanner with double-scan prevention.
- **Background Cron Engine**: Automated order reservation release runner that expires unfulfilled orders after 15 minutes and restores inventory.
- **Observability & Analytics**: Financial metrics in integer minor units (Kobo: ₦1 = 100 kobo), detailed organizer/admin analytical dashboards, and audit log tracking.

## 4. What Can Be Reused
- Vite configuration with aliases (`@/*`).
- Tailwind v4 utility configuration and styling setup.
- React 19 structure with Lucide icons and Motion layout transitions.

## 5. Recommended Production Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer (React)                   │
│   [Customer Portal]  │  [Organizer Studio] │ [Admin Hub]    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Server                   │
│  ├── /api/auth       (JWT Auth & Role Enforcement)          │
│  ├── /api/events     (Event & Ticket Type Lifecycle)        │
│  ├── /api/checkout   (Server Pricing & Stock Reservations)  │
│  ├── /api/payments   (Payment Provider Abstraction)         │
│  ├── /api/webhooks   (HMAC Signature & Idempotency Engine)  │
│  ├── /api/tickets    (QR Code Generation & Scanner Engine)  │
│  ├── /api/refunds    (Provider Refund Execution & Audit)   │
│  └── /api/analytics  (Revenue Metrics & Audit Logs)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     Core Infrastructure                      │
│   [SQL Relational DB]   │  [Payment Sandbox]  │ [Job Runner]│
└─────────────────────────────────────────────────────────────┘
```

## 6. Backend & Database Schema Requirements
- Tables: `users`, `organizers`, `events`, `ticket_types`, `orders`, `order_items`, `tickets`, `payments`, `refunds`, `webhook_events`, `audit_logs`.
- All monetary amounts stored as integer minor units (kobo). Floating point calculations are strictly prohibited for financial operations.
- Indexes on `events.slug`, `orders.payment_reference`, `webhook_events.event_id`, `tickets.ticket_number`, and `tickets.qr_code_hash`.

## 7. Payment Integration Requirements
- **Service Interface**: `initializePayment(params)`, `verifyPayment(reference)`, `refundPayment(params)`.
- **Providers**: `PaystackSandboxProvider` and `FlutterwaveSandboxProvider` adhering to the interface.
- **Webhooks**: Must verify `x-paystack-signature` or `verif-hash`, check `webhook_events` for existing processing before executing order status updates, and remain completely idempotent.
