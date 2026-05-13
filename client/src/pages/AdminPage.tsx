import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { admin } from '../services/api';
import { on } from '../services/socket';
import { Avatar } from '../components/ui/Avatar';

type Section = 'overview' | 'rooms' | 'users' | 'leaderboard' | 'features' | 'gameconfig';

// ── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'rgba(12,14,18,0.95)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
};

function StatCard({ icon, label, value, color = '#00ff88' }: {
  icon: string; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={cardStyle}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs text-dark-muted">{label}</p>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl" style={cardStyle}>
      <div>
        <p className="font-semibold text-dark-text text-sm">{label}</p>
        <p className="text-xs text-dark-muted mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
          value ? 'bg-neon-green' : 'bg-dark-border'
        )}
      >
        <motion.span
          layout
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
          animate={{ x: value ? 26 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

function NumberInput({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl" style={cardStyle}>
      <span className="text-sm text-dark-text">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80"
        >−</button>
        <span className="w-8 text-center font-bold text-neon-green text-sm">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-lg bg-dark-border text-dark-text font-bold text-sm flex items-center justify-center hover:bg-dark-border/80"
        >+</button>
      </div>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function OverviewSection() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    admin.getStats().then(r => setStats(r.data)).catch(console.error);
    const t = setInterval(() => {
      admin.getStats().then(r => setStats(r.data)).catch(console.error);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return <div className="text-dark-muted text-sm animate-pulse">Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Platform Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} />
        <StatCard icon="🟢" label="Online Now" value={stats.onlineCount} color="#00ff88" />
        <StatCard icon="🎮" label="Live Games" value={stats.liveGames} color="#00d4ff" />
        <StatCard icon="🏠" label="Active Rooms" value={stats.activeRooms} color="#a855f7" />
        <StatCard icon="🏆" label="Total Games" value={stats.totalGames} color="#fbbf24" />
      </div>
      <div className="rounded-xl p-4 text-sm text-dark-muted" style={cardStyle}>
        Auto-refreshes every 10 seconds. Changes made here are applied instantly.
      </div>
    </div>
  );
}

function RoomsSection() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionRoom, setActionRoom] = useState<string | null>(null);

  const fetchRooms = useCallback(() => {
    admin.getRooms().then(r => { setRooms(r.data.rooms); setLoading(false); }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 5000);
    return () => clearInterval(t);
  }, [fetchRooms]);

  const endRoom = async (code: string) => {
    if (!confirm(`End room ${code}? All players will be disconnected.`)) return;
    setActionRoom(code);
    await admin.endRoom(code).catch(console.error);
    fetchRooms();
    setActionRoom(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Live Rooms</h2>
        <button onClick={fetchRooms} className="text-xs text-dark-muted hover:text-neon-green px-2 py-1 rounded">↺ Refresh</button>
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-dark-muted" style={cardStyle}>
          <p className="text-3xl mb-2">🏠</p>
          <p className="text-sm">No active rooms</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map(room => (
            <motion.div
              key={room.code}
              layout
              className="p-4 rounded-xl"
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-dark-text">{room.name || room.code}</span>
                    <span className={clsx(
                      'text-[10px] font-black px-2 py-0.5 rounded-full',
                      room.status === 'playing'
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-yellow-500/20 text-yellow-400'
                    )}>
                      {room.status === 'playing' ? '● LIVE' : '⏳ WAITING'}
                    </span>
                  </div>
                  <p className="text-xs text-dark-muted mt-0.5">
                    {room.code} · {room.playerCount}/{room.maxPlayers} players
                    {room.spectatorCount > 0 && ` · ${room.spectatorCount} watching`}
                    {room.status === 'playing' && ` · Round ${room.roundNumber}/${room.roundCount}`}
                  </p>
                </div>
                <button
                  onClick={() => endRoom(room.code)}
                  disabled={actionRoom === room.code}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40"
                  style={{ background: 'rgba(255,59,92,0.15)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
                >
                  {actionRoom === room.code ? '…' : 'End'}
                </button>
              </div>

              {/* Player list */}
              <div className="flex flex-wrap gap-1.5">
                {room.players.map((p: any) => (
                  <div key={p.userId} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {p.isBot ? '🤖' : '👤'} {p.username}
                    {!p.isBot && (
                      <button
                        onClick={async () => {
                          await admin.kickFromRoom(room.code, p.userId).catch(console.error);
                          fetchRooms();
                        }}
                        className="ml-1 text-neon-red hover:opacity-80"
                        title="Kick"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    admin.getUsers({ page, search: search || undefined }).then(r => {
      setUsers(r.data.users);
      setTotalPages(r.data.pages);
      setLoading(false);
    }).catch(console.error);
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search]);

  const doAction = async (fn: () => Promise<any>) => {
    await fn().catch(console.error);
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">User Management</h2>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by username…"
        className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-2.5 text-sm text-dark-text placeholder-dark-muted focus:outline-none focus:border-purple-500 transition-colors"
      />

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading users…</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <motion.div
              key={u.id}
              layout
              className="p-3 rounded-xl flex items-center gap-3"
              style={{ ...cardStyle, opacity: u.isBanned ? 0.6 : 1 }}
            >
              <Avatar avatar={u.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-dark-text truncate">{u.username}</span>
                  {u.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-neon-green flex-shrink-0" title="Online" />}
                  {u.isGuest && <span className="text-[10px] text-dark-muted">Guest</span>}
                  {u.isBanned && <span className="text-[10px] text-neon-red font-bold">BANNED</span>}
                </div>
                <p className="text-[11px] text-dark-muted">
                  {u.stats.gamesPlayed}G · {u.stats.gamesWon}W · {u.stats.gamesPlayed > 0 ? Math.round(u.stats.gamesWon / u.stats.gamesPlayed * 100) : 0}%
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {u.isBanned ? (
                  <button
                    onClick={() => doAction(() => admin.unbanUser(u.id))}
                    disabled={actionId === u.id}
                    className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                    style={{ background: 'rgba(0,255,136,0.12)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}
                  >Unban</button>
                ) : (
                  <button
                    onClick={() => { setActionId(u.id); doAction(() => admin.banUser(u.id)).finally(() => setActionId(null)); }}
                    disabled={actionId === u.id}
                    className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                    style={{ background: 'rgba(255,59,92,0.12)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
                  >Ban</button>
                )}
                <button
                  onClick={() => doAction(() => admin.kickUser(u.id))}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                  title="Disconnect user"
                >Kick</button>
                <button
                  onClick={() => { if (confirm('Reset stats for ' + u.username + '?')) doAction(() => admin.resetUserStats(u.id)); }}
                  className="text-[11px] px-2 py-1 rounded-lg font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                >Reset</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">← Prev</button>
          <span className="text-xs text-dark-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs text-dark-muted disabled:opacity-30 hover:text-dark-text">Next →</button>
        </div>
      )}
    </div>
  );
}

function LeaderboardSection() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    admin.getLeaderboard().then(r => { setLeaderboard(r.data.leaderboard); setLoading(false); }).catch(console.error);
  };

  useEffect(() => { fetch(); }, []);

  const resetAll = async () => {
    if (!confirm('Reset ALL user stats? This cannot be undone.')) return;
    await admin.resetLeaderboard().catch(console.error);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <button
          onClick={resetAll}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: 'rgba(255,59,92,0.12)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
        >
          Reset All
        </button>
      </div>

      {loading ? (
        <p className="text-dark-muted text-sm animate-pulse">Loading…</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.slice(0, 50).map(u => (
            <div key={String(u.id)} className="p-3 rounded-xl flex items-center gap-3" style={cardStyle}>
              <span className="w-8 text-center font-bold text-dark-muted text-sm">#{u.rank}</span>
              <Avatar avatar={u.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-dark-text truncate">{u.username}</p>
                <p className="text-[11px] text-dark-muted">{u.gamesPlayed} played · {u.winRate}% win</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-neon-green text-sm">{u.gamesWon}W</p>
                {u.isBanned && <p className="text-[10px] text-neon-red">BANNED</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturesSection({ config, onSave }: { config: any; onSave: (data: any) => void }) {
  const [flags, setFlags] = useState({ ...config.featureFlags });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setFlags({ ...config.featureFlags }); }, [config]);

  const save = async () => {
    setSaving(true);
    await onSave({ featureFlags: flags });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Feature Controls</h2>
      <p className="text-xs text-dark-muted">Changes apply live without requiring a server restart.</p>

      <div className="space-y-3">
        <Toggle
          label="Spectator Mode"
          desc="Allow users to watch live games"
          value={flags.spectatorModeEnabled}
          onChange={v => setFlags((f: any) => ({ ...f, spectatorModeEnabled: v }))}
        />
        <Toggle
          label="Public Rooms"
          desc="Show public rooms in the lobby"
          value={flags.publicRoomsEnabled}
          onChange={v => setFlags((f: any) => ({ ...f, publicRoomsEnabled: v }))}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: 'rgba(147,51,234,0.8)', color: 'white' }}
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

function GameConfigSection({ config, onSave }: { config: any; onSave: (data: any) => void }) {
  const [gc, setGc] = useState({ ...config.gameConfig });
  const [saving, setSaving] = useState(false);

  useEffect(() => { setGc({ ...config.gameConfig }); }, [config]);

  const set = (key: string, v: number) => setGc((g: any) => ({ ...g, [key]: v }));

  const save = async () => {
    setSaving(true);
    await onSave({ gameConfig: gc });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Game Configuration</h2>
      <p className="text-xs text-dark-muted">These limits apply to all new rooms and bot games.</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide">Players</p>
        <NumberInput label="Min Players" value={gc.minPlayers} min={2} max={gc.maxPlayers} onChange={v => set('minPlayers', v)} />
        <NumberInput label="Max Players" value={gc.maxPlayers} min={gc.minPlayers} max={10} onChange={v => set('maxPlayers', v)} />

        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide pt-2">Rounds</p>
        <NumberInput label="Min Rounds" value={gc.minRounds} min={1} max={gc.maxRounds} onChange={v => set('minRounds', v)} />
        <NumberInput label="Max Rounds" value={gc.maxRounds} min={gc.minRounds} max={50} onChange={v => set('maxRounds', v)} />

        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wide pt-2">Limits</p>
        <NumberInput label="Max Spectators" value={gc.maxSpectators} min={0} max={50} onChange={v => set('maxSpectators', v)} />
        <NumberInput label="Max Bots" value={gc.maxBots} min={0} max={9} onChange={v => set('maxBots', v)} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        style={{ background: 'rgba(147,51,234,0.8)', color: 'white' }}
      >
        {saving ? 'Saving…' : 'Save Config'}
      </button>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────

const NAV: { key: Section; icon: string; label: string }[] = [
  { key: 'overview',   icon: '📊', label: 'Overview' },
  { key: 'rooms',      icon: '🎮', label: 'Live Rooms' },
  { key: 'users',      icon: '👤', label: 'Users' },
  { key: 'leaderboard',icon: '🏆', label: 'Leaderboard' },
  { key: 'features',   icon: '⚙️', label: 'Features' },
  { key: 'gameconfig', icon: '🎯', label: 'Game Config' },
];

export function AdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('overview');
  const [config, setConfig] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin/login', { replace: true });
      return;
    }
    admin.getConfig()
      .then(r => setConfig(r.data))
      .catch(() => { localStorage.removeItem('adminToken'); navigate('/admin/login', { replace: true }); });
  }, [navigate]);

  // Live config updates from server
  useEffect(() => {
    try {
      const unsub = on('admin:config_updated', (updated) => {
        setConfig((prev: any) => prev ? { ...prev, ...updated } : updated);
      });
      return unsub;
    } catch { return () => {}; }
  }, []);

  const saveConfig = async (data: any) => {
    try {
      const res = await admin.updateConfig(data);
      setConfig(res.data);
      showToast('success', 'Configuration saved successfully');
    } catch (err: any) {
      showToast('error', err.response?.data?.error ?? 'Failed to save');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login', { replace: true });
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-muted animate-pulse text-sm">Loading admin dashboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex" style={{ background: 'linear-gradient(135deg, #0a0b0e 0%, #0d0e14 100%)' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={clsx(
          'fixed top-0 left-0 h-full z-50 lg:relative lg:translate-x-0 flex flex-col w-56 flex-shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'rgba(10,11,14,0.98)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔐</span>
            <div>
              <p className="font-bold text-white text-sm">Admin Panel</p>
              <p className="text-[10px] text-dark-muted">7 Cards Show</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => { setSection(item.key); setSidebarOpen(false); }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                section === item.key
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-dark-muted hover:text-dark-text hover:bg-white/5'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <button
            onClick={() => navigate('/lobby')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-dark-muted hover:text-dark-text hover:bg-white/5 transition-all"
          >
            🎮 Back to Game
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neon-red/70 hover:text-neon-red hover:bg-neon-red/5 transition-all"
          >
            🔓 Logout
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Mobile header */}
        <div className="flex items-center gap-3 mb-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-dark-surface border border-dark-border"
          >
            <svg className="w-4 h-4 text-dark-text" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-white">
            {NAV.find(n => n.key === section)?.icon} {NAV.find(n => n.key === section)?.label}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {section === 'overview'    && <OverviewSection />}
            {section === 'rooms'       && <RoomsSection />}
            {section === 'users'       && <UsersSection />}
            {section === 'leaderboard' && <LeaderboardSection />}
            {section === 'features'    && <FeaturesSection config={config} onSave={saveConfig} />}
            {section === 'gameconfig'  && <GameConfigSection config={config} onSave={saveConfig} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Toast notification ─────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold"
            style={{
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, rgba(0,200,100,0.18), rgba(0,200,100,0.08))'
                : 'linear-gradient(135deg, rgba(220,50,50,0.18), rgba(220,50,50,0.08))',
              border: toast.type === 'success'
                ? '1px solid rgba(0,200,100,0.45)'
                : '1px solid rgba(220,50,50,0.45)',
              backdropFilter: 'blur(16px)',
              color: toast.type === 'success' ? '#00e676' : '#ff6b6b',
            }}
          >
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
