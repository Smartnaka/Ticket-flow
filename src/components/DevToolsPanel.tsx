import { Mail, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export const DevToolsPanel: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [simRef, setSimRef] = useState('TW-PAY-882910394');
  const [simProvider, setSimProvider] = useState('paystack');
  const [simMessage, setSimMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'sim' | 'webhooks' | 'emails'>('sim');

  const fetchDevData = async () => {
    try {
      const [cfgRes, whRes, emlRes] = await Promise.all([
        fetch('/api/dev/config'),
        fetch('/api/analytics/webhook-logs'),
        fetch('/api/analytics/sent-emails'),
      ]);
      setConfig(await cfgRes.json());
      setWebhookLogs(await whRes.json());
      setSentEmails(await emlRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDevData();
  }, []);

  const handleSimulateWebhook = async (isDuplicate: boolean) => {
    setSimMessage('Sending simulated webhook...');
    try {
      const res = await fetch('/api/dev/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_reference: simRef,
          provider_name: simProvider,
          event_type: 'charge.success',
          is_duplicate: isDuplicate,
        }),
      });
      const data = await res.json();
      setSimMessage(JSON.stringify(data.simulationResult, null, 2));
      fetchDevData();
    } catch (err: any) {
      setSimMessage(`Error: ${err.message}`);
    }
  };

  const handleTriggerExpiration = async () => {
    setSimMessage('Running background order expiration runner...');
    try {
      const res = await fetch('/api/dev/trigger-order-expiration', { method: 'POST' });
      const data = await res.json();
      setSimMessage(`Cron Execution Completed: Expired ${data.expired_orders_count} pending order(s).`);
      fetchDevData();
    } catch (err: any) {
      setSimMessage(`Error: ${err.message}`);
    }
  };

  const handleProviderSwitch = async (p: 'paystack' | 'flutterwave' | 'bachs') => {
    try {
      await fetch('/api/dev/set-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      });
      fetchDevData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white border border-zinc-100 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-700 flex items-center justify-center border border-teal-600/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-950">Developer & Sandbox Testing Studio</h2>
              <p className="text-xs text-zinc-600">Verify webhooks, test idempotency duplicate protection, and inspect outbox emails</p>
            </div>
          </div>

          {/* Provider Toggle Pill */}
          {config && (
            <div className="flex items-center space-x-2 bg-zinc-50 p-1.5 rounded-lg border border-zinc-100 text-xs">
              <span className="text-zinc-600 pl-2">Default Gateway:</span>
              <button
                onClick={() => handleProviderSwitch('bachs')}
                className={`px-3 py-1 rounded-xl font-bold transition ${
                  config.active_payment_provider === 'bachs'
                    ? 'bg-cyan-600 text-zinc-950'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Bachs.io
              </button>
              <button
                onClick={() => handleProviderSwitch('paystack')}
                className={`px-3 py-1 rounded-xl font-bold transition ${
                  config.active_payment_provider === 'paystack'
                    ? 'bg-teal-700 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Paystack
              </button>
              <button
                onClick={() => handleProviderSwitch('flutterwave')}
                className={`px-3 py-1 rounded-xl font-bold transition ${
                  config.active_payment_provider === 'flutterwave'
                    ? 'bg-orange-700 text-white'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Flutterwave
              </button>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-2 border-b border-zinc-100 pb-3 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sim')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'sim' ? 'bg-teal-700 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Webhook Simulator & Cron
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'webhooks' ? 'bg-teal-700 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Webhook Events Log ({webhookLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'emails' ? 'bg-teal-700 text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Outbox Sent Emails ({sentEmails.length})
          </button>
        </div>

        {/* TAB 1: Simulator & Cron */}
        {activeTab === 'sim' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4 bg-zinc-50 p-5 rounded-lg border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>Simulate Provider Webhook Event</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 mb-1">Target Payment Reference</label>
                  <input
                    type="text"
                    value={simRef}
                    onChange={(e) => setSimRef(e.target.value)}
                    className="w-full bg-white border border-zinc-100 rounded-xl px-3 py-2 text-zinc-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 mb-1">Provider</label>
                  <select
                    value={simProvider}
                    onChange={(e) => setSimProvider(e.target.value)}
                    className="w-full bg-white border border-zinc-100 rounded-xl px-3 py-2 text-zinc-950"
                  >
                    <option value="bachs">Bachs.io</option>
                    <option value="paystack">Paystack</option>
                    <option value="flutterwave">Flutterwave</option>
                  </select>
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => handleSimulateWebhook(false)}
                    className="flex-1 bg-teal-700 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl transition"
                  >
                    Send 1st Webhook (Fulfill Order)
                  </button>
                  <button
                    onClick={() => handleSimulateWebhook(true)}
                    className="flex-1 bg-orange-700 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition"
                  >
                    Send Duplicate Webhook (Test Idempotency)
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-zinc-50 p-5 rounded-lg border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-teal-700" />
                <span>Background Jobs & Cron Engine</span>
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pending orders expire after 15 minutes to release locked inventory back to ticket availability.
              </p>
              <button
                onClick={handleTriggerExpiration}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold py-2.5 rounded-xl border border-zinc-200 transition text-xs"
              >
                ⚡ Trigger Order Expiration Runner Now
              </button>

              {simMessage && (
                <div className="p-3 bg-white rounded-xl border border-zinc-100 text-xs font-mono text-teal-700 whitespace-pre-wrap overflow-x-auto max-h-40">
                  {simMessage}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Webhooks Log */}
        {activeTab === 'webhooks' && (
          <div className="space-y-3">
            {webhookLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No webhook events recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {webhookLogs.map((w) => (
                  <div key={w.id} className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-teal-700 font-bold">{w.provider.toUpperCase()} • {w.event_type}</span>
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        w.processing_status === 'PROCESSED' ? 'bg-teal-600/10 text-teal-700' : 'bg-orange-600/10 text-orange-700'
                      }`}>
                        {w.processing_status}
                      </span>
                    </div>
                    <div className="text-zinc-600 text-[11px] truncate">Ref: {w.event_id} | Received: {w.received_at}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Outbox Sent Emails */}
        {activeTab === 'emails' && (
          <div className="space-y-3">
            {sentEmails.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No emails sent yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sentEmails.map((e) => (
                  <div key={e.id} className="p-3.5 bg-zinc-50 border border-zinc-100 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between font-bold text-zinc-950">
                      <span className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-teal-700" />
                        <span>{e.subject}</span>
                      </span>
                      <span className="text-zinc-500 font-normal">{new Date(e.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-zinc-600 text-[11px]">To: <span className="text-zinc-800">{e.to}</span></div>
                    <pre className="p-2 bg-white rounded text-[10px] text-zinc-600 font-mono overflow-x-auto">
                      {e.data_json}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
