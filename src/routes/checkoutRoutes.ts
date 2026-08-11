import { Request, Response, Router } from 'express';
import { db } from '../db/database';
import { AuthService } from '../services/auth';
import { Order, OrderItem } from '../types';

const router = Router();

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENTAGE || '5');

// POST /api/checkout
router.post('/', (req: Request, res: Response) => {
  try {
    const { event_id, customer_name, customer_email, customer_phone, items, idempotency_key } = req.body;

    if (!event_id || !customer_name || !customer_email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'event_id, customer_name, customer_email, and at least one ticket item are required' });
    }

    const event = db.getEventById(event_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check optional idempotency key
    if (idempotency_key) {
      for (const existingOrder of db.orders.values()) {
        if (existingOrder.idempotency_key === idempotency_key) {
          const itemsList = db.orderItems.get(existingOrder.id) || [];
          return res.json({ order: { ...existingOrder, items: itemsList }, reused: true });
        }
      }
    }

    // Try finding user if authenticated
    let customerId = 'guest_customer';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const u = AuthService.getUserFromToken(authHeader.replace('Bearer ', ''));
      if (u) customerId = u.id;
    }

    // Process tickets in single transaction with stock lock checks
    const orderResult = db.runInTransaction(() => {
      let subtotalKobo = 0;
      const orderItemsToCreate: Omit<OrderItem, 'id' | 'order_id'>[] = [];

      for (const reqItem of items) {
        const ticketType = db.ticketTypes.get(reqItem.ticket_type_id);
        if (!ticketType || !ticketType.is_active) {
          throw new Error(`Ticket type ${reqItem.ticket_type_id} is inactive or not found`);
        }

        const quantityRequested = Number(reqItem.quantity) || 1;
        if (quantityRequested > ticketType.max_per_customer) {
          throw new Error(`Maximum allowed tickets for ${ticketType.name} is ${ticketType.max_per_customer} per order`);
        }

        // Server-side authoritative pricing (Kobo)
        const unitPriceKobo = ticketType.price_kobo;
        const itemSubtotalKobo = unitPriceKobo * quantityRequested;
        subtotalKobo += itemSubtotalKobo;

        // Atomically reserve ticket stock
        const reserved = db.reserveTicketInventory(ticketType.id, quantityRequested);
        if (!reserved) {
          throw new Error(`Sold out! Not enough tickets remaining for ${ticketType.name}`);
        }

        orderItemsToCreate.push({
          ticket_type_id: ticketType.id,
          ticket_type_name: ticketType.name,
          quantity: quantityRequested,
          unit_price_kobo: unitPriceKobo,
          subtotal_kobo: itemSubtotalKobo,
        });
      }

      // Financial Calculation in Integer Minor Units (Kobo)
      const platformFeeKobo = Math.round(subtotalKobo * (PLATFORM_FEE_PERCENT / 100));
      const processingFeeKobo = subtotalKobo > 0 ? 30000 : 0; // ₦300 processing fee for non-free orders
      const totalKobo = subtotalKobo + platformFeeKobo + processingFeeKobo;

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15-minute reservation
      const paymentRef = `TW-PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newOrder: Order = {
        id: orderId,
        customer_id: customerId,
        customer_name,
        customer_email,
        customer_phone: customer_phone || '',
        event_id: event.id,
        event_title: event.title,
        currency: 'NGN',
        subtotal_kobo: subtotalKobo,
        platform_fee_kobo: platformFeeKobo,
        processing_fee_kobo: processingFeeKobo,
        total_kobo: totalKobo,
        status: 'PENDING',
        payment_reference: paymentRef,
        idempotency_key,
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      db.orders.set(newOrder.id, newOrder);

      const itemsCreated: OrderItem[] = orderItemsToCreate.map((ic, idx) => ({
        id: `item_${orderId}_${idx}`,
        order_id: orderId,
        ...ic,
      }));

      db.orderItems.set(orderId, itemsCreated);

      db.addAuditLog({
        actor_id: customerId,
        actor_role: 'CUSTOMER',
        action: 'ORDER_CREATED',
        entity_type: 'ORDER',
        entity_id: orderId,
        details_json: JSON.stringify({ totalKobo, reference: paymentRef, expiresAt }),
      });

      return { order: { ...newOrder, items: itemsCreated } };
    });

    res.status(201).json(orderResult);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Checkout failed' });
  }
});

// GET /api/orders/:id
router.get('/orders/:id', (req: Request, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

export default router;
