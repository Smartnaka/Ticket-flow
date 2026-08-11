import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';
import { EmailService } from '../services/email';
import { getPaymentProvider } from '../services/payment/factory';
import { Refund } from '../types';

const router = Router();

// POST /api/refunds
router.post('/', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const user = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
  if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const { order_id, reason, amount_kobo } = req.body;
  if (!order_id || !reason) {
    return res.status(400).json({ error: 'order_id and reason are required' });
  }

  const order = db.getOrderById(order_id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status !== 'PAID') {
    return res.status(400).json({ error: `Cannot refund order in ${order.status} state` });
  }

  const refundAmountKobo = Number(amount_kobo) || order.total_kobo;

  // Find payment
  let paymentRecord = undefined;
  for (const p of db.payments.values()) {
    if (p.order_id === order.id) {
      paymentRecord = p;
      break;
    }
  }

  const provider = getPaymentProvider(paymentRecord?.provider);

  try {
    const refundRes = await provider.refundPayment({
      payment_reference: order.payment_reference,
      amount_kobo: refundAmountKobo,
      reason,
    });

    const refundEntry: Refund = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      order_id: order.id,
      payment_id: paymentRecord?.id || 'pay_unknown',
      amount_kobo: refundAmountKobo,
      currency: order.currency,
      reason,
      requested_by: user.id,
      provider_reference: refundRes.refund_reference,
      status: refundRes.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.refunds.set(refundEntry.id, refundEntry);

    // Update order status
    order.status = 'REFUNDED';
    order.updated_at = new Date().toISOString();
    db.orders.set(order.id, order);

    // Update tickets status
    for (const tkt of db.tickets.values()) {
      if (tkt.order_id === order.id) {
        tkt.status = 'REFUNDED';
        db.tickets.set(tkt.id, tkt);
      }
    }

    // Email notification
    await EmailService.sendRefundInitiatedEmail(order.customer_email, {
      orderId: order.id,
      refundAmountFormatted: `₦${(refundAmountKobo / 100).toLocaleString()}`,
      reason,
    });

    db.addAuditLog({
      actor_id: user.id,
      actor_role: user.role,
      action: 'REFUND_PROCESSED',
      entity_type: 'ORDER',
      entity_id: order.id,
      details_json: JSON.stringify({ refundAmountKobo, refundRef: refundRes.refund_reference }),
    });

    res.status(201).json(refundEntry);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Refund failed' });
  }
});

// GET /api/refunds/:id
router.get('/:id', (req: Request, res: Response) => {
  const ref = db.refunds.get(req.params.id);
  if (!ref) return res.status(404).json({ error: 'Refund record not found' });
  res.json(ref);
});

export default router;
