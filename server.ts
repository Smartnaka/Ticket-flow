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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Strict rate limiter for Auth & Checkout (20 req / 15 mins)
  const authRateLimiter = createRateLimiter(15 * 60 * 1000, 30);
  const checkoutRateLimiter = createRateLimiter(15 * 60 * 1000, 20);

  // CORS middleware for iframe preview compatibility
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
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
  app.use('/api/payments', paymentRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/refunds', refundRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/dev', devRoutes);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TicketWave API Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
