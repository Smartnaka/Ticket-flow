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
    <div className="bg-white border border-zinc-100 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700/20 text-teal-700 flex items-center justify-center border border-teal-600/30">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-950">Organizer Ticket Scanner</h2>
            <p className="text-xs text-zinc-600">Scan QR codes or enter ticket numbers to validate entry</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-teal-600/10 text-teal-700 font-mono font-semibold border border-teal-600/20">
          SCANNER ACTIVE
        </span>
      </div>

      {/* Manual Input Search Box */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase text-zinc-600 tracking-wider">
          Scan Code / Enter Ticket Number
        </label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanSubmit(manualCode)}
              placeholder="e.g. TKT-2026-REG-99128 or paste QR hash"
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-950 focus:outline-none focus:border-teal-600 font-mono"
            />
          </div>
          <button
            onClick={() => handleScanSubmit(manualCode)}
            disabled={loading || !manualCode.trim()}
            className="bg-teal-700 hover:bg-teal-600 text-white font-semibold px-5 py-3 rounded-xl transition disabled:opacity-50 text-sm shadow-md flex items-center space-x-2"
          >
            <span>Validate</span>
          </button>
        </div>
      </div>

      {/* Scan Feedback Banner */}
      {scanResult && (
        <div
          className={`p-5 rounded-lg border transition-all duration-300 flex items-start space-x-4 ${
            scanResult.success
              ? 'bg-teal-600/10 border-teal-600/30 text-teal-600'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {scanResult.success ? (
            <CheckCircle className="w-8 h-8 text-teal-700 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-8 h-8 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h4 className="font-bold text-lg">{scanResult.message}</h4>
            {scanResult.ticket && (
              <div className="text-xs text-zinc-700 space-y-0.5 font-mono">
                <p>Pass Type: <span className="text-zinc-950 font-semibold">{scanResult.ticket.ticket_type_name}</span></p>
                <p>Holder: <span className="text-zinc-950 font-semibold">{scanResult.ticket.customer_name}</span> ({scanResult.ticket.customer_email})</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Scan History Log */}
      {recentScans.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-100">
          <h3 className="text-xs font-semibold uppercase text-zinc-600 tracking-wider">
            Recent Gate Activity Log
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {recentScans.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl text-xs border border-zinc-100/60"
              >
                <div className="flex items-center space-x-2 truncate">
                  {s.result.success ? (
                    <CheckCircle className="w-4 h-4 text-teal-700 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-mono text-zinc-700 truncate">{s.code}</span>
                </div>
                <div className="flex items-center space-x-3 text-zinc-500">
                  <span>{s.timestamp}</span>
                  <span
                    className={`font-semibold ${
                      s.result.success ? 'text-teal-700' : 'text-rose-400'
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
