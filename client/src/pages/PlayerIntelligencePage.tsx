/**
 * Player Intelligence & Audit Dashboard
 * Enterprise-grade admin investigation tool for Arena of Sevens.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { admin } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const POINTS_PER_RUPEE = 100;
const pts = (rupees: number) => Math.round(rupees * POINTS_PER_RUPEE).toLocaleString();
const inr = (rupees: number) => `₹${Math.abs(rupees).toFixed(2)}`;

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
function ago(d: string | Date | null | undefined) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RISK_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626',
};
const RISK_BG: Record<string, string> = {
  low: 'rgba(34,197,94,0.12)', medium: 'rgba(245,158,11,0.12)', high: 'rgba(239,68,68,0.14)', critical: 'rgba(220,38,38,0.18)',
};

const TX_COLOR: Record<string, string> = {
  deposit: '#22c55e', withdrawal: '#ef4444', winning: '#fbbf24',
  entry_fee: '#f59e0b', refund: '#60a5fa', bonus: '#a855f7', other: '#8b949e',
};
const TX_ICON: Record<string, string> = {
  deposit: '⬆️', withdrawal: '⬇️', winning: '🏆', entry_fee: '🎮',
  refund: '↩️', bonus: '🎁', other: '💳',
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: 'rgba(10,12,18,0.97)', border: '1px solid rgba(255,255,255,0.07)', ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <Pill
      label={`${level === 'critical' ? '🚨' : level === 'high' ? '⚠️' : level === 'medium' ? '⚡' : '✅'} ${level.toUpperCase()}`}
      color={RISK_COLOR[level] ?? '#8b949e'}
      bg={RISK_BG[level] ?? 'rgba(139,148,158,0.1)'}
    />
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatBox({ label, value, sub, color = '#fff', icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {icon && <span className="text-base">{icon}</span>}
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[9px] text-gray-600">{sub}</p>}
    </div>
  );
}

function Tabs({ tabs, active, onSelect }: { tabs: { id: string; label: string; icon: string }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap mb-4">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={active === t.id
            ? { background: 'rgba(96,165,250,0.18)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.35)' }
            : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Header
// ─────────────────────────────────────────────────────────────────────────────

function ProfileHeader({ data, onAction }: { data: any; onAction: (action: string) => void }) {
  const { user, progress, risk } = data;
  const AVATARS: Record<string, string> = { avatar_1: '🐯', avatar_2: '🦁', avatar_3: '🐺', avatar_4: '🦊', avatar_5: '🐻', avatar_6: '🦅' };
  const avi = AVATARS[user.avatar] ?? '👤';

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)' }}>
          {avi}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-black text-white">{user.username}</h2>
            {user.isBanned && <Pill label="🚫 BANNED" color="#ef4444" bg="rgba(239,68,68,0.14)" />}
            {user.isGuest && <Pill label="GUEST" color="#f59e0b" bg="rgba(245,158,11,0.1)" />}
            <RiskBadge level={risk.riskLevel} />
          </div>
          <p className="text-xs text-gray-500 mb-1">ID: <span className="text-gray-400 font-mono">{user.id}</span></p>
          {user.email && <p className="text-xs text-gray-500 mb-1">Email: <span className="text-gray-400">{user.email}</span></p>}
          <div className="flex gap-3 flex-wrap mt-2">
            <span className="text-[10px] text-gray-500">Joined: <span className="text-gray-300">{fmtDateShort(user.createdAt)}</span></span>
            <span className="text-[10px] text-gray-500">Last seen: <span className="text-gray-300">{ago(user.lastSeenAt)}</span></span>
            {progress && (
              <span className="text-[10px] text-gray-500">Rank: <span className="text-yellow-400 font-bold">{progress.rank.toUpperCase()}</span></span>
            )}
          </div>
        </div>

        {/* Wallet quick-view */}
        <div className="rounded-xl px-4 py-3 text-center"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-[10px] text-gray-500 mb-0.5">Wallet</p>
          <p className="text-xl font-black text-yellow-400">{pts(user.walletBalance)} pts</p>
          <p className="text-[10px] text-gray-500">{inr(user.walletBalance)}</p>
        </div>
      </div>

      {/* Quick action bar */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {[
          { id: 'watch',       label: '👁 Watch',       color: '#60a5fa' },
          { id: 'flag_fraud',  label: '🚩 Flag Fraud',  color: '#ef4444' },
          { id: 'suspend',     label: '🔒 Suspend',     color: '#f59e0b' },
          { id: 'wallet_adjust', label: '💰 Adjust Wallet', color: '#22c55e' },
          { id: 'clear_flags', label: '✅ Clear Flags',  color: '#8b949e' },
        ].map(btn => (
          <button key={btn.id} onClick={() => onAction(btn.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
            style={{ background: `${btn.color}15`, color: btn.color, border: `1px solid ${btn.color}30` }}>
            {btn.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial Overview
// ─────────────────────────────────────────────────────────────────────────────

function FinancialOverview({ fin }: { fin: any }) {
  const net = fin.netFlow;
  return (
    <div className="space-y-4">
      <SectionTitle icon="💰" title="Financial Overview" sub="All monetary flow since account creation" />

      {/* Summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Total Deposited"   value={`${pts(fin.totalDeposited)} pts`}  sub={inr(fin.totalDeposited)}  color="#22c55e" icon="⬆️" />
        <StatBox label="Total Withdrawn"   value={`${pts(fin.totalWithdrawn)} pts`}  sub={inr(fin.totalWithdrawn)}  color="#ef4444" icon="⬇️" />
        <StatBox label="Total Won"         value={`${pts(fin.totalWon)} pts`}         sub={inr(fin.totalWon)}        color="#fbbf24" icon="🏆" />
        <StatBox label="Entry Fees Paid"   value={`${pts(fin.totalEntryFees)} pts`}   sub={inr(fin.totalEntryFees)}  color="#f59e0b" icon="🎮" />
        <StatBox label="Total Refunded"    value={`${pts(fin.totalRefunded)} pts`}    sub={inr(fin.totalRefunded)}   color="#60a5fa" icon="↩️" />
        <StatBox label="Bonus Earned"      value={`${pts(fin.totalBonus)} pts`}       sub={inr(fin.totalBonus)}      color="#a855f7" icon="🎁" />
      </div>

      {/* Net P&L */}
      <div className="rounded-2xl p-4 text-center"
        style={{ background: net >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${net >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Net Player Flow</p>
        <p className="text-3xl font-black" style={{ color: net >= 0 ? '#22c55e' : '#ef4444' }}>
          {net >= 0 ? '+' : ''}{pts(net)} pts
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{net >= 0 ? 'Profit' : 'Loss'}: {inr(net)}</p>
        <p className="text-[10px] text-gray-600 mt-1">
          {fin.depositCount} deposits · {fin.withdrawalCount} withdrawals · {fin.winCount} wins · {fin.refundCount} refunds
        </p>
      </div>

      {/* Current wallet */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
        <span className="text-xs text-gray-500">Current Wallet Balance</span>
        <div className="text-right">
          <span className="text-base font-black text-yellow-400">{pts(fin.currentWallet)} pts</span>
          <span className="text-xs text-gray-500 ml-2">{inr(fin.currentWallet)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Timeline
// ─────────────────────────────────────────────────────────────────────────────

function TransactionTimeline({ userId }: { userId: string }) {
  const [txs, setTxs]         = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [total, setTotal]     = useState(0);
  const [typeFilter, setType] = useState('all');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.playerIntelTransactions(userId, { page, type: typeFilter, from: from || undefined, to: to || undefined });
      setTxs(r.data.transactions);
      setPages(r.data.pages);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  }, [userId, page, typeFilter, from, to]);

  useEffect(() => { load(); }, [load]);

  const TX_TYPES = ['all', 'deposit', 'withdrawal', 'winning', 'entry_fee', 'refund', 'bonus'];

  return (
    <div>
      <SectionTitle icon="📋" title="Transaction Timeline" sub={`${total} total transactions`} />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }}>
          {TX_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace('_', ' ')}</option>)}
        </select>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }} />
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }} />
        {(from || to || typeFilter !== 'all') && (
          <button onClick={() => { setType('all'); setFrom(''); setTo(''); setPage(1); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            Clear
          </button>
        )}
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {txs.length === 0 && <p className="text-gray-600 text-sm text-center py-8">No transactions found.</p>}
          {txs.map(tx => {
            const color = TX_COLOR[tx.type] ?? TX_COLOR.other;
            const icon  = TX_ICON[tx.type]  ?? TX_ICON.other;
            const sign  = tx.type === 'withdrawal' || tx.type === 'entry_fee' ? '-' : '+';
            return (
              <div key={tx.id} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3 px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color }}>
                        {tx.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-gray-600">{fmtDate(tx.createdAt)}</span>
                      {tx.status !== 'completed' && (
                        <Pill label={tx.status} color="#f59e0b" bg="rgba(245,158,11,0.1)" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">{tx.description || '—'}</p>
                    {tx.metadata?.roomCode && (
                      <p className="text-[10px] text-gray-600">Room: {tx.metadata.roomCode}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black" style={{ color }}>
                      {sign}{tx.amountPts.toLocaleString()} pts
                    </p>
                    <p className="text-[9px] text-gray-600">{sign}{inr(tx.amount)}</p>
                  </div>
                </div>
                {/* Before / After */}
                {(tx.balanceBefore !== undefined || tx.balanceAfter !== undefined) && (
                  <div className="flex justify-between px-4 py-2"
                    style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-600">BEFORE</p>
                      <p className="text-[11px] font-bold text-gray-400">{pts(tx.balanceBefore)} pts</p>
                    </div>
                    <div className="text-gray-700 text-xs self-center">→</div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-600">AFTER</p>
                      <p className="text-[11px] font-bold" style={{ color }}>{pts(tx.balanceAfter)} pts</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
            ← Prev
          </button>
          <span className="text-xs text-gray-500 self-center">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Game History
// ─────────────────────────────────────────────────────────────────────────────

function GameHistory({ userId }: { userId: string }) {
  const [games, setGames]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [total, setTotal]     = useState(0);

  useEffect(() => {
    setLoading(true);
    admin.playerIntelGames(userId, page)
      .then(r => { setGames(r.data.games); setPages(r.data.pages); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [userId, page]);

  const wins  = games.filter(g => g.won).length;
  const losses = games.length - wins;

  return (
    <div>
      <SectionTitle icon="🎮" title="Multiplayer Match History" sub={`${total} total games`} />

      {games.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatBox label="Win Rate" value={`${games.length > 0 ? Math.round((wins/games.length)*100) : 0}%`} color="#22c55e" />
          <StatBox label="Wins (this page)" value={wins} color="#22c55e" />
          <StatBox label="Losses (this page)" value={losses} color="#ef4444" />
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {games.length === 0 && <p className="text-gray-600 text-sm text-center py-8">No games found.</p>}
          {games.map(g => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: g.won ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${g.won ? '#22c55e' : '#ef4444'}40` }}>
                {g.won ? '✓' : '✗'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: g.won ? '#22c55e' : '#ef4444' }}>
                    {g.won ? 'Won' : 'Lost'}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {g.humanCount}H + {g.botCount}B · {g.roundCount} rounds
                  </span>
                  {g.entryFee > 0 && (
                    <Pill label={`₹${g.entryFee}`} color="#fbbf24" bg="rgba(251,191,36,0.08)" />
                  )}
                </div>
                <p className="text-[10px] text-gray-600">{fmtDate(g.startedAt)} · {g.durationMin}m</p>
                <p className="text-[10px] text-gray-600">Room: {g.roomId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{g.myScore} pts</p>
                <p className="text-[10px] text-gray-600">My score</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
            ← Prev
          </button>
          <span className="text-xs text-gray-500 self-center">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.08)' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tournament Analytics
// ─────────────────────────────────────────────────────────────────────────────

function TournamentAnalytics({ userId }: { userId: string }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode]       = useState<'solo' | 'team'>('solo');

  useEffect(() => {
    admin.playerIntelTournaments(userId)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const solo = data.solo;
  const team = data.team;

  return (
    <div>
      <SectionTitle icon="🏆" title="Tournament Analytics" sub="Solo AI Championship + Team Arena" />

      <div className="flex gap-2 mb-4">
        {(['solo', 'team'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={mode === m
              ? { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }
              : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.06)' }}>
            {m === 'solo' ? '🎯 Solo AI' : '👥 Team Arena'}
          </button>
        ))}
      </div>

      {mode === 'solo' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Runs"    value={solo.total}             color="#60a5fa" />
            <StatBox label="Champions"     value={solo.summary.wins}      color="#fbbf24" icon="🏆" />
            <StatBox label="Abandoned"     value={solo.summary.abandoned} color="#8b949e" icon="↩️" />
            <StatBox label="Win Rate"      value={`${solo.summary.winRate}%`} color="#22c55e" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Total Earned"  value={`${solo.summary.totalEarned.toLocaleString()} pts`} color="#22c55e" />
            <StatBox label="Net (earned − fees)" value={`${(solo.summary.totalEarned - solo.summary.totalFees).toLocaleString()} pts`}
              color={(solo.summary.totalEarned - solo.summary.totalFees) >= 0 ? '#22c55e' : '#ef4444'} />
          </div>
          <div className="space-y-2">
            {solo.records.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase" style={{
                      color: r.status === 'won' ? '#fbbf24' : r.status === 'lost' ? '#ef4444' : '#8b949e'
                    }}>{r.status}</span>
                    <Pill label={r.tier} color="#a855f7" bg="rgba(168,85,247,0.1)" />
                    <span className="text-[10px] text-gray-600">Stage {r.stageResults?.length ?? 0}/5</span>
                  </div>
                  <p className="text-[10px] text-gray-600">{fmtDateShort(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold" style={{ color: '#22c55e' }}>+{r.totalPointsEarned.toLocaleString()} pts</p>
                  <p className="text-[10px] text-gray-600">Entry: {r.entryPoints.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Runs"  value={team.total}             color="#60a5fa" />
            <StatBox label="Champions"   value={team.summary.wins}      color="#fbbf24" icon="🏆" />
            <StatBox label="Abandoned"   value={team.summary.abandoned} color="#8b949e" icon="↩️" />
            <StatBox label="Win Rate"    value={`${team.summary.winRate}%`} color="#22c55e" />
          </div>
          <div className="space-y-2">
            {team.records.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase" style={{
                      color: (r.status === 'completed' && r.stageResults?.[4]?.teamWon) ? '#fbbf24' : r.status === 'abandoned' ? '#8b949e' : '#ef4444'
                    }}>{r.status === 'completed' && r.stageResults?.[4]?.teamWon ? 'champion' : r.status}</span>
                    <Pill label={r.tier} color="#a855f7" bg="rgba(168,85,247,0.1)" />
                    {r.isHost && <Pill label="HOST" color="#60a5fa" bg="rgba(96,165,250,0.1)" />}
                  </div>
                  <p className="text-[10px] text-gray-600">
                    with {r.members.filter((m: any) => !m.isBot).map((m: any) => m.username).join(', ')}
                    {' · '}{fmtDateShort(r.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold" style={{ color: '#22c55e' }}>+{r.totalPointsEarned.toLocaleString()} pts</p>
                  <p className="text-[10px] text-gray-600">Stage {r.stageResults?.length ?? 0}/5</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk & Fraud Panel
// ─────────────────────────────────────────────────────────────────────────────

function RiskPanel({ userId }: { userId: string }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    admin.playerIntelRisk(userId).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const { computed, stored } = data;
  const score = computed.riskScore;
  const level = computed.riskLevel;

  const FLAG_LABELS: Record<string, { label: string; desc: string }> = {
    frequent_refunds:         { label: 'Frequent Refunds',       desc: '≥5 refund transactions detected' },
    high_refund_ratio:        { label: 'High Refund Ratio',      desc: 'Refunds exceed 50% of deposits' },
    high_abandon_rate:        { label: 'High Abandon Rate',      desc: '>50% of tournaments abandoned' },
    tie_farming:              { label: 'Tie Farming',            desc: '≥4 tie-split winnings detected' },
    abnormal_win_rate:        { label: 'Abnormal Win Rate',      desc: 'Unusually high average winnings' },
    rapid_deposit_withdraw:   { label: 'Rapid Deposit-Withdraw', desc: 'Withdraw within 10min of deposit' },
    bot_farming:              { label: 'Bot Farming',            desc: '>70% of games are vs bots only' },
  };

  return (
    <div>
      <SectionTitle icon="🛡️" title="Risk & Fraud Intelligence" sub="Automated behavioral analysis" />

      {/* Score gauge */}
      <div className="rounded-2xl p-5 mb-4 text-center"
        style={{ background: RISK_BG[level], border: `1px solid ${RISK_COLOR[level]}30` }}>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Risk Score</p>
        <p className="text-5xl font-black mb-2" style={{ color: RISK_COLOR[level] }}>{score}</p>
        <RiskBadge level={level} />
        {/* Score bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden mx-8" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${score}%`, background: RISK_COLOR[level] }} />
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-1 mx-8">
          <span>0 — Low</span><span>45 — Medium</span><span>70 — High</span><span>100 — Critical</span>
        </div>
      </div>

      {/* Admin override status */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {stored.isWatched && <Pill label="👁 WATCHED" color="#60a5fa" bg="rgba(96,165,250,0.12)" />}
        {stored.isSuspended && <Pill label="🔒 SUSPENDED" color="#ef4444" bg="rgba(239,68,68,0.12)" />}
      </div>

      {/* Detected flags */}
      {computed.flags.length === 0 ? (
        <div className="rounded-xl px-4 py-4 text-center" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <p className="text-2xl mb-1">✅</p>
          <p className="text-xs text-green-400 font-bold">No suspicious behavior detected</p>
          <p className="text-[10px] text-gray-600 mt-0.5">All behavioral signals within normal range</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Detected Signals ({computed.flags.length})</p>
          {computed.flags.map((flag: string) => {
            const meta = FLAG_LABELS[flag] ?? { label: flag, desc: 'Behavioral anomaly' };
            return (
              <div key={flag} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span className="text-base flex-shrink-0">🚩</span>
                <div>
                  <p className="text-xs font-bold text-red-400">{meta.label}</p>
                  <p className="text-[10px] text-gray-500">{meta.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Notes Panel
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, { color: string; bg: string; icon: string }> = {
  info:          { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  icon: 'ℹ️' },
  warning:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: '⚠️' },
  fraud_flag:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '🚩' },
  support:       { color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: '💬' },
  investigation: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', icon: '🔍' },
  cleared:       { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '✅' },
};

function NotesPanel({ userId }: { userId: string }) {
  const [notes, setNotes]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('info');
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    admin.playerIntelNotes(userId).then(r => setNotes(r.data.notes)).finally(() => setLoading(false));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await admin.playerIntelAddNote(userId, content, noteType);
      setContent('');
      load();
    } finally { setSaving(false); }
  };

  const deleteNote = async (noteId: string) => {
    await admin.playerIntelDeleteNote(userId, noteId);
    setNotes(n => n.filter(x => x._id !== noteId));
  };

  return (
    <div>
      <SectionTitle icon="📝" title="Admin Notes" sub={`${notes.length} notes on file`} />

      {/* Add note */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-xs text-gray-500 mb-2 font-bold">Add Internal Note</p>
        <div className="flex gap-2 mb-2">
          {Object.keys(NOTE_COLORS).map(t => (
            <button key={t} onClick={() => setNoteType(t)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={noteType === t
                ? { background: NOTE_COLORS[t].bg, color: NOTE_COLORS[t].color, border: `1px solid ${NOTE_COLORS[t].color}40` }
                : { background: 'rgba(255,255,255,0.03)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.05)' }}>
              {NOTE_COLORS[t].icon} {t}
            </button>
          ))}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="Write internal note, investigation detail, or flag reason..."
          className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
          rows={3}
          style={{ background: 'rgba(255,255,255,0.05)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }} />
        <button onClick={addNote} disabled={saving || !content.trim()}
          className="mt-2 px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
          style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
          {saving ? 'Saving...' : '+ Add Note'}
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {notes.length === 0 && <p className="text-gray-600 text-sm text-center py-6">No notes yet.</p>}
          {notes.map(n => {
            const meta = NOTE_COLORS[n.type] ?? NOTE_COLORS.info;
            return (
              <div key={n._id} className="rounded-xl px-4 py-3"
                style={{ background: meta.bg, border: `1px solid ${meta.color}25` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{meta.icon}</span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: meta.color }}>{n.type}</span>
                      <span className="text-[10px] text-gray-600">by {n.adminName} · {fmtDate(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{n.content}</p>
                  </div>
                  <button onClick={() => deleteNote(n._id)}
                    className="text-gray-600 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Modal
// ─────────────────────────────────────────────────────────────────────────────

function ActionModal({ action, onClose, onConfirm }: { action: string; onClose: () => void; onConfirm: (reason: string, amount?: number) => void }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const ACTION_META: Record<string, { label: string; color: string; needsAmount: boolean }> = {
    watch:         { label: 'Mark as Watched',     color: '#60a5fa', needsAmount: false },
    unwatch:       { label: 'Remove Watch',         color: '#8b949e', needsAmount: false },
    flag_fraud:    { label: 'Apply Fraud Flag',     color: '#ef4444', needsAmount: false },
    clear_flags:   { label: 'Clear All Flags',      color: '#22c55e', needsAmount: false },
    suspend:       { label: 'Suspend Account',      color: '#ef4444', needsAmount: false },
    unsuspend:     { label: 'Unsuspend Account',    color: '#22c55e', needsAmount: false },
    wallet_adjust: { label: 'Adjust Wallet',        color: '#fbbf24', needsAmount: true  },
  };

  const meta = ACTION_META[action] ?? { label: action, color: '#60a5fa', needsAmount: false };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="font-black text-white text-base">{meta.label}</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">This action will be logged in the audit trail.</p>
        </div>
        <div className="p-5 space-y-3">
          {meta.needsAmount && (
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Amount (₹, negative to deduct)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 10 or -5"
                className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
          )}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Reason (required)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Explain the reason for this action..."
              className="w-full mt-1 rounded-xl px-3 py-2 text-sm resize-none outline-none"
              rows={3}
              style={{ background: 'rgba(255,255,255,0.06)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#8b949e', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={() => onConfirm(reason, amount ? parseFloat(amount) : undefined)}
              disabled={!reason.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
              style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
              Confirm
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress & XP Panel
// ─────────────────────────────────────────────────────────────────────────────

function ProgressPanel({ progress, activity }: { progress: any; activity: any }) {
  if (!progress) return (
    <div className="text-center py-8 text-gray-600 text-sm">No progression data found.</div>
  );
  return (
    <div>
      <SectionTitle icon="📈" title="Player Progression" sub="XP, rank, streaks, achievements" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <StatBox label="XP"         value={progress.xp.toLocaleString()} color="#a855f7" icon="⭐" />
        <StatBox label="Level"      value={progress.level}               color="#fbbf24" />
        <StatBox label="Rank"       value={progress.rank.toUpperCase()}  color="#60a5fa" />
        <StatBox label="Win Streak" value={progress.winStreak}           color="#22c55e" icon="🔥" />
        <StatBox label="Max Streak" value={progress.maxWinStreak}        color="#22c55e" />
        <StatBox label="Login Streak" value={progress.loginStreak}       color="#f59e0b" icon="📅" />
        <StatBox label="Total Wins" value={progress.totalWins}           color="#22c55e" />
        <StatBox label="Total Games" value={progress.totalGames}         color="#60a5fa" />
        <StatBox label="Achievements" value={progress.achievementCount}  color="#a855f7" icon="🏅" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Multiplayer" value={activity.multiplayerGames}   color="#60a5fa" icon="🎮" />
        <StatBox label="Solo Tours"  value={activity.soloTournaments}    color="#fbbf24" icon="🏆" />
        <StatBox label="Team Tours"  value={activity.teamTournaments}    color="#a855f7" icon="👥" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Requests Panel
// ─────────────────────────────────────────────────────────────────────────────

function WalletRequestsPanel({ userId }: { userId: string }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.playerIntelWalletRequests(userId).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const STATUS_COLOR: Record<string, string> = { approved: '#22c55e', rejected: '#ef4444', pending: '#f59e0b' };

  return (
    <div>
      <SectionTitle icon="🏦" title="Deposit & Withdrawal History" sub="All wallet funding requests" />
      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Deposits ({data.deposits.length})</p>
          <div className="space-y-2">
            {data.deposits.length === 0 && <p className="text-gray-600 text-xs text-center py-4">No deposits.</p>}
            {data.deposits.map((d: any) => (
              <div key={d._id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)' }}>
                <span className="text-base">⬆️</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-green-400">{inr(d.amount)}</p>
                  <p className="text-[10px] text-gray-600">{fmtDate(d.createdAt)}</p>
                  {d.utrNumber && <p className="text-[10px] text-gray-600">UTR: {d.utrNumber}</p>}
                </div>
                <span className="text-[10px] font-bold" style={{ color: STATUS_COLOR[d.status] ?? '#8b949e' }}>
                  {(d.status ?? '').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Withdrawals ({data.withdrawals.length})</p>
          <div className="space-y-2">
            {data.withdrawals.length === 0 && <p className="text-gray-600 text-xs text-center py-4">No withdrawals.</p>}
            {data.withdrawals.map((w: any) => (
              <div key={w._id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <span className="text-base">⬇️</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400">{inr(w.amount)}</p>
                  <p className="text-[10px] text-gray-600">{fmtDate(w.createdAt)}</p>
                  {w.upiId && <p className="text-[10px] text-gray-600">UPI: {w.upiId}</p>}
                </div>
                <span className="text-[10px] font-bold" style={{ color: STATUS_COLOR[w.status] ?? '#8b949e' }}>
                  {(w.status ?? '').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Detail View (all tabs)
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER_TABS = [
  { id: 'overview',      label: 'Overview',      icon: '👤' },
  { id: 'financial',     label: 'Financial',     icon: '💰' },
  { id: 'transactions',  label: 'Transactions',  icon: '📋' },
  { id: 'games',         label: 'Games',         icon: '🎮' },
  { id: 'tournaments',   label: 'Tournaments',   icon: '🏆' },
  { id: 'wallet_req',    label: 'Deposits/WD',   icon: '🏦' },
  { id: 'risk',          label: 'Risk',          icon: '🛡️' },
  { id: 'notes',         label: 'Notes',         icon: '📝' },
];

function PlayerDetailView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('overview');
  const [pendingAction, setAction] = useState<string | null>(null);
  const [toast, setToast]         = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    admin.playerIntelProfile(userId).then(r => setProfile(r.data)).finally(() => setLoading(false));
  }, [userId]);

  const handleAction = useCallback(async (action: string) => {
    setAction(action);
  }, []);

  const confirmAction = useCallback(async (reason: string, amount?: number) => {
    if (!pendingAction) return;
    try {
      const r = await admin.playerIntelAction(userId, pendingAction, reason, amount);
      setToast(r.data.message ?? 'Done');
      setAction(null);
      // Refresh profile
      admin.playerIntelProfile(userId).then(r => setProfile(r.data));
    } catch {
      setToast('Action failed. Please try again.');
      setAction(null);
    }
  }, [pendingAction, userId]);

  if (loading) return (
    <div className="py-20"><Spinner /></div>
  );
  if (!profile) return (
    <div className="text-center py-20 text-gray-500">Player not found.</div>
  );

  return (
    <div>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            onAnimationComplete={() => setTimeout(() => setToast(null), 2500)}
            className="fixed top-4 right-4 z-[300] rounded-xl px-4 py-2.5 text-sm font-bold shadow-xl"
            style={{ background: '#22c55e', color: '#fff' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {pendingAction && (
        <ActionModal
          action={pendingAction}
          onClose={() => setAction(null)}
          onConfirm={confirmAction}
        />
      )}

      {/* Back button */}
      <button onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-300">
        ← Back to Search
      </button>

      {/* Profile header */}
      <ProfileHeader data={profile} onAction={handleAction} />

      {/* Tabs */}
      <Tabs tabs={PLAYER_TABS} active={tab} onSelect={setTab} />

      {/* Tab content */}
      <Card className="p-5">
        {tab === 'overview'     && <ProgressPanel progress={profile.progress} activity={profile.activity} />}
        {tab === 'financial'    && <FinancialOverview fin={profile.financial} />}
        {tab === 'transactions' && <TransactionTimeline userId={userId} />}
        {tab === 'games'        && <GameHistory userId={userId} />}
        {tab === 'tournaments'  && <TournamentAnalytics userId={userId} />}
        {tab === 'wallet_req'   && <WalletRequestsPanel userId={userId} />}
        {tab === 'risk'         && <RiskPanel userId={userId} />}
        {tab === 'notes'        && <NotesPanel userId={userId} />}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search View
// ─────────────────────────────────────────────────────────────────────────────

function SearchView({ onSelect }: { onSelect: (userId: string) => void }) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent]       = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pi_recent') ?? '[]'); } catch { return []; }
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    admin.playerIntelSearch(q)
      .then(r => setResults(r.data.users))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
  }, [query, search]);

  const selectUser = (id: string) => {
    const next = [id, ...recent.filter(r => r !== id)].slice(0, 8);
    setRecent(next);
    localStorage.setItem('pi_recent', JSON.stringify(next));
    onSelect(id);
  };

  const RISK_COLOR_MINI: Record<string, string> = {
    low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626',
  };

  return (
    <div>
      {/* Hero header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🔍</div>
        <h1 className="text-2xl font-black text-white mb-1">Player Intelligence</h1>
        <p className="text-sm text-gray-500">Search any player · Full audit · Fraud detection · Financial investigation</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-base">🔍</div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by username or Player ID..."
          className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.12)', fontSize: '14px' }}
          autoFocus
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          {results.map((u, i) => (
            <button key={u.id} onClick={() => selectUser(u.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                👤
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{u.username}</span>
                  {u.isBanned && <Pill label="BANNED" color="#ef4444" bg="rgba(239,68,68,0.12)" />}
                  {u.isGuest && <Pill label="GUEST" color="#f59e0b" bg="rgba(245,158,11,0.1)" />}
                  <RiskBadge level={u.riskLevel} />
                </div>
                <p className="text-[10px] text-gray-600 font-mono">{u.id}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-yellow-400">{u.walletPoints.toLocaleString()} pts</p>
                <p className="text-[10px] text-gray-600">{ago(u.lastSeenAt)}</p>
              </div>
            </button>
          ))}
        </Card>
      )}

      {/* Quick stats / recent */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-xl mb-0.5">🚩</p>
          <p className="text-[10px] text-gray-500">Fraud Detection</p>
          <p className="text-xs text-red-400 font-bold">7 signals</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
          <p className="text-xl mb-0.5">💰</p>
          <p className="text-[10px] text-gray-500">Wallet Audit</p>
          <p className="text-xs text-blue-400 font-bold">Before/After</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <p className="text-xl mb-0.5">📋</p>
          <p className="text-[10px] text-gray-500">Full Timeline</p>
          <p className="text-xs text-green-400 font-bold">All Activity</p>
        </div>
      </div>

      {/* Instructions */}
      {!query && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-gray-500 font-bold mb-3 uppercase tracking-wider">What you can investigate</p>
          <div className="space-y-2">
            {[
              { icon: '👤', text: 'Full player profile — identity, rank, account status' },
              { icon: '💰', text: 'Complete wallet audit — every rupee in and out with before/after balance' },
              { icon: '📋', text: 'Transaction timeline — filterable by type and date range' },
              { icon: '🎮', text: 'All multiplayer games — win/loss, opponents, duration, wager' },
              { icon: '🏆', text: 'Tournament history — solo AI + team arena + earnings per stage' },
              { icon: '🛡️', text: 'Risk & fraud scoring — 7 automated behavioral signals' },
              { icon: '📝', text: 'Admin notes — internal investigation log with audit trail' },
              { icon: '⚡', text: 'Quick actions — watch, flag, suspend, adjust wallet' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm">{item.icon}</span>
                <p className="text-[11px] text-gray-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Export
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerIntelligencePage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AnimatePresence mode="wait">
        {!selectedUserId ? (
          <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <SearchView onSelect={setSelectedUserId} />
          </motion.div>
        ) : (
          <motion.div key={selectedUserId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <PlayerDetailView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
