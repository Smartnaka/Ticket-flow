import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/database';

import analyticsRoutes from './src/routes/analyticsRoutes';
import authRoutes from './src/routes/authRoutes';
import checkoutRoutes from './src/routes/checkoutRoutes';
import devRoutes from './src/routes/devRoutes';
import eventRoutes from './src/routes/eventRoutes';
import paymentRoutes from './src/routes/paymentRoutes';
import refundRoutes from './src/routes/refundRoutes';
import ticketRoutes from './src/routes/ticketRoutes';
import webhookRoutes from './src/routes/webhookRoutes';
import { createRateLimiter } from './src/middleware/rateLimiter';

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_SECRET', 'DATABASE_URL', 'APP_URL', 'PAYMENT_PROVIDER', 'PAYMENT_SECRET_KEY', 'PAYMENT_WEBHOOK_SECRET', 'EMAIL_PROVIDER_KEY', 'FROM_EMAIL'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production.');
  if (!(process.env.APP_URL || '').startsWith('https://')) throw new Error('APP_URL must use HTTPS in production.');
}

async function startServer() {
  validateProductionEnvironment();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb', verify: (req, _res, buffer) => { (req as Request & { rawBody?: string }).rawBody = buffer.toString('utf8'); } }));
  app.use(express.urlencoded({ extended: true }));

  // Strict rate limiters for sensitive auth, checkout, payment, and webhook endpoints
  const authRateLimiter = createRateLimiter(15 * 60 * 1000, 30);
  const checkoutRateLimiter = createRateLimiter(15 * 60 * 1000, 20);
  const paymentRateLimiter = createRateLimiter(15 * 60 * 1000, 40);
  const webhookRateLimiter = createRateLimiter(60 * 1000, 120);

  // Security headers without extra runtime dependencies
  app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  // Allow only the configured browser origin in production.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigin = process.env.APP_URL;
    if (origin && allowedOrigin && origin === allowedOrigin) res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'TicketWave API Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Route Mounting with Rate Limiting
  app.use('/api/auth', authRateLimiter, authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/checkout', checkoutRateLimiter, checkoutRoutes);
  app.use('/api/payments', paymentRateLimiter, paymentRoutes);
  app.use('/api/webhooks', webhookRateLimiter, webhookRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/refunds', refundRoutes);
  app.use('/api/analytics', analyticsRoutes);
  if (process.env.NODE_ENV !== 'production') app.use('/api/dev', devRoutes);

  // Background Order Expiration Cron (runs every 60 seconds)
  setInterval(() => {
    try {
      const expiredCount = db.expirePendingOrders();
      if (expiredCount > 0) {
        console.log(`[CronRunner] Released inventory for ${expiredCount} expired pending orders.`);
      }
    } catch (err) {
      console.error('[CronRunner] Order expiration error:', err);
    }
  }, 60000);

  // Vite Development or Static Production Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: unknown) => {
    console.error('Unhandled request error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TicketWave API Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
