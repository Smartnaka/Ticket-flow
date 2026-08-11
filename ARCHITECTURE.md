# TicketWave Architecture Documentation

## System Architecture Overview

TicketWave is architected as a modular full-stack web application. The backend Express server runs on port 3000 and serves both REST API endpoints and Vite static assets.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer (React 19)                │
│   ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐ │
│   │ Customer Portal  │ │ Organizer Studio │ │ Admin Hub   │ │
│   └─────────┬────────┘ └─────────┬────────┘ └──────┬──────┘ │
└─────────────┼────────────────────┼─────────────────┼────────┘
              │                    │                 │
              └────────────────────┼─────────────────┘
                                   │ HTTP / JSON REST APIs
┌──────────────────────────────────▼──────────────────────────┐
│                   Express Backend Server (port 3000)        │
│                                                             │
│   ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐ │
│   │ Auth Routes      │ │ Event Routes     │ │ Checkout    │ │
│   └──────────────────┘ └──────────────────┘ └──────┬──────┘ │
│   ┌──────────────────┐ ┌──────────────────┐        │        │
│   │ Payment Routes   │ │ Webhook Engine   │<───────┤        │
│   └──────────────────┘ └──────────────────┘        │        │
│   ┌──────────────────┐ ┌──────────────────┐        │        │
│   │ Ticket/QR Scanner│ │ Analytics/Audit  │        │        │
│   └──────────────────┘ └──────────────────┘        │        │
└──────────────────────────────────┬─────────────────┼────────┘
                                   │                 │
┌──────────────────────────────────▼─────────────────▼────────┐
│                   Core Infrastructure Layer                  │
│  ┌────────────────────────┐  ┌───────────────────────────┐  │
│  │ SQL Relational Engine  │  │ Payment Sandbox Abstraction│ │
│  │ (ACID & Inventory Lock)│  │ (Paystack / Flutterwave)  │  │
│  └────────────────────────┘  └───────────────────────────┘  │
│  ┌────────────────────────┐  ┌───────────────────────────┐  │
│  │ Order Expiry Runner    │  │ QR & Email Service        │  │
│  └────────────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Modular Layer Breakdown

1. **Client Layer (`/src/`)**:
   - `App.tsx`: Main router, role state switcher (`CUSTOMER`, `ORGANIZER`, `ADMIN`), view context.
   - `Navbar.tsx`: Top header navigation with role switcher and user profile.
   - `EventCard.tsx` & `TicketCard.tsx`: Reusable display cards with status badges and QR code viewing.
   - `CheckoutModal.tsx`: Secure checkout flow displaying server-calculated price breakdowns.
   - `OrganizerScanner.tsx`: Gate scanning tool supporting QR input validation and double-scan prevention.
   - `DevToolsPanel.tsx`: Sandbox testing studio for simulating duplicate webhooks and triggering background jobs.

2. **Backend API Layer (`/src/routes/`)**:
   - `authRoutes.ts`: Registration, JWT authentication, and user profile resolution.
   - `eventRoutes.ts`: Public event listing with category/search filters, event details by slug, and organizer creation.
   - `checkoutRoutes.ts`: Server-authoritative checkout processor that calculates subtotal, platform fees (5%), processing fees, and locks ticket stock atomically.
   - `paymentRoutes.ts`: Initializes payment authorization URLs with selected provider.
   - `webhookRoutes.ts`: Cryptographic webhook receiver with HMAC signature validation and idempotency handling.
   - `ticketRoutes.ts`: Ticket list query, individual ticket metadata, and gate validation endpoint.
   - `refundRoutes.ts`: Provider refund processing and ticket cancellation.
   - `analyticsRoutes.ts`: Real-time financial metrics for organizers and administrators.

3. **Domain & Services Layer (`/src/services/`)**:
   - `payment/`: Polymorphic payment abstraction interface (`PaymentProvider`) with implementations for `PaystackSandboxProvider` and `FlutterwaveSandboxProvider`.
   - `webhook.ts`: Atomic webhook processing logic ensuring idempotent execution.
   - `ticket.ts`: Ticket generation, high-density QR code creation via `qrcode`, and gate scan validation.
   - `email.ts`: Email dispatch abstraction logging sent notifications.
   - `auth.ts`: Password hashing (`bcryptjs`) and JWT token signing.
