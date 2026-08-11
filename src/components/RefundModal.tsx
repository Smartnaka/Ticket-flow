import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { Order } from '../types';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  token: string;
  onSuccess: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  isOpen,
  onClose,
  order,
  token,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !order) return null;

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: order.id,
          reason,
          amount_kobo: order.total_kobo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund execution failed');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Process Payment Refund</span>
          </div>
          <h2 className="text-xl font-bold text-white">Refund Order #{order.id}</h2>
          <p className="text-xs text-slate-400">
            Customer: {order.customer_name} ({order.customer_email})
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Payment Reference</span>
            <span className="font-mono text-white">{order.payment_reference}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Refund Amount</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">
              ₦{(order.total_kobo / 100).toLocaleString()}
            </span>
          </div>
        </div>

        <form onSubmit={handleRefundSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Reason for Refund
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Event date changed / Customer request"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-2xl shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span>Executing Provider Refund API...</span>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Confirm & Process ₦{(order.total_kobo / 100).toLocaleString()} Refund</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
