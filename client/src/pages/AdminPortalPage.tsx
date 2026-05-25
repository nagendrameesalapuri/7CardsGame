import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

const ADMIN_URL = `${window.location.origin}/admin`;

const links = [
  { icon: '👥', label: 'Users', desc: 'Manage players, ban, reset stats', href: ADMIN_URL + '#users' },
  { icon: '🎮', label: 'Games', desc: 'View active rooms and force-end games', href: ADMIN_URL + '#games' },
  { icon: '💰', label: 'Wallet', desc: 'Approve deposits & withdrawals', href: ADMIN_URL + '#wallet' },
  { icon: '⚙️', label: 'Config', desc: 'Game rules, feature flags, limits', href: ADMIN_URL + '#config' },
  { icon: '📊', label: 'Analytics', desc: 'Revenue, session stats, player trends', href: ADMIN_URL + '#analytics' },
  { icon: '🏆', label: 'Survival', desc: 'Tournament tiers and team arena', href: ADMIN_URL + '#survival' },
  { icon: '📢', label: 'Announcements', desc: 'Broadcast messages to all players', href: ADMIN_URL + '#announcements' },
  { icon: '🔔', label: 'Push Notifications', desc: 'Send targeted or global notifications', href: ADMIN_URL + '#push' },
];

export function AdminPortalPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  if (!user?.isAdmin) {
    navigate('/lobby', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-bg px-4 py-8 pb-20">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-3xl mb-2"
            style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(99,102,241,0.15))', border: '1px solid rgba(168,85,247,0.4)' }}>
            🛡️
          </div>
          <h1 className="text-2xl font-black text-white">Admin Portal</h1>
          <p className="text-xs text-dark-muted">Welcome, {user.username}. Full admin access granted.</p>
        </motion.div>

        {/* Open full admin panel button */}
        <motion.a
          href={ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="block w-full py-3.5 rounded-2xl text-center font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', boxShadow: '0 0 24px rgba(168,85,247,0.3)' }}
        >
          Open Full Admin Panel →
        </motion.a>

        {/* Quick links grid */}
        <div className="grid grid-cols-2 gap-3">
          {links.map((link, i) => (
            <motion.a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 + i * 0.04 }}
              className="flex flex-col gap-1.5 p-4 rounded-2xl hover:opacity-90 active:scale-95 transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-2xl">{link.icon}</span>
              <span className="text-sm font-bold text-white">{link.label}</span>
              <span className="text-[10px] text-dark-muted leading-snug">{link.desc}</span>
            </motion.a>
          ))}
        </div>

        {/* Admin status badge */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-dark-muted">Logged in as admin · {user.email ?? user.username}</span>
        </div>
      </div>
    </div>
  );
}
