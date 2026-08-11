import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { EmailService } from '../services/email';
import { getPaymentProvider } from '../services/payment/factory';
import { TicketService } from '../services/ticket';
import { Payment } from '../types';

const router = Router();

// POST /api/payments/initialize
router.post('/initialize', async (req: Request, res: Response) => {
  const { order_id, provider_name, callback_url } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const order = db.getOrderById(order_id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'PAID') {
    return res.status(400).json({ error: 'Order is already paid' });
  }

  if (order.status === 'EXPIRED') {
    return res.status(400).json({ error: 'Order has expired. Please initiate checkout again.' });
  }

  const provider = getPaymentProvider(provider_name);

  try {
    const initResponse = await provider.initializePayment({
      order_id: order.id,
      amount_kobo: order.total_kobo,
      currency: order.currency,
      email: order.customer_email,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      reference: order.payment_reference,
      callback_url: callback_url || `${process.env.APP_URL || 'http://localhost:3000'}/payment-status?ref=${order.payment_reference}`,
    });

    const paymentRecord: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      order_id: order.id,
      amount_kobo: order.total_kobo,
      currency: order.currency,
      provider: provider.name,
      provider_reference: order.payment_reference,
      status: 'PENDING',
      authorization_url: initResponse.authorization_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.payments.set(paymentRecord.id, paymentRecord);

    db.addAuditLog({
      actor_id: order.customer_id,
      actor_role: 'CUSTOMER',
      action: 'PAYMENT_INITIALIZED',
      entity_type: 'PAYMENT',
      entity_id: paymentRecord.id,
      details_json: JSON.stringify({ provider: provider.name, reference: order.payment_reference }),
    });

    res.json({
      authorization_url: initResponse.authorization_url,
      reference: order.payment_reference,
      provider: provider.name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize payment provider' });
  }
});

// GET /api/payments/verify/:reference (Alternative verification helper)
router.get('/verify/:reference', async (req: Request, res: Response) => {
  const { reference } = req.params;
  const order = db.getOrderByReference(reference);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'PAID') {
    const tickets = Array.from(db.tickets.values()).filter((t) => t.order_id === order.id);
    return res.json({ status: 'PAID', order, tickets });
  }

  const provider = getPaymentProvider();
  const verifyRes = await provider.verifyPayment(reference);

  if (verifyRes.status === 'SUCCESSFUL') {
    order.status = 'PAID';
    order.updated_at = new Date().toISOString();
    db.orders.set(order.id, order);

    const tickets = await TicketService.generateTicketsForOrder(order.id);

    await EmailService.sendTicketConfirmationEmail(order.customer_email, {
      orderId: order.id,
      customerName: order.customer_name,
      eventTitle: order.event_title || 'Event',
      ticketCount: tickets.length,
      totalAmountFormatted: `₦${(order.total_kobo / 100).toLocaleString()}`,
    });

    return res.json({ status: 'PAID', order, tickets });
  }

  res.json({ status: order.status, order });
});

export default router;
