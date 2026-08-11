import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  AuditLog,
  Event,
  Order,
  OrderItem,
  OrganizerAnalytics,
  OrganizerProfile,
  Payment,
  PlatformAnalytics,
  Refund,
  SentEmail,
  Ticket,
  TicketType,
  User,
  WebhookEvent,
} from '../types';

/**
 * TicketWave Production SQL & Transactional Storage Engine
 * Simulates normalized relational database with ACID isolation & inventory locking.
 */
class DatabaseEngine {
  public users: Map<string, User> = new Map();
  public userPasswords: Map<string, string> = new Map(); // user_id -> password_hash
  public organizers: Map<string, OrganizerProfile> = new Map();
  public events: Map<string, Event> = new Map();
  public ticketTypes: Map<string, TicketType> = new Map();
  public orders: Map<string, Order> = new Map();
  public orderItems: Map<string, OrderItem[]> = new Map(); // order_id -> OrderItem[]
  public tickets: Map<string, Ticket> = new Map();
  public payments: Map<string, Payment> = new Map();
  public refunds: Map<string, Refund> = new Map();
  public webhookEvents: Map<string, WebhookEvent> = new Map();
  public auditLogs: AuditLog[] = [];
  public sentEmails: SentEmail[] = [];
  public resetTokens: Map<string, { userId: string; token: string; expiresAt: number; used: boolean }> = new Map();

  // Locks for concurrency control
  private ticketLocks: Map<string, boolean> = new Map();

  constructor() {
    this.seedInitialData();
  }

  // --- Transaction Runner ---
  public runInTransaction<T>(work: () => T): T {
    // Synchronous execution guarantees isolation in Node single-thread event loop
    return work();
  }

  // --- Seed Data ---
  private seedInitialData() {
    // 1. Users
    const adminPasswordHash = bcrypt.hashSync('Admin123!', 10);
    const orgPasswordHash = bcrypt.hashSync('Organizer123!', 10);
    const customerPasswordHash = bcrypt.hashSync('Customer123!', 10);

    const adminUser: User = {
      id: 'usr_admin_001',
      email: 'admin@ticketwave.app',
      name: 'System Admin',
      phone: '+2348011112222',
      role: 'ADMIN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const orgUser: User = {
      id: 'usr_org_001',
      email: 'organizer@ticketwave.app',
      name: 'Adeoti Tech Summit Org',
      phone: '+2348033334444',
      role: 'ORGANIZER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const customerUser: User = {
      id: 'usr_cust_001',
      email: 'customer@example.com',
      name: 'Chidi Okonkwo',
      phone: '+2348055556666',
      role: 'CUSTOMER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(orgUser.id, orgUser);
    this.users.set(customerUser.id, customerUser);

    this.userPasswords.set(adminUser.id, adminPasswordHash);
    this.userPasswords.set(orgUser.id, orgPasswordHash);
    this.userPasswords.set(customerUser.id, customerPasswordHash);

    // 2. Organizer Profile
    const orgProfile: OrganizerProfile = {
      id: 'org_profile_001',
      user_id: orgUser.id,
      organization_name: 'TechWave Africa Summit',
      bio: 'Leading technology and developer conference host across West Africa.',
      website: 'https://techwave.africa',
      bank_name: 'Guaranty Trust Bank',
      account_number: '0123456789',
      account_name: 'TechWave Africa Ltd',
      is_verified: true,
      created_at: new Date().toISOString(),
    };
    this.organizers.set(orgProfile.id, orgProfile);

    // 3. Events
    const now = new Date();
    const futureDate1 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const futureDate2 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const event1: Event = {
      id: 'evt_tech_summit_2026',
      organizer_id: orgProfile.id,
      organizer_name: orgProfile.organization_name,
      title: 'Lagos Tech & AI Summit 2026',
      slug: 'lagos-tech-ai-summit-2026',
      description: 'The premier gathering of AI innovators, software engineers, founders, and investors in West Africa. 2 days of keynotes, workshops, networking, and exhibitions.',
      cover_image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      location: 'Eko Convention Centre, Victoria Island',
      venue: 'Grand Ballroom & Expo Hall',
      city: 'Lagos',
      country: 'Nigeria',
      category: 'Technology & AI',
      start_date: futureDate1.toISOString(),
      end_date: futureDate2.toISOString(),
      status: 'PUBLISHED',
      is_published: true,
      ticket_sales_start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_sales_end: futureDate1.toISOString(),
      max_capacity: 1000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const event2: Event = {
      id: 'evt_afrobeats_fest',
      organizer_id: orgProfile.id,
      organizer_name: orgProfile.organization_name,
      title: 'Afrobeats Night Live Concert',
      slug: 'afrobeats-night-live-concert',
      description: 'An unforgettable evening of live music, performances by top artists, gourmet food stands, and high energy beats.',
      cover_image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      location: 'Tafawa Balewa Square (TBS)',
      venue: 'Main Outdoor Arena',
      city: 'Lagos',
      country: 'Nigeria',
      category: 'Music & Concerts',
      start_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000 + 8 * 3600 * 1000).toISOString(),
      status: 'PUBLISHED',
      is_published: true,
      ticket_sales_start: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      ticket_sales_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      max_capacity: 3000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.events.set(event1.id, event1);
    this.events.set(event2.id, event2);

    // 4. Ticket Types
    const tt1_regular: TicketType = {
      id: 'tt_regular_001',
      event_id: event1.id,
      name: 'Regular Pass',
      description: 'Full access to main stage keynotes, exhibition hall, and swag bag.',
      price_kobo: 500000, // ₦5,000
      currency: 'NGN',
      quantity_available: 500,
      quantity_reserved: 2,
      quantity_sold: 48,
      sales_start: event1.ticket_sales_start,
      sales_end: event1.ticket_sales_end,
      max_per_customer: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tt1_vip: TicketType = {
      id: 'tt_vip_001',
      event_id: event1.id,
      name: 'VIP Experience',
      description: 'VIP seating front-row, exclusive lounge networking, free lunch buffet, and speaker meet & greet.',
      price_kobo: 1500000, // ₦15,000
      currency: 'NGN',
      quantity_available: 100,
      quantity_reserved: 0,
      quantity_sold: 22,
      sales_start: event1.ticket_sales_start,
      sales_end: event1.ticket_sales_end,
      max_per_customer: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tt1_vvip: TicketType = {
      id: 'tt_vvip_001',
      event_id: event1.id,
      name: 'VVIP Executive Pass',
      description: 'Backstage pass, private 1-on-1 investor matchmaking, VIP table service, and luxury transport voucher.',
      price_kobo: 3000000, // ₦30,000
      currency: 'NGN',
      quantity_available: 20,
      quantity_reserved: 0,
      quantity_sold: 8,
      sales_start: event1.ticket_sales_start,
      sales_end: event1.ticket_sales_end,
      max_per_customer: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const tt2_regular: TicketType = {
      id: 'tt_concert_reg',
      event_id: event2.id,
      name: 'General Admission',
      description: 'Access to main concert bowl and food courts.',
      price_kobo: 1000000, // ₦10,000
      currency: 'NGN',
      quantity_available: 2500,
      quantity_reserved: 0,
      quantity_sold: 150,
      sales_start: event2.ticket_sales_start,
      sales_end: event2.ticket_sales_end,
      max_per_customer: 10,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.ticketTypes.set(tt1_regular.id, tt1_regular);
    this.ticketTypes.set(tt1_vip.id, tt1_vip);
    this.ticketTypes.set(tt1_vvip.id, tt1_vvip);
    this.ticketTypes.set(tt2_regular.id, tt2_regular);

    // 5. Seed Order & Paid Tickets for Customer demo
    const sampleOrderId = 'ord_demo_1001';
    const sampleRef = 'TW-PAY-882910394';
    const sampleOrder: Order = {
      id: sampleOrderId,
      customer_id: customerUser.id,
      customer_name: customerUser.name,
      customer_email: customerUser.email,
      customer_phone: customerUser.phone,
      event_id: event1.id,
      event_title: event1.title,
      currency: 'NGN',
      subtotal_kobo: 2000000, // ₦20,000 (1 VIP + 1 Regular)
      platform_fee_kobo: 100000, // ₦1,000 (5%)
      processing_fee_kobo: 30000, // ₦300
      total_kobo: 2130000, // ₦21,300
      status: 'PAID',
      payment_reference: sampleRef,
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    };
    this.orders.set(sampleOrder.id, sampleOrder);

    const sampleOrderItems: OrderItem[] = [
      {
        id: 'item_001',
        order_id: sampleOrder.id,
        ticket_type_id: tt1_regular.id,
        ticket_type_name: tt1_regular.name,
        quantity: 1,
        unit_price_kobo: 500000,
        subtotal_kobo: 500000,
      },
      {
        id: 'item_002',
        order_id: sampleOrder.id,
        ticket_type_id: tt1_vip.id,
        ticket_type_name: tt1_vip.name,
        quantity: 1,
        unit_price_kobo: 1500000,
        subtotal_kobo: 1500000,
      },
    ];
    this.orderItems.set(sampleOrder.id, sampleOrderItems);

    const ticket1: Ticket = {
      id: 'tkt_001',
      ticket_number: 'TKT-2026-REG-99128',
      order_id: sampleOrder.id,
      event_id: event1.id,
      event_title: event1.title,
      event_date: event1.start_date,
      event_venue: event1.venue,
      ticket_type_id: tt1_regular.id,
      ticket_type_name: tt1_regular.name,
      customer_id: customerUser.id,
      customer_name: customerUser.name,
      customer_email: customerUser.email,
      qr_code_hash: crypto.createHash('sha256').update('TKT-2026-REG-99128_SECRET').digest('hex'),
      status: 'VALID',
      created_at: sampleOrder.created_at,
    };

    const ticket2: Ticket = {
      id: 'tkt_002',
      ticket_number: 'TKT-2026-VIP-99129',
      order_id: sampleOrder.id,
      event_id: event1.id,
      event_title: event1.title,
      event_date: event1.start_date,
      event_venue: event1.venue,
      ticket_type_id: tt1_vip.id,
      ticket_type_name: tt1_vip.name,
      customer_id: customerUser.id,
      customer_name: customerUser.name,
      customer_email: customerUser.email,
      qr_code_hash: crypto.createHash('sha256').update('TKT-2026-VIP-99129_SECRET').digest('hex'),
      status: 'VALID',
      created_at: sampleOrder.created_at,
    };

    this.tickets.set(ticket1.id, ticket1);
    this.tickets.set(ticket2.id, ticket2);

    const payment: Payment = {
      id: 'pay_001',
      order_id: sampleOrder.id,
      amount_kobo: sampleOrder.total_kobo,
      currency: 'NGN',
      provider: 'paystack',
      provider_reference: sampleRef,
      status: 'SUCCESSFUL',
      created_at: sampleOrder.created_at,
      updated_at: sampleOrder.created_at,
    };
    this.payments.set(payment.id, payment);

    this.addAuditLog({
      actor_id: 'SYSTEM',
      actor_role: 'SYSTEM',
      action: 'DATABASE_SEEDED',
      entity_type: 'SYSTEM',
      entity_id: 'SEED',
      details_json: JSON.stringify({ message: 'Database initialized with seed data' }),
    });
  }

  // --- Audit Log ---
  public addAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...log,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  // --- User Queries ---
  public getUserByEmail(email: string): User | undefined {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  public createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>, passwordHash: string): User {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      ...user,
      id,
      created_at: now,
      updated_at: now,
    };
    this.users.set(id, newUser);
    this.userPasswords.set(id, passwordHash);

    // Auto-create organizer profile if role is ORGANIZER
    if (user.role === 'ORGANIZER') {
      const orgProfile: OrganizerProfile = {
        id: `org_${id}`,
        user_id: id,
        organization_name: `${user.name} Events`,
        is_verified: false,
        created_at: now,
      };
      this.organizers.set(orgProfile.id, orgProfile);
    }

    return newUser;
  }

  public createPasswordResetToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    this.resetTokens.set(token, { userId, token, expiresAt, used: false });
    return token;
  }

  public verifyPasswordResetToken(token: string): string | null {
    const record = this.resetTokens.get(token);
    if (!record) return null;
    if (record.used || Date.now() > record.expiresAt) return null;
    return record.userId;
  }

  public resetUserPassword(token: string, newPasswordHash: string): boolean {
    const userId = this.verifyPasswordResetToken(token);
    if (!userId) return false;

    this.userPasswords.set(userId, newPasswordHash);
    const record = this.resetTokens.get(token);
    if (record) {
      record.used = true;
    }
    return true;
  }

  // --- Event Queries ---
  public getEventBySlug(slug: string): Event | undefined {
    for (const e of this.events.values()) {
      if (e.slug === slug) return e;
    }
    return undefined;
  }

  public getEventById(id: string): Event | undefined {
    return this.events.get(id);
  }

  public getAllEvents(filter?: { publishedOnly?: boolean; category?: string; search?: string }): Event[] {
    let result = Array.from(this.events.values());
    if (filter?.publishedOnly) {
      result = result.filter((e) => e.is_published && e.status === 'PUBLISHED');
    }
    if (filter?.category && filter.category !== 'All') {
      result = result.filter((e) => e.category.toLowerCase() === filter.category!.toLowerCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- Ticket Type Reserve & Lock Engine ---
  public reserveTicketInventory(ticketTypeId: string, quantity: number): boolean {
    const lockKey = `tt_lock_${ticketTypeId}`;
    if (this.ticketLocks.get(lockKey)) {
      throw new Error(`Inventory lock contention for ticket type ${ticketTypeId}. Please retry.`);
    }

    this.ticketLocks.set(lockKey, true);
    try {
      const tt = this.ticketTypes.get(ticketTypeId);
      if (!tt) throw new Error(`Ticket type ${ticketTypeId} not found`);

      const availableToReserve = tt.quantity_available - tt.quantity_reserved - tt.quantity_sold;
      if (availableToReserve < quantity) {
        return false; // Insufficient stock
      }

      tt.quantity_reserved += quantity;
      tt.updated_at = new Date().toISOString();
      this.ticketTypes.set(tt.id, tt);
      return true;
    } finally {
      this.ticketLocks.delete(lockKey);
    }
  }

  public releaseTicketReservation(ticketTypeId: string, quantity: number) {
    const tt = this.ticketTypes.get(ticketTypeId);
    if (tt) {
      tt.quantity_reserved = Math.max(0, tt.quantity_reserved - quantity);
      tt.updated_at = new Date().toISOString();
      this.ticketTypes.set(tt.id, tt);
    }
  }

  public finalizeTicketSale(ticketTypeId: string, quantity: number) {
    const tt = this.ticketTypes.get(ticketTypeId);
    if (tt) {
      tt.quantity_reserved = Math.max(0, tt.quantity_reserved - quantity);
      tt.quantity_sold += quantity;
      tt.updated_at = new Date().toISOString();
      this.ticketTypes.set(tt.id, tt);
    }
  }

  // --- Order Queries ---
  public getOrderById(id: string): Order | undefined {
    const ord = this.orders.get(id);
    if (!ord) return undefined;
    const items = this.orderItems.get(id) || [];
    const tktList = Array.from(this.tickets.values()).filter((t) => t.order_id === id);
    return { ...ord, items, tickets: tktList };
  }

  public getOrderByReference(reference: string): Order | undefined {
    for (const ord of this.orders.values()) {
      if (ord.payment_reference === reference) {
        return this.getOrderById(ord.id);
      }
    }
    return undefined;
  }

  // --- Expire Pending Orders Runner ---
  public expirePendingOrders(): number {
    const now = new Date();
    let expiredCount = 0;

    for (const ord of this.orders.values()) {
      if (ord.status === 'PENDING' && new Date(ord.expires_at) < now) {
        ord.status = 'EXPIRED';
        ord.updated_at = now.toISOString();
        this.orders.set(ord.id, ord);

        // Release reserved inventory
        const items = this.orderItems.get(ord.id) || [];
        for (const item of items) {
          this.releaseTicketReservation(item.ticket_type_id, item.quantity);
        }

        this.addAuditLog({
          actor_id: 'CRON_JOB',
          actor_role: 'SYSTEM',
          action: 'ORDER_EXPIRED',
          entity_type: 'ORDER',
          entity_id: ord.id,
          details_json: JSON.stringify({ reference: ord.payment_reference, releasedItems: items.length }),
        });

        expiredCount++;
      }
    }
    return expiredCount;
  }

  // --- Analytics Queries ---
  public getOrganizerAnalytics(organizerId: string): OrganizerAnalytics {
    const orgEvents = Array.from(this.events.values()).filter((e) => e.organizer_id === organizerId);
    const orgEventIds = new Set(orgEvents.map((e) => e.id));

    let totalRevenue = 0;
    let ticketsSold = 0;
    let ticketsRemaining = 0;
    let totalOrders = 0;
    let scannedAttendees = 0;
    let totalRefunds = 0;

    const orgOrders: Order[] = [];
    const salesByDateMap = new Map<string, { revenue: number; tickets: number }>();

    for (const tt of this.ticketTypes.values()) {
      if (orgEventIds.has(tt.event_id)) {
        ticketsSold += tt.quantity_sold;
        ticketsRemaining += Math.max(0, tt.quantity_available - tt.quantity_sold - tt.quantity_reserved);
      }
    }

    for (const ord of this.orders.values()) {
      if (orgEventIds.has(ord.event_id)) {
        totalOrders++;
        orgOrders.push(ord);

        if (ord.status === 'PAID') {
          totalRevenue += ord.subtotal_kobo; // Organizer revenue before platform fees
          const dateStr = new Date(ord.created_at).toISOString().split('T')[0];
          const prev = salesByDateMap.get(dateStr) || { revenue: 0, tickets: 0 };
          const items = this.orderItems.get(ord.id) || [];
          const totalOrderTickets = items.reduce((sum, item) => sum + item.quantity, 0);
          salesByDateMap.set(dateStr, {
            revenue: prev.revenue + ord.subtotal_kobo,
            tickets: prev.tickets + totalOrderTickets,
          });
        } else if (ord.status === 'REFUNDED') {
          totalRefunds += ord.subtotal_kobo;
        }
      }
    }

    for (const tkt of this.tickets.values()) {
      if (orgEventIds.has(tkt.event_id) && tkt.status === 'USED') {
        scannedAttendees++;
      }
    }

    const conversionRate = totalOrders > 0 ? Number(((orgOrders.filter((o) => o.status === 'PAID').length / totalOrders) * 100).toFixed(1)) : 0;

    const ticketTypeSalesList = Array.from(this.ticketTypes.values())
      .filter((tt) => orgEventIds.has(tt.event_id))
      .map((tt) => ({
        name: tt.name,
        sold: tt.quantity_sold,
        available: tt.quantity_available,
        revenue_kobo: tt.quantity_sold * tt.price_kobo,
      }));

    const salesOverTime = Array.from(salesByDateMap.entries())
      .map(([date, data]) => ({ date, revenue_kobo: data.revenue, tickets: data.tickets }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_revenue_kobo: totalRevenue,
      tickets_sold: ticketsSold,
      tickets_remaining: ticketsRemaining,
      total_orders: totalOrders,
      total_attendees_scanned: scannedAttendees,
      total_refunds_kobo: totalRefunds,
      conversion_rate: conversionRate,
      recent_transactions: orgOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
      ticket_type_sales: ticketTypeSalesList,
      sales_over_time: salesOverTime,
    };
  }

  public getPlatformAnalytics(): PlatformAnalytics {
    let totalPlatformRevenue = 0;
    let totalGrossVolume = 0;
    let totalTicketsSold = 0;
    let totalRefunds = 0;

    for (const ord of this.orders.values()) {
      if (ord.status === 'PAID') {
        totalPlatformRevenue += ord.platform_fee_kobo;
        totalGrossVolume += ord.total_kobo;
      } else if (ord.status === 'REFUNDED') {
        totalRefunds += ord.total_kobo;
      }
    }

    for (const tt of this.ticketTypes.values()) {
      totalTicketsSold += tt.quantity_sold;
    }

    return {
      total_platform_revenue_kobo: totalPlatformRevenue,
      total_gross_volume_kobo: totalGrossVolume,
      total_organizers: this.organizers.size,
      total_events: this.events.size,
      total_tickets_sold: totalTicketsSold,
      total_refunds_processed: totalRefunds,
      webhooks_processed: Array.from(this.webhookEvents.values()).filter((w) => w.processing_status === 'PROCESSED').length,
    };
  }
}

export const db = new DatabaseEngine();
