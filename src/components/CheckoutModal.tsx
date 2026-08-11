import { AlertCircle, CreditCard, Lock, ShieldCheck, X } from 'lucide-react';
import React, { useState } from 'react';
import { Event, TicketType } from '../types';

interface SelectedTicket {
  ticketType: TicketType;
  quantity: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  selectedTickets: SelectedTicket[];
  user: any;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  event,
  selectedTickets,
  user,
}) => {
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [provider, setProvider] = useState<'paystack' | 'flutterwave' | 'bachs'>('bachs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Server-authoritative calculation preview in frontend
  const subtotalKobo = selectedTickets.reduce(
    (sum, item) => sum + item.ticketType.price_kobo * item.quantity,
    0,
  );
  const platformFeeKobo = Math.round(subtotalKobo * 0.05);
  const processingFeeKobo = subtotalKobo > 0 ? 30000 : 0;
  const totalKobo = subtotalKobo + platformFeeKobo + processingFeeKobo;

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Send checkout request to backend (Backend validates pricing and locks inventory)
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          items: selectedTickets.map((s) => ({
            ticket_type_id: s.ticketType.id,
            quantity: s.quantity,
          })),
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Checkout failed');

      const order = checkoutData.order;

      // 2. Initialize Payment with provider sandbox
      const payRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          provider_name: provider,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Payment initialization failed');

      // Redirect to sandbox payment page
      window.location.href = payData.authorization_url;
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during checkout');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>256-Bit Encrypted Checkout</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Complete Your Ticket Order</h2>
          <p className="text-xs text-slate-400">{event.title} • {event.venue}, {event.city}</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Selected Items Breakdown */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Order Summary
          </h3>
          <div className="space-y-2 divide-y divide-slate-800/60">
            {selectedTickets.map(({ ticketType, quantity }) => (
              <div key={ticketType.id} className="pt-2 first:pt-0 flex justify-between text-sm">
                <div>
                  <span className="font-semibold text-white">{ticketType.name}</span>
                  <span className="text-xs text-slate-400 ml-2">× {quantity}</span>
                </div>
                <span className="font-mono text-slate-200">
                  ₦{((ticketType.price_kobo * quantity) / 100).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono text-slate-200">₦{(subtotalKobo / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform Service Fee (5%)</span>
              <span className="font-mono text-slate-200">₦{(platformFeeKobo / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Processing Fee</span>
              <span className="font-mono text-slate-200">₦{(processingFeeKobo / 100).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-emerald-400 pt-2 border-t border-slate-800">
              <span>Total Amount</span>
              <span className="font-mono">₦{(totalKobo / 100).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Customer Information Form */}
        <form onSubmit={handleProceedToPayment} className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ticket Holder Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Chidi Okonkwo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+234 801 234 5678"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Select Payment Gateway
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProvider('bachs')}
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  provider === 'bachs'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold">Bachs.io</span>
                </div>
                {provider === 'bachs' && <ShieldCheck className="w-4 h-4 text-indigo-400" />}
              </button>

              <button
                type="button"
                onClick={() => setProvider('paystack')}
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  provider === 'paystack'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">Paystack</span>
                </div>
                {provider === 'paystack' && <ShieldCheck className="w-4 h-4 text-indigo-400" />}
              </button>

              <button
                type="button"
                onClick={() => setProvider('flutterwave')}
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  provider === 'flutterwave'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold">Flutterwave</span>
                </div>
                {provider === 'flutterwave' && <ShieldCheck className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || selectedTickets.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-xl transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Reserving Inventory & Initializing Payment...</span>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Pay ₦{(totalKobo / 100).toLocaleString()} via {provider.toUpperCase()}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
