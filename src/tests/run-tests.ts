import crypto from 'crypto';
import { db } from '../db/database';
import { EmailService } from '../services/email';
import { PaystackSandboxProvider } from '../services/payment/paystack';
import { TicketService } from '../services/ticket';
import { WebhookService } from '../services/webhook';

async function runAllTests() {
  console.log('----------------------------------------------------');
  console.log('   TICKETWAVE PRODUCTION TEST SUITE RUNNER         ');
  console.log('----------------------------------------------------');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAILED: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Price calculation in minor units (Kobo)
  console.log('\n1. UNIT TEST: Price & Fee Calculations (Kobo)');
  const subtotalKobo = 2000000; // ₦20,000
  const platformFeePercent = 5;
  const platformFeeKobo = Math.round(subtotalKobo * (platformFeePercent / 100)); // ₦1,000 = 100000 kobo
  const processingFeeKobo = 30000; // ₦300
  const totalKobo = subtotalKobo + platformFeeKobo + processingFeeKobo; // ₦21,300 = 2130000 kobo

  assert(platformFeeKobo === 100000, 'Platform fee 5% calculation accurate');
  assert(totalKobo === 2130000, 'Total kobo calculation accurate');

  // TEST 2: Ticket Inventory Lock & Concurrency Simulation
  console.log('\n2. CONCURRENCY TEST: Buying the Last Ticket & Simultaneous Lock Check');
  const testTtId = 'tt_test_stock_001';
  db.ticketTypes.set(testTtId, {
    id: testTtId,
    event_id: 'evt_test',
    name: 'Limited Stock Ticket',
    description: 'Only 1 ticket remaining',
    price_kobo: 500000,
    currency: 'NGN',
    quantity_available: 1,
    quantity_reserved: 0,
    quantity_sold: 0,
    sales_start: new Date().toISOString(),
    sales_end: new Date().toISOString(),
    max_per_customer: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const firstReservation = db.reserveTicketInventory(testTtId, 1);
  assert(firstReservation === true, 'First customer successfully reserved last ticket');

  const secondReservation = db.reserveTicketInventory(testTtId, 1);
  assert(secondReservation === false, 'Second simultaneous attempt to buy last ticket rejected (sold out)');

  db.releaseTicketReservation(testTtId, 1);

  // TEST 3: Idempotent Webhook Processing & Duplicate Rejection
  console.log('\n3. INTEGRATION TEST: Webhook Signature & Idempotency');
  const testRef = `TW-PAY-TEST-${Date.now()}`;
  db.orders.set('ord_test_001', {
    id: 'ord_test_001',
    customer_id: 'cust_001',
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    event_id: 'evt_tech_summit_2026',
    event_title: 'Test Tech Event',
    currency: 'NGN',
    subtotal_kobo: 500000,
    platform_fee_kobo: 25000,
    processing_fee_kobo: 30000,
    total_kobo: 555000,
    status: 'PENDING',
    payment_reference: testRef,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  db.orderItems.set('ord_test_001', [
    {
      id: 'item_test_1',
      order_id: 'ord_test_001',
      ticket_type_id: 'tt_regular_001',
      ticket_type_name: 'Regular Pass',
      quantity: 1,
      unit_price_kobo: 500000,
      subtotal_kobo: 500000,
    },
  ]);

  const rawPayload = JSON.stringify({
    event: 'charge.success',
    id: `evt_provider_${testRef}`,
    data: {
      reference: testRef,
      amount: 555000,
      currency: 'NGN',
    },
  });

  const paystackProvider = new PaystackSandboxProvider();
  const validSignature = paystackProvider.generateWebhookSignature(rawPayload);

  // Test 3a: Invalid signature
  const invalidSigRes = await WebhookService.processPaymentWebhook('paystack', rawPayload, 'invalid_sig');
  assert(invalidSigRes.statusCode === 401, 'Invalid signature rejected with HTTP 401');

  // Test 3b: First webhook delivery
  const firstWebhookRes = await WebhookService.processPaymentWebhook('paystack', rawPayload, validSignature);
  assert(firstWebhookRes.statusCode === 200 && firstWebhookRes.response.status === 'success', 'First webhook successfully processed and marked order as PAID');

  const orderAfterWebhook = db.getOrderById('ord_test_001');
  assert(orderAfterWebhook?.status === 'PAID', 'Order status updated to PAID');

  // Test 3c: Duplicate webhook delivery
  const duplicateWebhookRes = await WebhookService.processPaymentWebhook('paystack', rawPayload, validSignature);
  assert(duplicateWebhookRes.statusCode === 200 && duplicateWebhookRes.response.status === 'ignored_duplicate', 'Duplicate webhook delivery safely ignored without double-processing');

  // TEST 4: Ticket QR Code Scanning & Double-Scan Prevention
  console.log('\n4. INTEGRATION TEST: QR Code Validation & Anti-Double-Scan');
  const generatedTickets = await TicketService.generateTicketsForOrder('ord_test_001');
  assert(generatedTickets.length === 1, 'Ticket generated for order');

  const tkt = generatedTickets[0];
  const orgUserId = 'usr_org_001';
  const orgProfile = Array.from(db.organizers.values()).find((o) => o.user_id === orgUserId);

  // First scan
  const scan1 = await TicketService.validateAndScanTicket(tkt.ticket_number, orgProfile!.id, orgUserId);
  assert(scan1.success === true && scan1.message.includes('✓ Ticket Valid'), 'First QR scan validated successfully');

  // Second scan (Attempt double entry)
  const scan2 = await TicketService.validateAndScanTicket(tkt.ticket_number, orgProfile!.id, orgUserId);
  assert(scan2.success === false && scan2.message.includes('✕ Ticket Already Used'), 'Double-scan prevented with explicit error message');

  // TEST 5: Order Expiration Cron Simulation
  console.log('\n5. UNIT TEST: Order Expiration Runner');
  const expiredOrdId = 'ord_expired_test';
  db.orders.set(expiredOrdId, {
    id: expiredOrdId,
    customer_id: 'cust_002',
    customer_name: 'Expired Customer',
    customer_email: 'expired@example.com',
    event_id: 'evt_tech_summit_2026',
    currency: 'NGN',
    subtotal_kobo: 500000,
    platform_fee_kobo: 25000,
    processing_fee_kobo: 30000,
    total_kobo: 555000,
    status: 'PENDING',
    payment_reference: 'TW-EXPIRED-001',
    expires_at: new Date(Date.now() - 1000).toISOString(), // Past timestamp
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const expiredCount = db.expirePendingOrders();
  assert(expiredCount >= 1, 'Pending order past expiration time successfully transitioned to EXPIRED');
  assert(db.orders.get(expiredOrdId)?.status === 'EXPIRED', 'Order status verified as EXPIRED');

  console.log('----------------------------------------------------');
  console.log(`   TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner exception:', err);
  process.exit(1);
});
