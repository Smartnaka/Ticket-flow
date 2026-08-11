import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../db/database';
import { Ticket } from '../types';

export class TicketService {
  /**
   * Generates tickets for a paid order and renders QR codes
   */
  public static async generateTicketsForOrder(orderId: string): Promise<Ticket[]> {
    return db.runInTransaction(async () => {
      const order = db.getOrderById(orderId);
      if (!order) throw new Error(`Order ${orderId} not found`);

      const existingTickets = Array.from(db.tickets.values()).filter((t) => t.order_id === orderId);
      if (existingTickets.length > 0) {
        return existingTickets; // Idempotent ticket generation
      }

      const items = db.orderItems.get(orderId) || [];
      const event = db.getEventById(order.event_id);
      if (!event) throw new Error(`Event ${order.event_id} not found`);

      const generatedTickets: Ticket[] = [];

      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const tktNum = `TKT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
          const qrPayload = JSON.stringify({
            tkt: tktNum,
            evt: event.id,
            ord: orderId,
            secret: crypto.randomBytes(16).toString('hex'),
          });
          const qrHash = crypto.createHash('sha256').update(qrPayload).digest('hex');

          // Generate Data URL for QR Code
          const qrDataUrl = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });

          const newTicket: Ticket = {
            id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            ticket_number: tktNum,
            order_id: orderId,
            event_id: event.id,
            event_title: event.title,
            event_date: event.start_date,
            event_venue: event.venue,
            ticket_type_id: item.ticket_type_id,
            ticket_type_name: item.ticket_type_name,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            qr_code_hash: qrHash,
            qr_code_data_url: qrDataUrl,
            status: 'VALID',
            created_at: new Date().toISOString(),
          };

          db.tickets.set(newTicket.id, newTicket);
          generatedTickets.push(newTicket);

          // Finalize inventory sale
          db.finalizeTicketSale(item.ticket_type_id, 1);
        }
      }

      db.addAuditLog({
        actor_id: order.customer_id,
        actor_role: 'CUSTOMER',
        action: 'TICKETS_GENERATED',
        entity_type: 'ORDER',
        entity_id: orderId,
        details_json: JSON.stringify({ orderId, count: generatedTickets.length }),
      });

      return generatedTickets;
    });
  }

  /**
   * Validates a ticket scanned by an organizer
   */
  public static async validateAndScanTicket(
    scannedData: string,
    organizerId: string,
    scannedByUserId: string,
  ): Promise<{ success: boolean; message: string; ticket?: Ticket }> {
    return db.runInTransaction(() => {
      let ticketNum = scannedData.trim();

      // Try parsing JSON QR payload if applicable
      try {
        const parsed = JSON.parse(scannedData);
        if (parsed?.tkt) ticketNum = parsed.tkt;
      } catch {
        // Raw ticket string input
      }

      let ticket: Ticket | undefined = undefined;
      for (const t of db.tickets.values()) {
        if (t.ticket_number === ticketNum || t.qr_code_hash === scannedData || t.id === scannedData) {
          ticket = t;
          break;
        }
      }

      if (!ticket) {
        return { success: false, message: '✕ Ticket Not Found. Invalid or fake QR code.' };
      }

      const event = db.getEventById(ticket.event_id);
      if (!event) {
        return { success: false, message: '✕ Event associated with ticket no longer exists.' };
      }

      if (event.organizer_id !== organizerId) {
        return { success: false, message: '✕ Ticket belongs to a different organizer event.' };
      }

      if (ticket.status === 'USED') {
        return {
          success: false,
          message: `✕ Ticket Already Used! Scanned at ${new Date(ticket.scanned_at || '').toLocaleTimeString()} by ${ticket.scanned_by || 'staff'}.`,
          ticket,
        };
      }

      if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') {
        return { success: false, message: `✕ Ticket is ${ticket.status}. Entry denied.` };
      }

      // Mark as USED
      ticket.status = 'USED';
      ticket.scanned_at = new Date().toISOString();
      ticket.scanned_by = scannedByUserId;
      db.tickets.set(ticket.id, ticket);

      db.addAuditLog({
        actor_id: scannedByUserId,
        actor_role: 'ORGANIZER',
        action: 'TICKET_SCANNED',
        entity_type: 'TICKET',
        entity_id: ticket.id,
        details_json: JSON.stringify({ ticketNumber: ticket.ticket_number, eventId: event.id }),
      });

      return {
        success: true,
        message: `✓ Ticket Valid! Welcome ${ticket.customer_name} (${ticket.ticket_type_name})`,
        ticket,
      };
    });
  }
}
