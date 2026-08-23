import { db } from '../db/database';
import { SentEmail } from '../types';

export class EmailService {
  private static async deliver(to: string, subject: string, html: string) {
    const apiKey = process.env.EMAIL_PROVIDER_KEY;
    const from = process.env.FROM_EMAIL;
    if (!apiKey || !from) {
      if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_PROVIDER_KEY and FROM_EMAIL are required in production.');
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) throw new Error(`Email delivery failed with HTTP ${response.status}`);
  }

  public static async sendTicketConfirmationEmail(to: string, data: { orderId: string; customerName: string; eventTitle: string; ticketCount: number; totalAmountFormatted: string }) {
    const subject = `Your Tickets for ${data.eventTitle} - Order #${data.orderId}`;
    const template = 'TICKET_CONFIRMATION';

    const sentEmail: SentEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to,
      subject,
      template,
      data_json: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    };

    db.sentEmails.unshift(sentEmail);
    await this.deliver(to, subject, `<p>Hi ${data.customerName}, your ${data.ticketCount} ticket(s) for <strong>${data.eventTitle}</strong> are confirmed.</p>`);
    db.persistState();
    return sentEmail;
  }

  public static async sendPaymentFailedEmail(to: string, data: { orderId: string; customerName: string; reason: string }) {
    const subject = `Payment Failed - Order #${data.orderId}`;
    const template = 'PAYMENT_FAILED';

    const sentEmail: SentEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to,
      subject,
      template,
      data_json: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    };

    db.sentEmails.unshift(sentEmail);
    await this.deliver(to, subject, `<p>Hi ${data.customerName}, we could not complete payment for order ${data.orderId}. ${data.reason}</p>`);
    db.persistState();
    return sentEmail;
  }

  public static async sendRefundInitiatedEmail(to: string, data: { orderId: string; refundAmountFormatted: string; reason: string }) {
    const subject = `Refund Processed for Order #${data.orderId}`;
    const template = 'REFUND_PROCESSED';

    const sentEmail: SentEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to,
      subject,
      template,
      data_json: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    };

    db.sentEmails.unshift(sentEmail);
    await this.deliver(to, subject, `<p>Your refund for order ${data.orderId} (${data.refundAmountFormatted}) is being processed.</p>`);
    db.persistState();
    return sentEmail;
  }

  public static async sendPasswordResetEmail(to: string, data: { name: string; resetUrl: string; token: string }) {
    const subject = `Reset Your TicketWave Password`;
    const template = 'PASSWORD_RESET';

    const sentEmail: SentEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to,
      subject,
      template,
      data_json: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    };

    db.sentEmails.unshift(sentEmail);
    await this.deliver(to, subject, `<p>Hi ${data.name}, reset your password using this link: <a href="${data.resetUrl}">Reset password</a></p>`);
    db.persistState();
    return sentEmail;
  }

  public static async sendWelcomeEmail(to: string, data: { name: string; role: string }) {
    const subject = `Welcome to TicketWave, ${data.name}!`;
    const template = 'WELCOME';

    const sentEmail: SentEmail = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to,
      subject,
      template,
      data_json: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    };

    db.sentEmails.unshift(sentEmail);
    await this.deliver(to, subject, `<p>Welcome to TicketWave, ${data.name}.</p>`);
    db.persistState();
    return sentEmail;
  }
}
