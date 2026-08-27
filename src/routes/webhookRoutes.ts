import { Request, Response, Router } from 'express';
import { WebhookService } from '../services/webhook';

const router = Router();

// POST /api/webhooks/payments
router.post('/payments', async (req: Request, res: Response) => {
  // Capture raw body for signature verification
  const rawPayload = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
  const signature =
    (req.headers['x-bachs-signature'] as string) ||
    (req.headers['x-paystack-signature'] as string) ||
    (req.headers['verif-hash'] as string) ||
    (req.headers['x-webhook-signature'] as string) ||
    '';

  const providerName = (req.query.provider as string) || 'paystack';

  const result = await WebhookService.processPaymentWebhook(providerName, rawPayload, signature);

  res.status(result.statusCode).json(result.response);
});

export default router;
