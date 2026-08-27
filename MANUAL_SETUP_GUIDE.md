# Manual Setup Guide

> **Scope:** This guide documents the application exactly as it is now. It does not ask you to change application code. When project documentation disagrees with the running code, this guide follows the running code.

## 1. Project Overview

TicketWave is a full-stack event-ticketing application. Visitors can browse events; customers can register, buy tickets, receive QR tickets, and view them; organizers can create events and scan tickets; administrators can view analytics. The frontend is React 19 + Vite + Tailwind, and the backend is an Express/TypeScript server that serves both the API and built frontend.

The current runtime database is a **local SQLite file** accessed through Node.js's built-in `node:sqlite` module. The app persists one application-state record in that SQLite file and starts with no demo records. It is intended for **one running app instance with a persistent disk**. A PostgreSQL connection string is **not supported by the current code**.

## 2. Prerequisites

Install these before beginning:

1. **Node.js 22 or newer.** Node 22 is required because the database uses the built-in `node:sqlite` module.
2. **npm** (normally installed with Node).
3. A terminal and Git.
4. For live payments, an account with **one** supported payment provider: Paystack, Flutterwave, or Bachs. Start with test credentials.
5. For production email, a **Resend** account and a verified sender address.
6. For production, a host that provides:
   - HTTPS for your public domain;
   - a writable **persistent volume** for the SQLite database file;
   - one application instance only.

Already configured — no separate frontend hosting, backend hosting, OAuth provider, Redis service, or migration tool is required by the current codebase.

## 3. Environment Variables

Create `.env` in the repository root by copying `.env.example`. `.env` is intentionally ignored by Git; never commit it.

### Already configured in `.env.example` (replace placeholder values before production)

| Variable | What it does | Required? | Where to get it | Environment |
|---|---|---:|---|---|
| `NODE_ENV` | Selects development or production behavior. Production enables startup validation and static-file serving. | Required for production; optional locally (defaults to development behavior). | You choose `development` or `production`. | Both |
| `APP_URL` | Public app address used for payment-return and password-reset links; it is also the permitted browser CORS origin. | Required in production. | Your local URL (`http://localhost:3000`) or deployed HTTPS domain. | Both |
| `DATABASE_URL` | SQLite database file location. It **must** begin with `file:`. | Required in production; local default exists. | You choose a local path or persistent-volume path. | Both |
| `PLATFORM_FEE_PERCENTAGE` | Percentage fee added by checkout. | Optional; defaults to `5`. | You choose the platform fee policy. | Both |
| `PORT` | Listening port. | Optional; defaults to `3000`. | Your host/platform. | Both |
| `DISABLE_HMR` | Disables Vite hot-module reloading and file watching. | Optional. | Set `true` only when you specifically need it. | Development only |

### You must configure manually

| Variable | What it does | Required? | Where to get it | Environment |
|---|---|---:|---|---|
| `JWT_SECRET` | Signs and verifies the app's JWT login tokens. | Yes. Production requires at least 32 characters. | Generate a high-entropy random secret with a password manager or secrets tool. Do not use the example text. | Both |
| `PAYMENT_PROVIDER` | Chooses the active provider: `paystack`, `flutterwave`, or `bachs`. | Yes in production. | Choose the provider account you will actually configure. | Both when payments are used |
| `PAYMENT_SECRET_KEY` | Server-side API secret used to initialize and verify payments. | Yes in production. | The selected provider's dashboard/API settings. | Both when payments are used |
| `PAYMENT_WEBHOOK_SECRET` | Verifies incoming provider payment webhooks. | Yes in production. | Selected provider's webhook/dashboard settings. | Both when payments are used |
| `EMAIL_PROVIDER_KEY` | Resend API key used to deliver welcome, reset, ticket, failure, and refund emails. | Yes in production. | Resend dashboard → API Keys. | Production; optional locally |
| `FROM_EMAIL` | Sender address passed to Resend. | Yes in production. | A verified Resend sender/domain address. | Production; optional locally |

### Optional configuration

| Variable | What it does | Required? | Important note |
|---|---|---:|---|
| `PAYMENT_PUBLIC_KEY` | Present in `.env.example`, but the current server code does not read it. | No. | Cannot determine a current runtime use from the codebase — manual verification required if your provider account expects a public key elsewhere. |

### Example local `.env`

Use your own values; do **not** copy these placeholder credentials into a live account.

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
DATABASE_URL=file:./data/ticketwave.db
JWT_SECRET=replace-with-a-long-unique-secret-at-least-32-characters
PAYMENT_PROVIDER=paystack
PAYMENT_SECRET_KEY=your-provider-test-secret-key
PAYMENT_WEBHOOK_SECRET=your-provider-test-webhook-secret
PLATFORM_FEE_PERCENTAGE=5
# Optional in development; email is not delivered when these are absent.
EMAIL_PROVIDER_KEY=
FROM_EMAIL=
```

## 4. Database Setup

### What database does it use?

The current application uses **SQLite**, not PostgreSQL. The `DATABASE_URL` value must be a file URL such as `file:./data/ticketwave.db` or `file:/var/lib/ticketwave/ticketwave.db`.

### What account or service is needed?

- **Local development:** no database account and no database server are needed.
- **Production:** no hosted database account is needed, but your hosting provider must give the process a writable, persistent, backed-up disk/volume. Do not use an ephemeral filesystem.
- **Scaling:** do not run multiple replicas against the SQLite file. The repository documents PostgreSQL as a future horizontal-scaling path, but a PostgreSQL runtime implementation is not present now.

### Create the database

The application creates the SQLite file and its required table automatically at first start. There is no separate creation command.

```bash
mkdir -p data
# The next command creates data/ticketwave.db automatically if it does not exist.
npm run dev
```

For production, create/mount the directory first, then point `DATABASE_URL` at it:

```bash
mkdir -p /var/lib/ticketwave
# Set DATABASE_URL=file:/var/lib/ticketwave/ticketwave.db in your host's environment settings.
```

The hosting process user must be able to read and write that directory.

### Connection-string requirements

- Valid: `file:./data/ticketwave.db`
- Valid: `file:/var/lib/ticketwave/ticketwave.db`
- Invalid for the current code: `postgresql://...`, `mysql://...`, and a plain path without `file:`.

### Migrations and seed data

- **Migrations:** no migration command or migration files are used by the current SQLite implementation. The database table is created automatically at startup.
- **Seed data:** not required and not loaded by the application server. Create real users and events through the app. The automated test command creates and removes its own temporary fixture database.
- **Backups:** use your platform's persistent-volume snapshot/backup facility. `npm run db:backup` is informational only; it does not create a backup file.

## 5. External Services

### Resend (transactional email)

- **Why:** Sends welcome, password-reset, ticket-confirmation, payment-failure, and refund emails.
- **Account:** Required for production email delivery.
- **Credentials:** `EMAIL_PROVIDER_KEY` and `FROM_EMAIL`.
- **Get them:** Resend dashboard → API Keys; Resend dashboard → Domains/Senders to verify the sender/domain.
- **Dashboard configuration:** verify the domain or sender represented by `FROM_EMAIL`. Use a test/sandbox sender for development if your Resend plan supports it; use a verified production domain for live mail.
- **Local behavior:** if `EMAIL_PROVIDER_KEY` or `FROM_EMAIL` is missing outside production, the app does not send mail. This is already configured — no code changes required.

### Payment provider (choose one)

The provider is selected with `PAYMENT_PROVIDER`. The application has adapters for Paystack, Flutterwave, and Bachs. Configure **only the provider you select**. Do not put a test key in a production environment or a live key in a test environment.

- **Paystack:** supports payment initialization, verification, webhook signatures, and a refund API call.
- **Flutterwave:** supports payment initialization, verification, and webhook signature comparison. Refunds are intentionally rejected by the current code because the needed provider transaction identifier is not persisted.
- **Bachs:** supports payment initialization, verification, and HMAC webhook verification. Refunds are intentionally rejected by the current code.

### Other services

- **QR code generation:** runs locally in the application; no account or API key is needed.
- **JWT authentication:** runs locally; no Auth0, Firebase, Clerk, OAuth, or social-login service is configured.
- **Google GenAI package:** it exists in `package.json`, but no runtime use or configuration was found. Cannot determine a required external-service setup from the current codebase — manual verification required.
- **SMS, KYC, banking, fraud, and storage services:** no current runtime integration or credentials were found. Already configured — no action required.

## 6. Authentication Setup

Authentication is implemented inside this app with email/password, bcrypt password hashing, and JWT bearer tokens.

- **Authentication provider:** none external.
- **Required secret:** `JWT_SECRET`.
- **Allowed domains / OAuth redirect URLs:** no OAuth or external identity-provider callback configuration exists. Already configured — no action required.
- **Password-reset link:** generated as `APP_URL/reset-password?token=...`. Ensure `APP_URL` is exactly the address people use to open the application.
- **Local URL:** `http://localhost:3000`.
- **Production URL:** your HTTPS app domain, for example `https://tickets.example.com`.
- **Browser API authorization:** the frontend sends JWTs as `Authorization: Bearer <token>` and stores the token in browser local storage. No manual key configuration beyond `JWT_SECRET` is required.

## 7. Payments & Integrations

### Paystack

1. Create a Paystack account and use its test mode first.
2. In the Paystack dashboard, obtain the test secret key and webhook signing secret.
3. Set:
   ```env
   PAYMENT_PROVIDER=paystack
   PAYMENT_SECRET_KEY=your_paystack_test_secret_key
   PAYMENT_WEBHOOK_SECRET=your_paystack_webhook_secret
   ```
4. Use live keys only after your account is approved and your production webhook URL works.
5. The payment return URL is generated from `APP_URL` as `/payment-status?ref=...`.
6. Refunds call Paystack's refund API; verify your Paystack account has the required live permissions before offering refunds.

### Flutterwave

1. Create a Flutterwave account and retrieve test credentials from its dashboard.
2. Set `PAYMENT_PROVIDER=flutterwave`, the provider secret key, and the webhook verification value in `PAYMENT_WEBHOOK_SECRET`.
3. Configure the webhook path in the next section.
4. The current code does **not** support Flutterwave refunds. Do not promise or enable live refunds until you have manually verified a supported operational process.

### Bachs

1. Create a Bachs account and obtain sandbox/test credentials first.
2. Set `PAYMENT_PROVIDER=bachs`, `PAYMENT_SECRET_KEY`, and `PAYMENT_WEBHOOK_SECRET` from Bachs.
3. The adapter chooses a Bachs sandbox API URL when the secret key looks like a test/sandbox key; use live credentials only in production.
4. The current code does **not** support Bachs refunds. Do not promise or enable live refunds until you have manually verified a supported operational process.

### Financial settings

`PLATFORM_FEE_PERCENTAGE` controls the platform percentage added during checkout. The current default is 5. Confirm your commercial and legal fee policy before changing it.

## 8. Webhooks

The only current inbound webhook endpoint is:

| Service | Events handled by code | Endpoint | Where to configure | Required secret | Test method |
|---|---|---|---|---|---|
| Paystack | `charge.success`, `charge.failed` | `POST https://YOUR_DOMAIN/api/webhooks/payments?provider=paystack` | Paystack dashboard webhook settings | `PAYMENT_WEBHOOK_SECRET`; the request must have `x-paystack-signature` | Use the provider's test dashboard/event tools with a completed test transaction. Verify a 2xx response and that tickets appear. |
| Flutterwave | `charge.success`, `payment.successful`, `charge.failed`, `payment.failed` as recognized by the shared handler | `POST https://YOUR_DOMAIN/api/webhooks/payments?provider=flutterwave` | Flutterwave webhook settings | `PAYMENT_WEBHOOK_SECRET`; request header is `verif-hash` | Use a Flutterwave test transaction and inspect the provider delivery result. |
| Bachs | `collection.succeeded`, `collection.failed` | `POST https://YOUR_DOMAIN/api/webhooks/payments?provider=bachs` | Bachs webhook settings | `PAYMENT_WEBHOOK_SECRET`; request header is `x-bachs-signature` | Use Bachs sandbox delivery/test tooling. |

Important:

- These webhook URLs must be public HTTPS URLs in production. `localhost` is not reachable by a provider. For local webhook testing, use a secure tunnel only if your provider supports it; the repository does not prescribe a tunnel service.
- The request body is verified before payment fulfillment. Do not alter the webhook secret or choose the wrong `provider` query value.
- Webhook events are deduplicated by provider event ID. Repeated deliveries should not issue duplicate tickets.
- `/api/dev/simulate-webhook` exists only outside production. It is not available in production and is not a provider dashboard replacement.

## 9. Local Development

Run these steps in order from the project root:

```bash
# 1. Confirm Node 22+.
node --version

# 2. Install dependencies.
npm install

# 3. Create your private environment file.
cp .env.example .env

# 4. Edit .env and, at minimum, set a strong JWT_SECRET.
# Keep NODE_ENV=development and DATABASE_URL=file:./data/ticketwave.db.

# 5. Optional: add test payment credentials and Resend test credentials.

# 6. Start the app. The SQLite file is created automatically.
npm run dev
```

Open `http://localhost:3000`.

To exercise app flows:

1. Register a new customer or organizer account in the UI.
2. As an organizer, create an event and ticket types.
3. For payment testing, configure the selected provider's **test** credentials and make a test payment.
4. Configure a public tunnel only if you need the external payment provider to deliver a webhook to your local machine.
5. Run checks in another terminal:

```bash
npm run lint
npm test
npm run build
curl -f http://localhost:3000/api/health
```

## 10. Deployment

### Before deploying

1. Choose a host that supports Node 22+ and a persistent writable volume.
2. Use one application instance. The current SQLite implementation is not suitable for multiple replicas.
3. Connect a domain and configure HTTPS at the host/load balancer.
4. Mount persistent storage, for example `/var/lib/ticketwave`, and set `DATABASE_URL=file:/var/lib/ticketwave/ticketwave.db`.
5. Set every production-required environment variable in the platform's secret manager:
   - `NODE_ENV=production`
   - `JWT_SECRET` (32+ characters)
   - `DATABASE_URL`
   - `APP_URL` (must start with `https://`)
   - `PAYMENT_PROVIDER`
   - `PAYMENT_SECRET_KEY`
   - `PAYMENT_WEBHOOK_SECRET`
   - `EMAIL_PROVIDER_KEY`
   - `FROM_EMAIL`
6. Set `APP_URL` to exactly the public HTTPS origin. This is also the allowed CORS browser origin; do not include a trailing path.
7. Configure the chosen payment provider's production webhook URL from Section 8.
8. Verify `FROM_EMAIL` in Resend.

### Commands

```bash
npm install
npm run build
NODE_ENV=production npm start
```

The host may set `PORT`; if it does not, the app uses `3000`. Use `/api/health` as the health check path.

### Deployment configuration that is already handled by the code

- Production startup rejects missing required secrets/configuration.
- Production requires an HTTPS `APP_URL`.
- CORS allows the configured `APP_URL` origin rather than `*`.
- Developer API routes are not mounted in production.
- Static frontend assets are served by the Express process after `npm run build`.

## 11. Testing

Run these exact commands before deployment:

```bash
npm run lint
npm test
npm run build
```

`npm test` creates and removes `data/test-ticketwave.db`; it does not seed your live database.

After deployment, manually verify:

```bash
curl -f https://YOUR_DOMAIN/api/health
```

Then perform a real end-to-end test using test/sandbox payment credentials: create an account, create an event, check out, complete a test payment, confirm the provider's webhook delivery, confirm the ticket appears, and scan it once. Verify the second scan is rejected.

## 12. Common Problems

| What you see | Why it happens | How to verify | What to check |
|---|---|---|---|
| Server exits in production with “Missing required production environment variables.” | A production-required variable is blank or missing. | Read the named variables in the startup error. | Your hosting environment/secret settings, not `.env.example`. |
| Server says `DATABASE_URL must be a file: URL`. | A PostgreSQL URL or plain filesystem path was supplied. | Print/check the deployed `DATABASE_URL` value without exposing it publicly. | Use `file:/persistent/path/ticketwave.db`. |
| Data disappears after deployment/restart. | The SQLite file was on an ephemeral disk or changed path. | Check whether the database file exists and its modification time after restart. | Persistent-volume mount, write permissions, and `DATABASE_URL`. |
| Browser API requests fail due to CORS. | Browser origin does not exactly equal `APP_URL`. | Check browser Network/Console and request `Origin`. | Set `APP_URL` to the exact scheme + host users open; use HTTPS in production. |
| Login/token errors. | `JWT_SECRET` changed after tokens were issued, is missing, or differs between instances. | Try a new login; inspect startup error. | One stable, long production `JWT_SECRET`; one app instance. |
| Payment initialization fails. | Wrong provider selected, wrong test/live key, or missing secret. | Read the API error and provider dashboard logs. | `PAYMENT_PROVIDER` and matching `PAYMENT_SECRET_KEY`; do not mix test/live. |
| Payment completed but no tickets arrived. | Webhook was not delivered, signature failed, provider query value is wrong, or email is not configured. | Check payment provider webhook delivery logs first, then the order/ticket UI. | Exact Section 8 URL, `PAYMENT_WEBHOOK_SECRET`, public HTTPS reachability, and Resend configuration. |
| Email does not arrive locally. | Email credentials are optional in development and delivery is skipped when absent. | Check whether `EMAIL_PROVIDER_KEY` and `FROM_EMAIL` are set. | Use a Resend test key plus verified sender for delivery tests. |
| Refund request fails for Flutterwave or Bachs. | The current app deliberately rejects these refunds. | Read the API response. | Do not treat this as a dashboard misconfiguration; current functionality is intentionally unavailable. |
| `npm run build` or server startup fails with SQLite module errors. | Node is too old. | Run `node --version`. | Install/use Node 22 or newer. |

## 13. Production Checklist

### Environment and secrets

- [ ] `NODE_ENV=production`.
- [ ] `APP_URL` is the exact public `https://` origin.
- [ ] `JWT_SECRET` is unique, private, stable, and 32+ characters.
- [ ] Payment provider name and matching **live** credentials are set.
- [ ] `PAYMENT_WEBHOOK_SECRET` is set from the selected provider.
- [ ] Resend API key and verified `FROM_EMAIL` are set.
- [ ] No `.env` file or live secret is committed to Git.

### Database and hosting

- [ ] Hosting runs Node 22+.
- [ ] A persistent writable volume is mounted.
- [ ] `DATABASE_URL` uses the mounted volume with a `file:` URL.
- [ ] Database backup/snapshot policy is configured and restoration has been tested.
- [ ] Only one application instance is running against this SQLite database.
- [ ] Build command is `npm run build`; start command is `npm start` with `NODE_ENV=production`.

### Domains, authentication, and security

- [ ] HTTPS is active and `APP_URL` matches the public domain.
- [ ] The health check uses `/api/health`.
- [ ] Account registration/login and password reset link have been tested on the live domain.
- [ ] CORS has been tested from the live frontend origin.
- [ ] Platform logs are retained and monitored for startup, webhook, and payment errors.

### Payments, emails, and webhooks

- [ ] Test-mode end-to-end payment works before switching to live keys.
- [ ] Correct production webhook URL from Section 8 is set at the selected provider.
- [ ] Provider reports successful webhook delivery.
- [ ] Ticket issuance occurs only once for a payment and the QR ticket scans once.
- [ ] Resend sender/domain is verified and live emails arrive.
- [ ] Refund policy matches provider support: Paystack only in the current app; Flutterwave/Bachs refunds are unavailable.

### Final checks

- [ ] `npm run lint`, `npm test`, and `npm run build` pass from the release commit.
- [ ] A live health-check request returns success.
- [ ] You have tested one customer purchase and one organizer scan using the production workflow.

## 14. DO THIS FIRST

1. Install Node.js 22 or newer and run `node --version`.
2. Run `npm install` in the project root.
3. Run `cp .env.example .env` and set a strong `JWT_SECRET`.
4. Keep `NODE_ENV=development`, `APP_URL=http://localhost:3000`, and `DATABASE_URL=file:./data/ticketwave.db` for your first local run.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Create a real local organizer account and event; no demo account is automatically available.
7. Create a Resend account and verify a sender before testing email delivery.
8. Create one payment-provider account and configure **test** keys first.
9. Run `npm run lint`, `npm test`, and `npm run build` before attempting deployment.
10. Before going live, provision HTTPS plus a persistent volume and complete the production checklist.

## 15. DO NOT TOUCH

These behaviors are already configured and should not be changed merely to set up the app:

- Do not replace the SQLite `file:` URL with a PostgreSQL URL; the current runtime accepts SQLite only.
- Do not manually add demo accounts, events, orders, tickets, payments, or seed data to make the app appear populated. Use normal registration and event creation.
- Do not expose `/api/dev` or restore the developer-tools UI in production; it is intentionally development-only.
- Do not remove production startup validation, raw webhook-body capture, CORS origin restriction, security headers, or JWT-secret validation.
- Do not use live payment credentials locally or test credentials in production.
- Do not enable Bachs or Flutterwave refunds through configuration; they are intentionally unavailable in the current code.
- Do not run multiple replicas against the SQLite file or store it on an ephemeral filesystem.
