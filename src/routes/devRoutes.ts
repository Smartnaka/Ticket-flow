import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { getCurrentProviderName, getPaymentProvider, setPaymentProviderDefault } from '../services/payment/factory';
import { PaystackSandboxProvider } from '../services/payment/paystack';
import { WebhookService } from '../services/webhook';

const router = Router();

// POST /api/dev/simulate-webhook (Simulates payment provider webhook postback)
router.post('/simulate-webhook', async (req: Request, res: Response) => {
  const { payment_reference, provider_name, event_type, is_duplicate } = req.body;

  const order = db.getOrderByReference(payment_reference);
  if (!order) {
    return res.status(404).json({ error: `Order with reference ${payment_reference} not found` });
  }

  const provider = provider_name || getCurrentProviderName();
  const defaultEventType = provider === 'bachs' ? 'collection.succeeded' : 'charge.success';
  const type = event_type || defaultEventType;

  // Construct payload
  const rawPayload = JSON.stringify({
    event: type,
    id: is_duplicate ? `evt_sim_${payment_reference}` : `evt_sim_${payment_reference}_${Date.now()}`,
    data: {
      reference: payment_reference,
      custom_reference: payment_reference,
      amount: order.total_kobo,
      currency: order.currency,
      status: 'success',
      paid_at: new Date().toISOString(),
      channel: 'card',
      customer: { email: order.customer_email },
    },
  });

  const providerInstance = getPaymentProvider(provider);
  const signature = providerInstance.generateWebhookSignature
    ? providerInstance.generateWebhookSignature(rawPayload)
    : 'sim_signature';

  const webhookRes = await WebhookService.processPaymentWebhook(provider, rawPayload, signature);

  res.json({ simulationResult: webhookRes });
});

// POST /api/dev/trigger-order-expiration (Forces expiration check runner)
router.post('/trigger-order-expiration', (req: Request, res: Response) => {
  const count = db.expirePendingOrders();
  res.json({ expired_orders_count: count, timestamp: new Date().toISOString() });
});

// GET /api/dev/config
router.get('/config', (req: Request, res: Response) => {
  res.json({
    active_payment_provider: getCurrentProviderName(),
    total_users: db.users.size,
    total_events: db.events.size,
    total_orders: db.orders.size,
    total_tickets: db.tickets.size,
  });
});

// POST /api/dev/set-provider
router.post('/set-provider', (req: Request, res: Response) => {
  const { provider } = req.body;
  if (provider === 'paystack' || provider === 'flutterwave' || provider === 'bachs') {
    setPaymentProviderDefault(provider);
    return res.json({ success: true, active_payment_provider: provider });
  }
  res.status(400).json({ error: 'Invalid provider. Must be paystack, flutterwave, or bachs' });
});

export default router;
