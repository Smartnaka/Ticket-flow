# Production readiness

## Persistence

TicketWave now starts with an empty, durable SQLite database rather than loading demo
accounts, events, orders, tickets, or payment records. Set `DATABASE_URL` to a
`file:` URL on a **persistent, backed-up volume** (for example,
`file:/var/lib/ticketwave/ticketwave.db`). SQLite WAL mode is enabled and is suitable
for a single application instance. Do not run multiple replicas against this file;
move to a managed PostgreSQL implementation before horizontal scaling.

Development fixtures are available only through `seedInitialDataForDevelopment()` in
the test runner and are never invoked by the server.

## Required production configuration

The server refuses to start in production unless it has a strong `JWT_SECRET`, a
SQLite URL, HTTPS `APP_URL`, payment configuration, and Resend email configuration.
Copy `.env.example` and provide values through the deployment platform's secret
manager; never commit `.env` files.

`EMAIL_PROVIDER_KEY` is a Resend API key and `FROM_EMAIL` must be a verified Resend
sender. Paystack refunds call the live refund API. Bachs and Flutterwave refunds are
deliberately rejected until their provider-specific refund implementations and
transaction identifiers are configured, so an order cannot be falsely marked
refunded.

## Deployment checklist

1. Mount a writable persistent volume at the database path and test restoration after
   a restart.
2. Configure HTTPS at the load balancer, `APP_URL`, payment webhook URL, and provider
   webhook signing secret.
3. Run `npm run build`, then `NODE_ENV=production npm start`.
4. Verify `GET /api/health`, registration, email delivery, payment initialization,
   webhook signature validation, ticket issuance, scanning, and refund lifecycle.
5. Back up the SQLite file before every deployment and monitor disk capacity.
