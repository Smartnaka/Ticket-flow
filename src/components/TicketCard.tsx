import { Calendar, CheckCircle2, Download, MapPin, QrCode, ShieldAlert, User } from 'lucide-react';
import React, { useState } from 'react';
import { Ticket } from '../types';

interface TicketCardProps {
  ticket: Ticket;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  const [showQrModal, setShowQrModal] = useState(false);

  const getStatusBadge = () => {
    switch (ticket.status) {
      case 'VALID':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-600/10 text-teal-700 border border-teal-600/20 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>VALID PASS</span>
          </span>
        );
      case 'USED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
            USED / SCANNED
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-600/10 text-orange-700 border border-orange-600/20">
            REFUNDED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3" />
            <span>CANCELLED</span>
          </span>
        );
    }
  };

  return (
    <>
      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden shadow-sm hover:border-zinc-200 transition space-y-4 flex flex-col justify-between">
        {/* Ticket Header */}
        <div className="p-5 border-b border-zinc-100 flex items-start justify-between">
          <div className="space-y-1">
            <span className="font-mono text-[11px] font-bold text-teal-700 uppercase tracking-widest">
              {ticket.ticket_number}
            </span>
            <h3 className="font-bold text-lg text-zinc-950 line-clamp-1">{ticket.event_title}</h3>
            <span className="inline-block px-2 py-0.5 rounded bg-teal-600/10 text-teal-600 font-semibold text-xs border border-teal-600/20">
              {ticket.ticket_type_name}
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Ticket Body */}
        <div className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-600 bg-zinc-50/60 p-3.5 rounded-lg border border-zinc-100/80">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-zinc-700">
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span className="font-semibold text-zinc-800">{ticket.customer_name}</span>
              </div>
              <span className="text-[11px] block text-zinc-600 truncate">{ticket.customer_email}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-zinc-700">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                <span className="truncate">{new Date(ticket.event_date || ticket.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1.5 text-zinc-700">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate">{ticket.event_venue || 'Main Venue'}</span>
              </div>
            </div>
          </div>

          {/* QR Code Action Box */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center space-x-2 bg-teal-700/20 hover:bg-teal-700/30 text-teal-600 border border-teal-600/30 font-semibold text-xs px-4 py-2.5 rounded-xl transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Show Entrance QR</span>
            </button>

            <a
              href={ticket.qr_code_data_url}
              download={`${ticket.ticket_number}.png`}
              className="p-2.5 rounded-xl border border-zinc-100 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition"
              title="Download Ticket Image"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* QR Code Inspection Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55  p-4">
          <div className="bg-white border border-zinc-100 rounded-xl max-w-sm w-full p-6 text-center space-y-5 relative shadow-sm">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-950 text-xs px-2 py-1 rounded"
            >
              Close ✕
            </button>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-zinc-950">{ticket.event_title}</h3>
              <p className="text-xs text-teal-700 font-mono">{ticket.ticket_number}</p>
            </div>

            <div className="p-4 bg-white rounded-lg inline-block shadow-inner">
              <img
                src={ticket.qr_code_data_url}
                alt="Ticket QR Code"
                className="w-56 h-56 mx-auto object-contain"
              />
            </div>

            <p className="text-xs text-zinc-600">
              Present this QR code at the event entrance for scanning. Each QR code is cryptographically unique and valid for 1 entry.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
