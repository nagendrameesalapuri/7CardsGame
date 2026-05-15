import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useNotificationStore } from '../../store/notificationStore';
import { on } from '../../services/socket';

function BellPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, clearAll } = useNotificationStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => { markAllRead(); }, [markAllRead]);

  const typeColor: Record<string, string> = {
    success: '#00ff88',
    warning: '#fbbf24',
    info: '#60a5fa',
  };

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ background: 'rgba(12,14,18,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <span className="text-sm font-bold text-dark-text">Notifications</span>
        {notifications.length > 0 && (
          <button onClick={clearAll} className="text-[10px] text-dark-muted hover:text-neon-red transition-colors">
            Clear all
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-dark-muted">No notifications yet</div>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
          {notifications.map((n) => (
            <div key={n.id} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: typeColor[n.type] ?? '#60a5fa', marginTop: 6 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-dark-text">{n.title}</p>
                  <p className="text-[11px] text-dark-muted mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-dark-muted/60 mt-1">
                    {new Date(n.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, addNotification } = useNotificationStore();
  const [bellOpen, setBellOpen] = useState(false);

  // Listen for admin push notifications on the socket
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      return on('admin:notification', (n) => addNotification(n));
    } catch {
      return () => {};
    }
  }, [isAuthenticated, addNotification]);

  const navItems = [
    { to: '/lobby',       label: 'Play',    icon: '🎮' },
    { to: '/leaderboard', label: 'Board',   icon: '🏆' },
    { to: '/wallet',      label: 'Wallet',  icon: '💰' },
    { to: '/profile',     label: 'Profile', icon: '👤' },
  ];

  return (
    <>
      {/* Top header */}
      <header className="bg-dark-surface/90 backdrop-blur-md border-b border-dark-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-dark-text hover:text-neon-green transition-colors">
            <span className="text-2xl">🃏</span>
            <span className="font-game">7 Cards Show</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6 text-sm text-dark-muted">
            <Link to="/lobby" className="hover:text-dark-text transition-colors">Play</Link>
            <Link to="/leaderboard" className="hover:text-dark-text transition-colors">Leaderboard</Link>
            <Link to="/wallet" className="hover:text-dark-text transition-colors">Wallet</Link>
            <Link to="/profile" className="hover:text-dark-text transition-colors">Profile</Link>
          </nav>

          {/* Right: bell + theme + user */}
          <div className="flex items-center gap-3">
            {/* Notification bell — only for authenticated users */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-border/50 transition-colors"
                  aria-label="Notifications"
                >
                  <span className="text-lg">🔔</span>
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5"
                      style={{ background: '#ef4444', color: '#fff' }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {bellOpen && <BellPanel onClose={() => setBellOpen(false)} />}
              </div>
            )}

            <ThemeToggle />
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/profile')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Avatar avatar={user.avatar} size="sm" />
                  <span className="hidden sm:block text-sm text-dark-text font-medium max-w-[100px] truncate">
                    {user.username}
                  </span>
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-dark-muted hover:text-neon-red transition-colors px-2 py-1 rounded"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/"
                className="px-4 py-1.5 bg-neon-green text-dark-bg rounded-lg text-sm font-bold hover:bg-green-400 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav — only shown when authenticated */}
      {isAuthenticated && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-dark-surface/95 backdrop-blur-md border-t border-dark-border">
          <div className="flex items-center justify-around h-14">
            {navItems.map(({ to, label, icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-0.5 px-4 py-1 transition-colors ${
                    active ? 'text-neon-green' : 'text-dark-muted'
                  }`}
                >
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
