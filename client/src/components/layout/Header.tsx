import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useNotificationStore } from '../../store/notificationStore';
import { on } from '../../services/socket';

const TYPE_COLOR: Record<string, string> = {
  success: '#22c55e',
  warning: '#fbbf24',
  info:    '#60a5fa',
};

const CATEGORY_ICON: Record<string, string> = {
  tournament:      '⚔',
  boss_arena:      '👑',
  rewards:         '🎁',
  daily_missions:  '🎯',
  survival_streak: '🔥',
  multiplayer:     '👥',
  events:          '🎉',
  system:          '🔔',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function BellPanel({ onClose }: { onClose: () => void }) {
  const { notifications, history, historyUnread, markAllRead, markHistoryRead, clearAll, loadHistory, historyLoaded } = useNotificationStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Merge real-time and DB history for a unified view (deduplicate by id)
  const rtItems = notifications.map(n => ({
    id: n.id, title: n.title, message: n.message,
    type: n.type, category: n.category ?? 'system',
    actionUrl: n.actionUrl, sentAt: n.sentAt, read: n.read, source: 'rt' as const,
  }));
  const dbItems = history.map(n => ({
    id: n._id, title: n.title, message: n.message,
    type: n.type, category: n.category,
    actionUrl: n.actionUrl, sentAt: n.createdAt, read: n.read, source: 'db' as const,
  }));
  // Prefer RT items; DB items that aren't already represented in RT
  const rtIds = new Set(rtItems.map(n => n.title + n.message));
  const merged = [
    ...rtItems,
    ...dbItems.filter(n => !rtIds.has(n.title + n.message)),
  ].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()).slice(0, 30);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    markAllRead();
    if (historyUnread > 0) markHistoryRead();
    if (!historyLoaded) loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-11 w-80 max-w-[calc(100vw-16px)] rounded-2xl shadow-2xl z-50 flex flex-col"
      style={{
        background: 'rgba(8,6,24,0.98)',
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.12)',
        maxHeight: '72vh',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white">Notifications</span>
          {merged.filter(n => !n.read).length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              {merged.filter(n => !n.read).length} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {merged.length > 0 && (
            <button onClick={clearAll}
              className="text-[10px] text-dark-muted hover:text-red-400 transition-colors">
              Clear
            </button>
          )}
          <button onClick={() => { onClose(); navigate('/notifications'); }}
            className="text-[10px] font-semibold transition-colors"
            style={{ color: '#a5b4fc' }}>
            View all →
          </button>
        </div>
      </div>

      {/* Body */}
      {merged.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-3xl mb-2">🔕</p>
          <p className="text-xs text-dark-muted">No arena alerts yet</p>
        </div>
      ) : (
        <div className="overflow-y-auto divide-y divide-white/[0.04]">
          {merged.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
              onClick={() => { if (n.actionUrl) { onClose(); navigate(n.actionUrl); } }}
            >
              {/* Category icon */}
              <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm mt-0.5"
                style={{
                  background: `${TYPE_COLOR[n.type] ?? '#60a5fa'}18`,
                  border: `1px solid ${TYPE_COLOR[n.type] ?? '#60a5fa'}30`,
                }}>
                {CATEGORY_ICON[n.category] ?? '🔔'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1.5">
                  <p className="text-xs font-semibold text-white flex-1 leading-snug">{n.title}</p>
                  {!n.read && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1"
                      style={{ background: '#6366f1' }} />
                  )}
                </div>
                <p className="text-[10px] text-dark-muted mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                <p className="text-[9px] text-dark-muted/50 mt-1">{timeAgo(n.sentAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t flex-shrink-0 flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button onClick={() => { onClose(); navigate('/notifications'); }}
          className="text-[10px] font-semibold transition-colors flex items-center gap-1"
          style={{ color: 'rgba(148,163,184,0.5)' }}>
          ⚙ Notification settings
        </button>
        <span className="text-[9px]" style={{ color: 'rgba(148,163,184,0.3)' }}>Arena of Sevens</span>
      </div>
    </motion.div>
  );
}

export function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, historyUnread, addNotification } = useNotificationStore();
  const [bellOpen, setBellOpen] = useState(false);

  const totalUnread = unreadCount + historyUnread;

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      return on('admin:notification', (n) => addNotification({
        ...n,
        category: (n as any).category ?? 'system',
        actionUrl: (n as any).actionUrl,
      }));
    } catch {
      return () => {};
    }
  }, [isAuthenticated, addNotification]);

  const navItems = [
    { to: '/lobby',         label: 'Play',    icon: '⚔️' },
    { to: '/leaderboard',   label: 'Board',   icon: '🏆' },
    { to: '/wallet',        label: 'Rewards', icon: '🎁' },
    { to: '/notifications', label: 'Alerts',  icon: '🔔' },
    { to: '/profile',       label: 'Profile', icon: '👤' },
  ];

  return (
    <>
      {/* Top header */}
      <header className="bg-dark-surface/90 backdrop-blur-md border-b border-dark-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))', border: '1px solid rgba(99,102,241,0.4)' }}>
              ⚔️
            </div>
            <div className="leading-tight">
              <span className="font-black text-base text-white tracking-tight">Arena of Sevens</span>
              <span className="hidden sm:block text-[9px] text-dark-muted tracking-widest uppercase font-semibold" style={{ color: 'rgba(99,102,241,0.8)' }}>Master the SHOW</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-6 text-sm text-dark-muted">
            <Link to="/lobby"         className="hover:text-white transition-colors">Play</Link>
            <Link to="/leaderboard"   className="hover:text-white transition-colors">Leaderboard</Link>
            <Link to="/wallet"        className="hover:text-white transition-colors">Rewards</Link>
            <Link to="/notifications" className="hover:text-white transition-colors">Alerts</Link>
            <Link to="/profile"       className="hover:text-white transition-colors">Profile</Link>
          </nav>

          {/* Right: bell + theme + user */}
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setBellOpen((v) => !v)}
                  className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-dark-border/50 transition-colors"
                  aria-label="Notifications"
                >
                  <motion.span
                    className="text-lg"
                    animate={totalUnread > 0 ? { rotate: [0, -8, 8, -6, 6, 0] } : {}}
                    transition={{ duration: 0.5, repeat: totalUnread > 0 ? Infinity : 0, repeatDelay: 8 }}
                  >
                    🔔
                  </motion.span>
                  {totalUnread > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-0.5"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff' }}
                    >
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </motion.span>
                  )}
                </motion.button>
                <AnimatePresence>
                  {bellOpen && <BellPanel onClose={() => setBellOpen(false)} />}
                </AnimatePresence>
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
                  className="text-xs text-dark-muted hover:text-red-400 transition-colors px-2 py-1 rounded"
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

      {/* Mobile bottom nav */}
      {isAuthenticated && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-dark-surface/95 backdrop-blur-md border-t border-dark-border">
          <div className="flex items-center justify-around h-14">
            {navItems.map(({ to, label, icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors relative ${
                    active ? 'text-neon-green' : 'text-dark-muted'
                  }`}
                >
                  <span className="text-xl leading-none">{icon}</span>
                  <span className="text-[10px] font-medium">{label}</span>
                  {to === '/notifications' && totalUnread > 0 && (
                    <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
                      style={{ background: '#6366f1', color: '#fff' }}>
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
