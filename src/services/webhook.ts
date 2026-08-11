import { db } from '../db/database';
import { WebhookEvent } from '../types';
import { EmailService } from './email';
import { getPaymentProvider } from './payment/factory';
import { TicketService } from './ticket';

export class WebhookService {
  /**
   * Process an incoming payment webhook idempotently
   */
  public static async processPaymentWebhook(
    providerName: string,
    rawPayload: string,
    signature: string,
  ): Promise<{ statusCode: number; response: any }> {
    const provider = getPaymentProvider(providerName);

    // 1. Signature Verification
    const isValidSignature = provider.verifyWebhookSignature(rawPayload, signature);
    if (!isValidSignature) {
      db.addAuditLog({
        actor_id: 'SYSTEM',
        actor_role: 'SYSTEM',
        action: 'WEBHOOK_SIGNATURE_INVALID',
        entity_type: 'WEBHOOK',
        entity_id: providerName,
        details_json: JSON.stringify({ signature, providerName }),
      });
      return { statusCode: 401, response: { error: 'Invalid webhook signature' } };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return { statusCode: 400, response: { error: 'Invalid JSON payload' } };
    }

    // Extract provider event ID & type
    const providerEventId = payload.id || payload.event_id || payload.data?.reference || `evt_${Date.now()}`;
    const eventType = payload.event || payload.type || 'charge.success';

    // 2. Idempotency Check
    const existingWebhook = db.webhookEvents.get(providerEventId);
    if (existingWebhook && existingWebhook.processing_status === 'PROCESSED') {
      db.addAuditLog({
        actor_id: 'SYSTEM',
        actor_role: 'SYSTEM',
        action: 'WEBHOOK_DUPLICATE_IGNORED',
        entity_type: 'WEBHOOK',
        entity_id: providerEventId,
        details_json: JSON.stringify({ providerEventId, eventType }),
      });
      return {
        statusCode: 200,
        response: { status: 'ignored_duplicate', message: 'Webhook already processed successfully' },
      };
    }

    // Record webhook event
    const webhookRecord: WebhookEvent = {
      id: providerEventId,
      provider: providerName,
      event_id: providerEventId,
      event_type: eventType,
      payload_json: rawPayload,
      processing_status: 'RECEIVED',
      received_at: new Date().toISOString(),
    };
    db.webhookEvents.set(providerEventId, webhookRecord);

    // 3. Process Event Payload
    try {
      const isSuccessEvent =
        eventType === 'charge.success' ||
        eventType === 'payment.successful' ||
        eventType === 'collection.succeeded';

      const isFailedEvent =
        eventType === 'charge.failed' ||
        eventType === 'payment.failed' ||
        eventType === 'collection.failed';

      if (isSuccessEvent) {
        const reference = payload.data?.reference || payload.reference || payload.tx_ref || payload.data?.custom_reference;
        if (!reference) throw new Error('Missing payment reference in payload');

        const order = db.getOrderByReference(reference);
        if (!order) {
          throw new Error(`Order not found for reference ${reference}`);
        }

        if (order.status === 'PAID') {
          webhookRecord.processing_status = 'PROCESSED';
          webhookRecord.processed_at = new Date().toISOString();
          db.webhookEvents.set(providerEventId, webhookRecord);
          return { statusCode: 200, response: { status: 'already_paid', order_id: order.id } };
        }

        // Fulfill Order
        order.status = 'PAID';
        order.updated_at = new Date().toISOString();
        db.orders.set(order.id, order);

        // Update Payment status
        for (const p of db.payments.values()) {
          if (p.order_id === order.id || p.provider_reference === reference) {
            p.status = 'SUCCESSFUL';
            p.updated_at = new Date().toISOString();
            db.payments.set(p.id, p);
          }
        }

        // Generate Tickets
        const tickets = await TicketService.generateTicketsForOrder(order.id);

        // Send Email Notification
        await EmailService.sendTicketConfirmationEmail(order.customer_email, {
          orderId: order.id,
          customerName: order.customer_name,
          eventTitle: order.event_title || 'Event',
          ticketCount: tickets.length,
          totalAmountFormatted: `₦${(order.total_kobo / 100).toLocaleString()}`,
        });

        webhookRecord.processing_status = 'PROCESSED';
        webhookRecord.processed_at = new Date().toISOString();
        db.webhookEvents.set(providerEventId, webhookRecord);

        db.addAuditLog({
          actor_id: 'WEBHOOK',
          actor_role: 'SYSTEM',
          action: 'ORDER_PAID_VIA_WEBHOOK',
          entity_type: 'ORDER',
          entity_id: order.id,
          details_json: JSON.stringify({ reference, providerEventId, ticketsGenerated: tickets.length }),
        });

        return { statusCode: 200, response: { status: 'success', order_id: order.id, tickets_generated: tickets.length } };
      } else if (isFailedEvent) {
        const reference = payload.data?.reference || payload.reference || payload.data?.custom_reference;
        const order = db.getOrderByReference(reference);
        if (order) {
          order.status = 'CANCELLED';
          order.updated_at = new Date().toISOString();
          db.orders.set(order.id, order);

          // Release inventory
          const items = db.orderItems.get(order.id) || [];
          for (const item of items) {
            db.releaseTicketReservation(item.ticket_type_id, item.quantity);
          }

          await EmailService.sendPaymentFailedEmail(order.customer_email, {
            orderId: order.id,
            customerName: order.customer_name,
            reason: payload.data?.gateway_response || 'Payment declined by bank',
          });
        }

        webhookRecord.processing_status = 'PROCESSED';
        webhookRecord.processed_at = new Date().toISOString();
        db.webhookEvents.set(providerEventId, webhookRecord);

        return { statusCode: 200, response: { status: 'failed_handled' } };
      }

      webhookRecord.processing_status = 'PROCESSED';
      webhookRecord.processed_at = new Date().toISOString();
      db.webhookEvents.set(providerEventId, webhookRecord);
      return { statusCode: 200, response: { status: 'ignored_unhandled_type' } };
    } catch (err: any) {
      webhookRecord.processing_status = 'FAILED';
      webhookRecord.error_message = err.message || 'Processing error';
      db.webhookEvents.set(providerEventId, webhookRecord);

      db.addAuditLog({
        actor_id: 'WEBHOOK',
        actor_role: 'SYSTEM',
        action: 'WEBHOOK_PROCESSING_FAILED',
        entity_type: 'WEBHOOK',
        entity_id: providerEventId,
        details_json: JSON.stringify({ error: err.message }),
      });

      return { statusCode: 500, response: { error: 'Webhook processing failed', details: err.message } };
    }
  }
}
