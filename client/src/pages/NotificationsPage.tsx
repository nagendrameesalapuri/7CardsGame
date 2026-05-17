import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { initFCM, getPermissionState, requestPermission } from '../services/fcm';
import type { NotificationPrefs, AppNotificationRecord } from '../services/api';

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES: {
  key: keyof NotificationPrefs;
  label: string;
  icon: string;
  desc: string;
  color: string;
}[] = [
  { key: 'tournament',      label: 'Tournament Alerts',       icon: '⚔',  desc: 'Stage unlocks, victories, defeats',       color: '#6366f1' },
  { key: 'boss_arena',      label: 'Boss Arena Events',       icon: '👑', desc: 'Final Arena access & Boss AI challenges',   color: '#ef4444' },
  { key: 'rewards',         label: 'Reward Updates',          icon: '🎁', desc: 'Approved vouchers & delivered rewards',     color: '#10b981' },
  { key: 'daily_missions',  label: 'Daily Missions',          icon: '🎯', desc: 'New daily arena challenges & bonus XP',     color: '#f59e0b' },
  { key: 'survival_streak', label: 'Survival Streak Reminders', icon: '🔥', desc: 'Streak milestones & return reminders',    color: '#f97316' },
  { key: 'multiplayer',     label: 'Multiplayer Invites',     icon: '👥', desc: 'Room invitations & game starting alerts',  color: '#06b6d4' },
  { key: 'events',          label: 'Seasonal Events',         icon: '🎉', desc: 'Arena seasons, special weekends, events',  color: '#a855f7' },
  { key: 'system',          label: 'System Updates',          icon: '🔔', desc: 'Account, wallet and system messages',      color: '#94a3b8' },
];

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
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function PermissionBanner({
  permission,
  onEnable,
}: {
  permission: NotificationPermission | 'unsupported' | null;
  onEnable: () => void;
}) {
  if (permission === 'granted' || permission === 'unsupported') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-4"
      style={{
        background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.1))',
        border: '1px solid rgba(99,102,241,0.35)',
      }}
    >
      <span className="text-3xl flex-shrink-0">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-white">Enable Push Notifications</p>
        <p className="text-xs text-dark-muted mt-0.5">
          {permission === 'denied'
            ? 'Notifications blocked. Enable them in your browser settings.'
            : 'Get tactical alerts for Boss Arena, rewards, and tournament events.'}
        </p>
      </div>
      {permission !== 'denied' && (
        <button
          onClick={onEnable}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff' }}
        >
          Enable
        </button>
      )}
    </motion.div>
  );
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative w-10 h-5.5 rounded-full flex-shrink-0 transition-all duration-200"
      style={{
        background: on ? 'linear-gradient(135deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.12)',
        width: 40, height: 22,
      }}
    >
      <span
        className="absolute top-0.5 rounded-full transition-all duration-200"
        style={{
          width: 18, height: 18,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          left: on ? 20 : 2,
        }}
      />
    </button>
  );
}

function NotificationItem({ n }: { n: AppNotificationRecord }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.02] rounded-xl"
      onClick={() => n.actionUrl && navigate(n.actionUrl)}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-base mt-0.5"
        style={{
          background: `${TYPE_COLOR[n.type] ?? '#60a5fa'}15`,
          border: `1px solid ${TYPE_COLOR[n.type] ?? '#60a5fa'}30`,
        }}
      >
        {CATEGORY_ICON[n.category] ?? '🔔'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold text-white leading-snug">{n.title}</p>
          {!n.read && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: '#6366f1' }} />
          )}
        </div>
        <p className="text-[11px] text-dark-muted mt-0.5 leading-relaxed">{n.message}</p>
        <p className="text-[10px] text-dark-muted/50 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
    </motion.div>
  );
}

export function NotificationsPage() {
  const { user } = useAuthStore();
  const {
    history, historyUnread, historyLoaded,
    prefs, prefsLoaded,
    loadHistory, markHistoryRead, clearHistory,
    loadPrefs, savePrefs,
    setPermissionState,
  } = useNotificationStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | null>(null);
  const [savingPref, setSavingPref] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    setPermission(getPermissionState());
    if (!historyLoaded) loadHistory();
    if (!prefsLoaded)   loadPrefs();
    if (historyUnread > 0) markHistoryRead();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    setPermission(result as NotificationPermission | 'unsupported');
    if (result === 'granted') {
      setPermissionState('granted');
      initFCM((payload) => {
        useNotificationStore.getState().addNotification({
          id: Date.now().toString(),
          title: payload.title,
          message: payload.message,
          type: 'info',
          category: payload.category,
          actionUrl: payload.actionUrl,
          sentAt: new Date().toISOString(),
        });
      });
    }
  };

  const handleToggle = async (key: keyof NonNullable<typeof prefs>, value: boolean) => {
    setSavingPref(key);
    await savePrefs({ [key]: value });
    setSavingPref(null);
  };

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="max-w-2xl mx-auto pb-10">

        {/* Header */}
        <div className="text-center pt-4 pb-6">
          <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
          <p className="text-xs text-dark-muted mt-1">Arena alerts, rewards & tactical intel</p>
        </div>

        <PermissionBanner permission={permission} onEnable={handleEnableNotifications} />

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['history', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all"
              style={activeTab === tab
                ? { background: 'rgba(99,102,241,0.25)', color: '#c7d2fe', boxShadow: '0 0 12px rgba(99,102,241,0.2)' }
                : { color: 'rgba(255,255,255,0.35)' }}>
              {tab === 'history' ? `📋 History ${historyUnread > 0 ? `(${historyUnread})` : ''}` : '⚙ Settings'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── History Tab ── */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {history.length > 0 && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[10px] text-dark-muted uppercase tracking-widest font-bold">{history.length} notifications</p>
                  <button onClick={clearHistory}
                    className="text-[10px] text-dark-muted hover:text-red-400 transition-colors font-semibold">
                    Clear all
                  </button>
                </div>
              )}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {!historyLoaded ? (
                  <div className="py-12 text-center text-xs text-dark-muted animate-pulse">Loading…</div>
                ) : history.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-4xl mb-3">🔕</p>
                    <p className="text-sm font-semibold text-dark-muted">No notifications yet</p>
                    <p className="text-xs text-dark-muted/60 mt-1">Arena events will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {history.map((n) => <NotificationItem key={n._id} n={n} />)}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-2xl overflow-hidden divide-y divide-white/5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {!prefsLoaded ? (
                  <div className="py-12 text-center text-xs text-dark-muted animate-pulse">Loading preferences…</div>
                ) : (
                  CATEGORIES.map((cat) => {
                    const enabled = prefs ? prefs[cat.key] : true;
                    const saving  = savingPref === cat.key;
                    return (
                      <div key={cat.key} className="flex items-center gap-4 px-5 py-4">
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{
                            background: `${cat.color}18`,
                            border: `1px solid ${cat.color}30`,
                          }}
                        >
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{cat.label}</p>
                          <p className="text-[11px] text-dark-muted mt-0.5">{cat.desc}</p>
                        </div>
                        {saving ? (
                          <span className="text-xs text-dark-muted animate-pulse">saving…</span>
                        ) : (
                          <ToggleSwitch
                            on={enabled ?? true}
                            onChange={(v) => handleToggle(cat.key, v)}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <p className="text-[10px] text-dark-muted/50 text-center mt-4">
                Max 2–3 notifications per day · Strategic alerts only · No spam
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
