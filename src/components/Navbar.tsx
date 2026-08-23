import { Calendar, ShieldCheck, Ticket, User } from 'lucide-react';
import React from 'react';
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

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentView,
  onNavigate,
  onOpenAuthModal,
  onRoleSwitch,
  user,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('events')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Ticket className="w-5 h-5 text-emerald-400 transform -rotate-12" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              TicketWave
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PRO
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => onNavigate('events')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
              currentView === 'events' || currentView === 'event-detail'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Explore Events
          </button>

          {currentRole === 'CUSTOMER' && (
            <button
              onClick={() => onNavigate('my-tickets')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                currentView === 'my-tickets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>My Tickets</span>
            </button>
          )}

          {currentRole === 'ORGANIZER' && (
            <button
              onClick={() => onNavigate('organizer-dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                currentView === 'organizer-dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Organizer Studio</span>
            </button>
          )}

          {currentRole === 'ADMIN' && (
            <button
              onClick={() => onNavigate('admin-dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                currentView === 'admin-dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Admin Hub</span>
            </button>
          )}
        </nav>

        {/* Right Actions: Dev Tools & Auth Profile */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3 border-l border-slate-800 pl-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold text-xs flex items-center justify-center border border-slate-700">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-white truncate max-w-[120px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {user.role}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-md transition flex items-center space-x-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
