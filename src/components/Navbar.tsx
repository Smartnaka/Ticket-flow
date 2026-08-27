import { Calendar, Menu, ShieldCheck, Ticket, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { UserRole } from '../types';

interface NavbarProps {
  currentRole: UserRole;
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenAuthModal: () => void;
  onRoleSwitch: (role: UserRole) => void;
  user: any;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRole, currentView, onNavigate, onOpenAuthModal, user, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = [
    { id: 'events', label: 'Events', visible: true, icon: Calendar },
    { id: 'my-tickets', label: 'My tickets', visible: currentRole === 'CUSTOMER', icon: Ticket },
    { id: 'organizer-dashboard', label: 'Organizer', visible: currentRole === 'ORGANIZER', icon: Calendar },
    { id: 'admin-dashboard', label: 'Admin', visible: currentRole === 'ADMIN', icon: ShieldCheck },
  ].filter((item) => item.visible);
  const select = (id: string) => { onNavigate(id); setMobileOpen(false); };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button onClick={() => select('events')} className="flex items-center gap-2.5 text-left" aria-label="TicketWave home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white"><Ticket className="h-4 w-4" /></span>
          <span className="text-base font-semibold tracking-tight text-zinc-950">TicketWave</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {items.map(({ id, label, icon: Icon }) => {
            const active = currentView === id || (id === 'events' && currentView === 'event-detail');
            return <button key={id} onClick={() => select(id)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'}`}><Icon className="h-4 w-4" />{label}</button>;
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? <>
            <div className="flex items-center gap-2 border-r border-zinc-200 pr-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">{user.name?.charAt(0).toUpperCase() || 'U'}</span>
              <span className="max-w-28 truncate text-sm font-medium text-zinc-700">{user.name}</span>
            </div>
            <button onClick={onLogout} className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950">Sign out</button>
          </> : <button onClick={onOpenAuthModal} className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"><User className="h-4 w-4" />Sign in</button>}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 md:hidden" aria-expanded={mobileOpen} aria-label="Toggle menu">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {mobileOpen && <div className="border-t border-zinc-200 bg-white px-4 py-3 md:hidden">
        <nav className="grid gap-1" aria-label="Mobile navigation">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => select(id)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100"><Icon className="h-4 w-4" />{label}</button>)}</nav>
        <div className="mt-3 border-t border-zinc-200 pt-3">{user ? <button onClick={() => { onLogout(); setMobileOpen(false); }} className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm font-medium text-zinc-700">Sign out</button> : <button onClick={() => { onOpenAuthModal(); setMobileOpen(false); }} className="w-full rounded-md bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white">Sign in</button>}</div>
      </div>}
    </header>
  );
};
