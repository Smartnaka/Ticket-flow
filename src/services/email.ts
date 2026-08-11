import { db } from '../db/database';
import { SentEmail } from '../types';

export class EmailService {
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
    console.log(`[EmailService] Sent '${template}' to ${to} | Subject: ${subject}`);
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
    console.log(`[EmailService] Sent '${template}' to ${to}`);
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
    console.log(`[EmailService] Sent '${template}' to ${to}`);
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
    console.log(`[EmailService] Sent '${template}' to ${to} | Reset Link: ${data.resetUrl}`);
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
    console.log(`[EmailService] Sent '${template}' to ${to}`);
    return sentEmail;
  }
}
