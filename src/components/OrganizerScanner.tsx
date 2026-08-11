import { Camera, CheckCircle, QrCode, Search, ShieldAlert, XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface OrganizerScannerProps {
  token: string;
}

export const OrganizerScanner: React.FC<OrganizerScannerProps> = ({ token }) => {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    ticket?: any;
  } | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  const handleScanSubmit = async (codeToSubmit: string) => {
    if (!codeToSubmit.trim()) return;
    setLoading(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_data: codeToSubmit.trim() }),
      });

      const data = await res.json();
      setScanResult(data);

      setRecentScans((prev) => [
        {
          code: codeToSubmit,
          result: data,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);

      if (data.success) {
        setManualCode('');
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: `✕ Network error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Organizer Ticket Scanner</h2>
            <p className="text-xs text-slate-400">Scan QR codes or enter ticket numbers to validate entry</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-semibold border border-emerald-500/20">
          SCANNER ACTIVE
        </span>
      </div>

      {/* Manual Input Search Box */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase text-slate-400 tracking-wider">
          Scan Code / Enter Ticket Number
        </label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanSubmit(manualCode)}
              placeholder="e.g. TKT-2026-REG-99128 or paste QR hash"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
          <button
            onClick={() => handleScanSubmit(manualCode)}
            disabled={loading || !manualCode.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-3 rounded-xl transition disabled:opacity-50 text-sm shadow-md flex items-center space-x-2"
          >
            <span>Validate</span>
          </button>
        </div>
      </div>

      {/* Scan Feedback Banner */}
      {scanResult && (
        <div
          className={`p-5 rounded-2xl border transition-all duration-300 flex items-start space-x-4 ${
            scanResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {scanResult.success ? (
            <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-8 h-8 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h4 className="font-bold text-lg">{scanResult.message}</h4>
            {scanResult.ticket && (
              <div className="text-xs text-slate-300 space-y-0.5 font-mono">
                <p>Pass Type: <span className="text-white font-semibold">{scanResult.ticket.ticket_type_name}</span></p>
                <p>Holder: <span className="text-white font-semibold">{scanResult.ticket.customer_name}</span> ({scanResult.ticket.customer_email})</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Scan History Log */}
      {recentScans.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
            Recent Gate Activity Log
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {recentScans.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-950 rounded-xl text-xs border border-slate-800/60"
              >
                <div className="flex items-center space-x-2 truncate">
                  {s.result.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-mono text-slate-300 truncate">{s.code}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-500">
                  <span>{s.timestamp}</span>
                  <span
                    className={`font-semibold ${
                      s.result.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {s.result.success ? 'VALID' : 'REJECTED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
