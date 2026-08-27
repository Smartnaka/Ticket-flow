import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';
import { EventCard } from './components/EventCard';
import { Navbar } from './components/Navbar';
import { OrganizerCreateEventModal } from './components/OrganizerCreateEventModal';
import { OrganizerScanner } from './components/OrganizerScanner';
import { RefundModal } from './components/RefundModal';
import { TicketCard } from './components/TicketCard';
import { Event, Order, Ticket as TicketTypeItem, User, UserRole } from './types';

export default function App() {
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [currentView, setCurrentView] = useState('events'); // events | event-detail | my-tickets | organizer-dashboard | admin-dashboard | payment-status
  const [user, setUser] = useState<User | null>(null);
  const [userToken, setUserToken] = useState<string | null>(localStorage.getItem('tw_auth_token'));

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventSlug, setSelectedEventSlug] = useState<string | null>(null);
  const [activeEventDetail, setActiveEventDetail] = useState<any | null>(null);

  // Ticket selection quantities for detail view
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Customer Tickets State
  const [myTickets, setMyTickets] = useState<TicketTypeItem[]>([]);

  // Organizer Dashboard State
  const [organizerAnalytics, setOrganizerAnalytics] = useState<any | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);

  // Admin Hub State
  const [adminAnalytics, setAdminAnalytics] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Modals State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState<Order | null>(null);

  // Payment Status View Ref
  const [paymentStatusRef, setPaymentStatusRef] = useState<string | null>(null);
  const [paymentStatusData, setPaymentStatusData] = useState<any | null>(null);

  // Check stored JWT session on mount
  useEffect(() => {
    const token = localStorage.getItem('tw_auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then((data) => {
          setUser(data.user);
          setUserToken(token);
          setRole(data.user.role);
        })
        .catch(() => {
          localStorage.removeItem('tw_auth_token');
          setUser(null);
          setUserToken(null);
          setRole('CUSTOMER');
        });
    }
  }, []);

  // Initial Data Fetching
  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/events?category=${selectedCategory}&search=${searchQuery}`);
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchMyTickets = async () => {
    try {
      const res = await fetch(`/api/tickets/my-tickets?email=${user?.email || ''}`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      const data = await res.json();
      setMyTickets(data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
  };

  const fetchOrganizerAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics/organizer', {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      const data = await res.json();
      setOrganizerAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch organizer analytics:', err);
    }
  };

  const fetchAdminAnalytics = async () => {
    try {
      const [anRes, auditRes] = await Promise.all([
        fetch('/api/analytics/admin', { headers: userToken ? { Authorization: `Bearer ${userToken}` } : {} }),
        fetch('/api/analytics/audit-logs', { headers: userToken ? { Authorization: `Bearer ${userToken}` } : {} }),
      ]);
      setAdminAnalytics(await anRes.json());
      setAuditLogs(await auditRes.json());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (currentView === 'my-tickets') fetchMyTickets();
    if (currentView === 'organizer-dashboard') fetchOrganizerAnalytics();
    if (currentView === 'admin-dashboard') fetchAdminAnalytics();
  }, [currentView, role]);

  // Handle URL Payment Callback Query and password reset deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    if (window.location.pathname === '/reset-password' && resetToken) {
      setPasswordResetToken(resetToken);
      setAuthInitialMode('reset');
      setAuthModalOpen(true);
      return;
    }

    const ref = params.get('ref');
    if (ref) {
      setPaymentStatusRef(ref);
      setCurrentView('payment-status');
      fetch(`/api/payments/verify/${ref}`)
        .then((r) => r.json())
        .then((data) => setPaymentStatusData(data))
        .catch(console.error);
    }
  }, []);

  const handleAuthSuccess = (userData: User, token: string) => {
    setUser(userData);
    setUserToken(token);
    setRole(userData.role);
    localStorage.setItem('tw_auth_token', token);

    if (userData.role === 'ORGANIZER') {
      setCurrentView('organizer-dashboard');
    } else if (userData.role === 'ADMIN') {
      setCurrentView('admin-dashboard');
    } else {
      setCurrentView('events');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserToken(null);
    setRole('CUSTOMER');
    localStorage.removeItem('tw_auth_token');
    setCurrentView('events');
  };

  // Open Event Details
  const handleEventClick = async (slug: string) => {
    setSelectedEventSlug(slug);
    try {
      const res = await fetch(`/api/events/${slug}`);
      const data = await res.json();
      setActiveEventDetail(data);

      // Initialize default quantities to 0
      const initialQty: Record<string, number> = {};
      if (data.ticket_types) {
        data.ticket_types.forEach((tt: any) => {
          initialQty[tt.id] = 0;
        });
      }
      setSelectedQuantities(initialQty);
      setCurrentView('event-detail');
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuantityChange = (ticketTypeId: string, delta: number, max: number) => {
    setSelectedQuantities((prev) => {
      const current = prev[ticketTypeId] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [ticketTypeId]: next };
    });
  };

  // Prepare checkout items
  const selectedCheckoutItems = activeEventDetail?.ticket_types
    ? activeEventDetail.ticket_types
        .filter((tt: any) => (selectedQuantities[tt.id] || 0) > 0)
        .map((tt: any) => ({
          ticketType: tt,
          quantity: selectedQuantities[tt.id],
        }))
    : [];

  const totalSelectedTicketsCount = selectedCheckoutItems.reduce((s: number, i: any) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 flex flex-col font-sans selection:bg-teal-600 selection:text-zinc-950">
      <Navbar
        currentRole={role}
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenAuthModal={() => {
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }}
        onRoleSwitch={() => {}}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {/* VIEW 1: PUBLIC EVENTS DISCOVERY */}
        {currentView === 'events' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Hero Welcome Banner */}
            <div className="rounded-xl border border-zinc-200 bg-white p-7 sm:p-10">
              <div className="relative z-10 max-w-2xl space-y-4">
                <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-600/10 text-teal-700 font-semibold text-xs border border-teal-600/20">
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Verified Ticketing & Fast Checkout</span>
                </span>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 leading-tight">
                  Find events worth leaving home for
                </h1>
                <p className="text-zinc-700 text-sm sm:text-base leading-relaxed">
                  Browse upcoming events, buy official tickets, and keep every pass in one place.
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg border border-zinc-100">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events, cities, venues..."
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-950 focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['All', 'Technology & AI', 'Music & Concerts', 'Business & Finance'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-teal-700 text-white shadow-md'
                        : 'bg-zinc-50 text-zinc-600 hover:text-zinc-950 border border-zinc-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Events Grid */}
            {events.length === 0 ? (
              <div className="text-center py-16 bg-white/50 rounded-xl border border-zinc-100/80 space-y-3">
                <Calendar className="w-10 h-10 text-zinc-400 mx-auto" />
                <p className="text-zinc-600 text-sm font-semibold">No events matching search criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((evt) => (
                  <EventCard key={evt.id} event={evt} onClick={handleEventClick} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: PUBLIC EVENT DETAIL (`/events/:slug`) */}
        {currentView === 'event-detail' && activeEventDetail && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <button
              onClick={() => setCurrentView('events')}
              className="text-xs text-teal-700 hover:text-teal-600 font-semibold transition flex items-center space-x-1"
            >
              <span>← Back to Events</span>
            </button>

            {/* Cover Banner */}
            <div className="relative h-72 sm:h-96 w-full rounded-xl overflow-hidden bg-white border border-zinc-100 shadow-sm">
              <img
                src={activeEventDetail.cover_image}
                alt={activeEventDetail.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-5 left-5 right-5 max-w-2xl space-y-2 rounded-lg border border-zinc-200 bg-white/95 p-4">
                <span className="px-3 py-1 rounded-full bg-teal-600/20 text-teal-700 text-xs font-semibold border border-teal-600/30">
                  {activeEventDetail.category}
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-950">
                  {activeEventDetail.title}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-700">
                  Hosted by <span className="font-semibold text-zinc-950">{activeEventDetail.organizer_name}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Event Information Column */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-zinc-100 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-lg text-zinc-950">About This Event</h3>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                    {activeEventDetail.description}
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-xl p-6 space-y-3">
                  <h3 className="font-bold text-lg text-zinc-950">Date & Venue</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-700">
                    <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
                      <span className="text-zinc-500 uppercase font-semibold">Start Date</span>
                      <p className="font-bold text-zinc-950 text-sm">
                        {new Date(activeEventDetail.start_date).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1">
                      <span className="text-zinc-500 uppercase font-semibold">Venue</span>
                      <p className="font-bold text-zinc-950 text-sm">
                        {activeEventDetail.venue}, {activeEventDetail.city}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Selection Sidebar */}
              <div className="space-y-6">
                <div className="bg-white border border-zinc-100 rounded-xl p-6 space-y-6 shadow-sm sticky top-24">
                  <h3 className="font-bold text-lg text-zinc-950 flex items-center justify-between">
                    <span>Select Tickets</span>
                    <Ticket className="w-5 h-5 text-teal-700" />
                  </h3>

                  <div className="space-y-4">
                    {activeEventDetail.ticket_types?.map((tt: any) => {
                      const qty = selectedQuantities[tt.id] || 0;
                      const remaining = Math.max(0, tt.quantity_available - tt.quantity_sold - tt.quantity_reserved);

                      return (
                        <div key={tt.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-zinc-950">{tt.name}</h4>
                              <p className="text-[11px] text-zinc-600 leading-snug">{tt.description}</p>
                            </div>
                            <span className="font-mono font-bold text-teal-700 text-sm">
                              {tt.price_kobo === 0 ? 'Free' : `₦${(tt.price_kobo / 100).toLocaleString()}`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100/60">
                            <span className="text-zinc-500">{remaining} tickets remaining</span>

                            {/* Quantity Selector */}
                            <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-zinc-100">
                              <button
                                onClick={() => handleQuantityChange(tt.id, -1, tt.max_per_customer)}
                                disabled={qty === 0}
                                className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 disabled:opacity-30"
                              >
                                -
                              </button>
                              <span className="font-mono text-sm font-bold w-5 text-center text-zinc-950">{qty}</span>
                              <button
                                onClick={() => handleQuantityChange(tt.id, 1, Math.min(remaining, tt.max_per_customer))}
                                disabled={qty >= tt.max_per_customer || remaining === 0}
                                className="w-6 h-6 rounded-lg bg-teal-700 text-white font-bold hover:bg-teal-600 disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCheckoutModalOpen(true)}
                    disabled={totalSelectedTicketsCount === 0}
                    className="w-full bg-teal-700 hover:bg-teal-600 text-white font-bold py-3.5 rounded-lg shadow-sm transition disabled:opacity-40 text-sm"
                  >
                    {totalSelectedTicketsCount === 0
                      ? 'Select at least 1 ticket'
                      : `Proceed to Checkout (${totalSelectedTicketsCount} Passes)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: CUSTOMER TICKETS PORTAL */}
        {currentView === 'my-tickets' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-zinc-950">My Purchased Tickets</h1>
                <p className="text-xs text-zinc-600">Official entrance QR passes for upcoming events</p>
              </div>
              <button
                onClick={fetchMyTickets}
                className="p-2 bg-white border border-zinc-100 rounded-xl text-zinc-600 hover:text-zinc-950 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {myTickets.length === 0 ? (
              <div className="text-center py-16 bg-white/50 rounded-xl border border-zinc-100 space-y-3">
                <Ticket className="w-10 h-10 text-zinc-400 mx-auto" />
                <p className="text-zinc-600 text-sm font-semibold">No active tickets found.</p>
                <button
                  onClick={() => setCurrentView('events')}
                  className="bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Browse Events
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: ORGANIZER STUDIO */}
        {currentView === 'organizer-dashboard' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h1 className="text-2xl font-extrabold text-zinc-950">Organizer Studio</h1>
                <p className="text-xs text-zinc-600">Track real-time sales, manage event capacity, and scan tickets</p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setScannerOpen(!scannerOpen)}
                  className={`px-4 py-2.5 rounded-lg font-semibold text-xs border transition flex items-center space-x-2 ${
                    scannerOpen
                      ? 'bg-teal-700 text-white border-teal-600'
                      : 'bg-white text-zinc-700 border-zinc-100 hover:bg-zinc-100'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>{scannerOpen ? 'Close Scanner' : 'Open Ticket Scanner'}</span>
                </button>

                <button
                  onClick={() => setCreateEventModalOpen(true)}
                  className="bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Event</span>
                </button>
              </div>
            </div>

            {/* Scanner Component Dropdown */}
            {scannerOpen && (
              <OrganizerScanner token={userToken} />
            )}

            {/* Analytics Metric Cards */}
            {organizerAnalytics && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Total Revenue</span>
                  <p className="text-lg font-bold text-teal-700 font-mono">
                    ₦{(organizerAnalytics.total_revenue_kobo / 100).toLocaleString()}
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Tickets Sold</span>
                  <p className="text-lg font-bold text-zinc-950 font-mono">{organizerAnalytics.tickets_sold}</p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Stock Remaining</span>
                  <p className="text-lg font-bold text-orange-700 font-mono">{organizerAnalytics.tickets_remaining}</p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Attendees Scanned</span>
                  <p className="text-lg font-bold text-teal-700 font-mono">{organizerAnalytics.total_attendees_scanned}</p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Conversion Rate</span>
                  <p className="text-lg font-bold text-teal-700 font-mono">{organizerAnalytics.conversion_rate}%</p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-4 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Total Orders</span>
                  <p className="text-lg font-bold text-zinc-800 font-mono">{organizerAnalytics.total_orders}</p>
                </div>
              </div>
            )}

            {/* Recent Orders & Attendees Management Table */}
            {organizerAnalytics?.recent_transactions && (
              <div className="bg-white border border-zinc-100 rounded-xl p-6 space-y-4 shadow-sm">
                <h3 className="font-bold text-base text-zinc-950">Recent Customer Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-700">
                    <thead className="bg-zinc-50 text-zinc-500 font-semibold uppercase border-b border-zinc-100">
                      <tr>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Event</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100/60 font-mono">
                      {organizerAnalytics.recent_transactions.map((ord: Order) => (
                        <tr key={ord.id} className="hover:bg-zinc-50/40">
                          <td className="p-3 font-semibold text-teal-700">{ord.id}</td>
                          <td className="p-3 font-sans text-zinc-800">{ord.customer_name}</td>
                          <td className="p-3 font-sans text-zinc-600 truncate max-w-xs">{ord.event_title}</td>
                          <td className="p-3 text-teal-700 font-bold">₦{(ord.total_kobo / 100).toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              ord.status === 'PAID' ? 'bg-teal-600/10 text-teal-700' : 'bg-orange-600/10 text-orange-700'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {ord.status === 'PAID' && (
                              <button
                                onClick={() => {
                                  setOrderToRefund(ord);
                                  setRefundModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded bg-orange-600/10 text-orange-700 border border-orange-600/20 hover:bg-orange-600/20 transition font-sans text-[11px]"
                              >
                                Refund Order
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: ADMIN HUB */}
        {currentView === 'admin-dashboard' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="border-b border-zinc-100 pb-4">
              <h1 className="text-2xl font-extrabold text-zinc-950 flex items-center space-x-2">
                <ShieldCheck className="w-6 h-6 text-orange-700" />
                <span>Platform Admin Hub</span>
              </h1>
              <p className="text-xs text-zinc-600">Global financial metrics, platform fee volume, and traceable audit trails</p>
            </div>

            {adminAnalytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-zinc-100 rounded-lg p-5 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Platform Fee Revenue</span>
                  <p className="text-2xl font-extrabold text-teal-700 font-mono">
                    ₦{(adminAnalytics.total_platform_revenue_kobo / 100).toLocaleString()}
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-5 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Gross Volume (GMV)</span>
                  <p className="text-2xl font-extrabold text-zinc-950 font-mono">
                    ₦{(adminAnalytics.total_gross_volume_kobo / 100).toLocaleString()}
                  </p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-5 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Total Organizers</span>
                  <p className="text-2xl font-extrabold text-teal-700 font-mono">{adminAnalytics.total_organizers}</p>
                </div>

                <div className="bg-white border border-zinc-100 rounded-lg p-5 space-y-1">
                  <span className="text-zinc-500 text-[11px] uppercase font-bold">Webhooks Processed</span>
                  <p className="text-2xl font-extrabold text-teal-700 font-mono">{adminAnalytics.webhooks_processed}</p>
                </div>
              </div>
            )}

            {/* Audit Trail Table */}
            <div className="bg-white border border-zinc-100 rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-zinc-950">Platform System Audit Logs</h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-zinc-700">
                  <thead className="bg-zinc-50 text-zinc-500 font-semibold uppercase border-b border-zinc-100 sticky top-0">
                    <tr>
                      <th className="p-3">Action</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Details</th>
                      <th className="p-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100/60 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/40">
                        <td className="p-3 font-semibold text-teal-700">{log.action}</td>
                        <td className="p-3 text-zinc-700">{log.actor_role} ({log.actor_id})</td>
                        <td className="p-3 text-zinc-600">{log.entity_type}:{log.entity_id}</td>
                        <td className="p-3 text-zinc-500 truncate max-w-xs">{log.details_json}</td>
                        <td className="p-3 text-right text-zinc-500">{new Date(log.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* VIEW 7: PAYMENT STATUS CALLBACK PAGE */}
        {currentView === 'payment-status' && (
          <div className="max-w-md mx-auto my-16 px-4">
            <div className="bg-white border border-zinc-100 rounded-xl p-8 text-center space-y-6 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-teal-600/10 text-teal-700 flex items-center justify-center mx-auto border border-teal-600/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-zinc-950">Payment Confirmed!</h2>
                <p className="text-xs text-zinc-600">
                  Your ticket passes have been cryptographically generated and emailed to your inbox.
                </p>
              </div>

              {paymentStatusData?.order && (
                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-lg text-xs space-y-2 text-left font-mono">
                  <div className="flex justify-between text-zinc-600">
                    <span>Order Reference</span>
                    <span className="text-zinc-950">{paymentStatusData.order.payment_reference}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Tickets Issued</span>
                    <span className="text-teal-700 font-bold">{paymentStatusData.tickets?.length || 1} Passes</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => setCurrentView('my-tickets')}
                className="w-full bg-teal-700 hover:bg-teal-600 text-white font-bold py-3.5 rounded-lg shadow-sm transition text-sm"
              >
                View My Tickets & QR Codes
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-medium text-zinc-700">TicketWave</span>
          <span>Secure ticketing for events that matter.</span>
        </div>
      </footer>

      {/* MODALS */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          if (authInitialMode === 'reset') {
            setAuthInitialMode('login');
            setPasswordResetToken(null);
            window.history.replaceState({}, document.title, '/');
          }
        }}
        onSuccess={(u, t) => handleAuthSuccess(u, t)}
        initialMode={authInitialMode}
        resetToken={passwordResetToken}
      />

      {activeEventDetail && (
        <CheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          event={activeEventDetail}
          selectedTickets={selectedCheckoutItems}
          user={user}
        />
      )}

      <OrganizerCreateEventModal
        isOpen={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        token={userToken}
        onSuccess={() => {
          fetchEvents();
          if (currentView === 'organizer-dashboard') fetchOrganizerAnalytics();
        }}
      />

      <RefundModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        order={orderToRefund}
        token={userToken}
        onSuccess={() => {
          if (currentView === 'organizer-dashboard') fetchOrganizerAnalytics();
        }}
      />
    </div>
  );
}
