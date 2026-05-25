import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../../services/api';
import { notify } from '../../services/notify';

const DAILY_LIMIT = 10;
const SPIN_COST   = 100;
const HIST_KEY    = 'pts_spin_history_v2';

const SEGMENTS = [
  { label: 'Try Again', icon: '😔', color: '#111827', stroke: '#374151', textColor: '#6b7280',  type: 'none'   },
  { label: '+50 pts',   icon: '⭐', color: '#1e1b4b', stroke: '#6366f1', textColor: '#a5b4fc',  type: 'points' },
  { label: '₹2',        icon: '💎', color: '#2d1b69', stroke: '#8b5cf6', textColor: '#c4b5fd',  type: 'cash'   },
  { label: '+100 pts',  icon: '💫', color: '#0c3547', stroke: '#0891b2', textColor: '#67e8f9',  type: 'points' },
  { label: '₹5',        icon: '✨', color: '#052e16', stroke: '#22c55e', textColor: '#86efac',  type: 'cash'   },
  { label: '₹10',       icon: '🎯', color: '#431407', stroke: '#f97316', textColor: '#fdba74',  type: 'cash'   },
  { label: '+300 pts',  icon: '🌟', color: '#3b1a03', stroke: '#f59e0b', textColor: '#fde68a',  type: 'points' },
  { label: '₹20',       icon: '🏆', color: '#14532d', stroke: '#eab308', textColor: '#fde047',  type: 'cash'   },
];

const SEG_DEG = 360 / SEGMENTS.length;

interface HistoryEntry {
  ts: number;
  date: string;
  icon: string;
  label: string;
  amount: number;
  type: string;
}

function loadAllHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]'); } catch { return []; }
}
function saveAllHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-200))); } catch {}
}
function appendHistory(result: { icon: string; label: string; amount: number; type: string }): HistoryEntry[] {
  const all = loadAllHistory();
  all.push({ ts: Date.now(), date: new Date().toISOString().slice(0, 10), ...result });
  saveAllHistory(all);
  return all;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

const STYLES = `
  @keyframes ptsBorderRotate {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes ptsCardGlow {
    0%,100% { box-shadow: 0 0 30px rgba(34,197,94,0.3), 0 0 60px rgba(34,197,94,0.12); }
    50%      { box-shadow: 0 0 40px rgba(16,185,129,0.45), 0 0 80px rgba(16,185,129,0.18); }
  }
  @keyframes ptsBtnShimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(220%) skewX(-15deg); }
  }
  @keyframes ptsBtnPulse {
    0%,100% { box-shadow: 0 0 20px rgba(16,185,129,0.5); }
    50%      { box-shadow: 0 0 35px rgba(34,197,94,0.7), 0 0 50px rgba(16,185,129,0.3); }
  }
  .pts-border-wrap {
    background: linear-gradient(135deg,#22c55e,#10b981,#eab308,#f59e0b,#22c55e);
    background-size: 400% 400%;
    animation: ptsBorderRotate 5s ease infinite;
    padding: 2px;
    border-radius: 28px;
  }
  .pts-card-inner {
    border-radius: 26px;
    background: linear-gradient(160deg, #071a0f 0%, #0b2416 50%, #051508 100%);
    animation: ptsCardGlow 3s ease-in-out infinite;
  }
  .pts-btn-active {
    position: relative;
    overflow: hidden;
    animation: ptsBtnPulse 2s ease-in-out infinite;
  }
  .pts-btn-active::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 40%; height: 100%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
    animation: ptsBtnShimmer 2.5s ease-in-out infinite;
  }
`;

function PointsWheel({ rotation }: { rotation: number }) {
  const size = 272;
  const cx   = size / 2;
  const r    = size / 2 - 8;
  return (
    <div style={{ position: 'relative', width: size + 16, height: size + 28 }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: size + 40, height: size + 40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, filter: 'drop-shadow(0 0 10px #22c55e) drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
        <svg width="28" height="34" viewBox="0 0 28 34">
          <polygon points="14,32 1,6 27,6" fill="#22c55e" />
          <polygon points="14,28 5,10 23,10" fill="#86efac" opacity="0.5" />
        </svg>
      </div>
      <motion.svg width={size} height={size} style={{ transformOrigin: 'center', display: 'block', marginTop: 14 }}
        animate={{ rotate: rotation }} transition={{ duration: 4, ease: [0.17, 0.67, 0.35, 0.99] }}>
        <defs>
          <radialGradient id="ptsHubGold" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#d1fae5" />
            <stop offset="35%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
          </radialGradient>
          <radialGradient id="ptsHubInner" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#052e16" />
            <stop offset="100%" stopColor="#020d06" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cx} r={r + 4} fill="#071a0f" />
        {SEGMENTS.map((seg, i) => {
          const startAngle = (i * SEG_DEG - 90) * (Math.PI / 180);
          const endAngle   = ((i + 1) * SEG_DEG - 90) * (Math.PI / 180);
          const x1 = cx + r * Math.cos(startAngle), y1 = cx + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle),   y2 = cx + r * Math.sin(endAngle);
          const midAngle = ((i + 0.5) * SEG_DEG - 90) * (Math.PI / 180);
          const textR = r * 0.62;
          const tx = cx + textR * Math.cos(midAngle);
          const ty = cx + textR * Math.sin(midAngle);
          const textRotate = (i + 0.5) * SEG_DEG;
          const path = `M ${cx} ${cx} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
          return (
            <g key={i}>
              <path d={path} fill={seg.color} />
              {seg.label !== 'Try Again' && <path d={path} fill={`${seg.stroke}18`} />}
              <path d={path} fill="none" stroke={seg.stroke} strokeWidth="1.5" opacity="0.7" />
              <text x={tx} y={ty - 4} textAnchor="middle" dominantBaseline="middle" fill={seg.textColor} fontSize="14" fontWeight="bold"
                transform={`rotate(${textRotate}, ${tx}, ${ty - 4})`} style={{ filter: `drop-shadow(0 0 4px ${seg.stroke})` }}>{seg.icon}</text>
              <text x={tx} y={ty + 12} textAnchor="middle" dominantBaseline="middle" fill={seg.textColor} fontSize="8.5" fontWeight="700"
                transform={`rotate(${textRotate}, ${tx}, ${ty + 12})`}>{seg.label}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cx} r={r + 2} fill="none" stroke="#86efac" strokeWidth="3" opacity="0.8" />
        <circle cx={cx} cy={cx} r={r + 6} fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.4" />
        {Array.from({ length: 28 }).map((_, i) => {
          const angle = (i * (360 / 28) - 90) * (Math.PI / 180);
          const isMajor = i % 4 === 0;
          const r1 = r + 1, r2 = r - 3;
          return <line key={i} x1={cx + r1 * Math.cos(angle)} y1={cx + r1 * Math.sin(angle)} x2={cx + r2 * Math.cos(angle)} y2={cx + r2 * Math.sin(angle)} stroke={isMajor ? '#86efac' : '#22c55e'} strokeWidth={isMajor ? 2 : 1} opacity={isMajor ? 0.9 : 0.4} />;
        })}
        <circle cx={cx} cy={cx} r={28} fill="url(#ptsHubGold)" />
        <circle cx={cx} cy={cx} r={24} fill="url(#ptsHubInner)" />
        <circle cx={cx} cy={cx} r={28} fill="none" stroke="#86efac" strokeWidth="1.5" opacity="0.8" />
        <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fontSize="18">⭐</text>
      </motion.svg>
    </div>
  );
}

type SpinResult = { label: string; icon: string; amount: number; type: string; color: string };

interface Props {
  onClose: () => void;
  onBalanceUpdate: (balance: number, aiPoints: number) => void;
}

type ActiveTab = 'spin' | 'history';

export function PointsSpinModal({ onClose, onBalanceUpdate }: Props) {
  const [spinning,    setSpinning]    = useState(false);
  const [rotation,    setRotation]    = useState(0);
  const [spinsLeft,   setSpinsLeft]   = useState<number | null>(null);
  const [aiPoints,    setAiPoints]    = useState<number | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SpinResult[]>([]);
  const [lastResult,  setLastResult]  = useState<SpinResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [activeTab,   setActiveTab]   = useState<ActiveTab>('spin');
  const [allHistory,  setAllHistory]  = useState<HistoryEntry[]>([]);
  const totalRotation = useRef(0);

  useEffect(() => {
    // Load local history first (instant), then merge with server history
    const local = loadAllHistory();
    setAllHistory(local);

    Promise.all([
      walletApi.pointsSpinStatus(),
      walletApi.spinHistory(),
    ]).then(([statusRes, histRes]) => {
      setSpinsLeft(statusRes.data.spinsLeft);
      setAiPoints(statusRes.data.aiPoints);
      if (statusRes.data.spinsLeft === 0 && statusRes.data.aiPoints < SPIN_COST) setShowSummary(true);

      // Merge server logs into history (server is source of truth for points spins)
      const serverPointsLogs = (histRes.data.logs ?? [])
        .filter((l: any) => l.spinType === 'points')
        .map((l: any): HistoryEntry => ({
          ts: new Date(l.createdAt).getTime(),
          date: new Date(l.createdAt).toISOString().slice(0, 10),
          icon: l.prizeIcon || '⭐',
          label: l.prizeLabel || 'Spin',
          amount: l.prizeAmount ?? 0,
          type: l.prizeType === 'none' ? 'none' : l.prizeType,
        }));

      if (serverPointsLogs.length > 0) {
        // Server history is authoritative — replace local if server has data
        const merged = serverPointsLogs.sort((a: HistoryEntry, b: HistoryEntry) => b.ts - a.ts);
        setAllHistory(merged);
        saveAllHistory(merged);
      }
    }).catch(() => {});
  }, []);

  const doSpin = async () => {
    if (spinning || (spinsLeft !== null && spinsLeft <= 0)) return;
    setSpinning(true);
    setLastResult(null);
    try {
      const { data } = await walletApi.pointsSpin();
      const prizeIdx = SEGMENTS.findIndex(s => s.label === data.prize.label);
      const idx = prizeIdx >= 0 ? prizeIdx : 0;
      const targetDeg = 360 - (idx * SEG_DEG + SEG_DEG / 2);
      const extra = 360 * (5 + Math.floor(Math.random() * 3));
      totalRotation.current += extra + targetDeg - (totalRotation.current % 360);
      setRotation(totalRotation.current);
      onBalanceUpdate(data.balance, data.aiPoints);

      setTimeout(() => {
        const result: SpinResult = data.prize;
        setLastResult(result);
        setSpinsLeft(data.spinsLeft);
        setAiPoints(data.aiPoints);
        const newSession = [...sessionHistory, result];
        setSessionHistory(newSession);
        // Persist to localStorage
        const updatedAll = appendHistory(result);
        setAllHistory(updatedAll);
        setSpinning(false);

        if (data.spinsLeft === 0) {
          // Compute totals from today's full history
          const today = todayStr();
          const todayEntries = updatedAll.filter(e => e.date === today);
          const totalCash    = todayEntries.filter(e => e.type === 'cash').reduce((s, e) => s + e.amount, 0);
          const totalPtsBack = todayEntries.filter(e => e.type === 'points').reduce((s, e) => s + e.amount, 0);
          const totalSpent   = todayEntries.length * SPIN_COST;
          let msg = `All ${DAILY_LIMIT} spins done! Spent ${totalSpent} pts.`;
          if (totalCash > 0)    msg += ` Won ₹${totalCash}`;
          if (totalPtsBack > 0) msg += `${totalCash > 0 ? ' +' : ' Won '} ${totalPtsBack} pts back`;
          notify.info(msg, { duration: 8000 });
          setTimeout(() => setShowSummary(true), 1400);
        }
      }, 4200);
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? 'Spin failed');
      setSpinning(false);
    }
  };

  const today          = todayStr();
  const todayHistory   = allHistory.filter(e => e.date === today);
  const spinsUsedToday = todayHistory.length;
  const spinsLeftCalc  = spinsLeft !== null ? spinsLeft : Math.max(0, DAILY_LIMIT - spinsUsedToday);

  const todayCash     = todayHistory.filter(e => e.type === 'cash').reduce((s, e) => s + e.amount, 0);
  const todayPtsBack  = todayHistory.filter(e => e.type === 'points').reduce((s, e) => s + e.amount, 0);
  const todaySpent    = spinsUsedToday * SPIN_COST;
  const todayNetPts   = todayPtsBack - todaySpent;

  const isLoading = spinsLeft === null;
  const noSpins   = spinsLeft !== null && spinsLeft <= 0;
  const noPoints  = aiPoints !== null && aiPoints < SPIN_COST;

  // Group history by date for history tab
  const groupedHistory = allHistory.reduce<Record<string, HistoryEntry[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

  // ── Summary screen ────────────────────────────────────────────────────────
  if (showSummary) {
    const summaryHistory = todayHistory.length > 0 ? todayHistory : sessionHistory.map(r => ({
      ts: Date.now(), date: today, icon: r.icon, label: r.label, amount: r.amount, type: r.type,
    }));
    return (
      <>
        <style>{STYLES}</style>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="pts-border-wrap w-full" style={{ maxWidth: 390 }}>
            <div className="pts-card-inner w-full" style={{ maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 18, margin: 0 }}>⭐ Today's Spin Summary</h2>
                    <p style={{ fontSize: 11, margin: '2px 0 0', fontWeight: 600,
                      color: todayCash > 0 ? '#22c55e' : todayPtsBack > 0 ? '#a5b4fc' : '#9ca3af' }}>
                      {todayCash > 0 && todayPtsBack > 0 ? `₹${todayCash} cash + ${todayPtsBack} pts won!`
                        : todayCash > 0 ? `You earned ₹${todayCash} real money!`
                        : todayPtsBack > 0 ? `Won ${todayPtsBack} AI points back!`
                        : 'Better luck tomorrow!'}
                    </p>
                  </div>
                  <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                </div>

                {/* Stats bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                  {[
                    { label: 'Spins', value: `${summaryHistory.length}/${DAILY_LIMIT}`, color: '#6ee7b7' },
                    { label: 'Cash Won', value: todayCash > 0 ? `+₹${todayCash}` : '₹0', color: todayCash > 0 ? '#4ade80' : '#6b7280' },
                    { label: 'Net Pts', value: `${todayNetPts > 0 ? '+' : ''}${todayNetPts}`, color: todayNetPts > 0 ? '#a5b4fc' : '#f87171' },
                  ].map(s => (
                    <div key={s.label} style={{ padding: '8px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                      <p style={{ color: s.color, fontWeight: 900, fontSize: 13, margin: 0 }}>{s.value}</p>
                      <p style={{ color: '#6b7280', fontSize: 9, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spin list — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summaryHistory.map((r, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{r.icon}</span>
                      <div>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: 0 }}>Spin {i + 1}</p>
                        <p style={{ color: '#6b7280', fontSize: 10, margin: '1px 0 0' }}>−{SPIN_COST} pts</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 900, fontSize: 14, margin: 0,
                        color: r.amount === 0 ? '#6b7280' : r.type === 'points' ? '#a5b4fc' : '#4ade80' }}>
                        {r.amount === 0 ? '—' : r.type === 'points' ? `+${r.amount} pts` : `+₹${r.amount}`}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: 10, margin: '1px 0 0' }}>{r.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ margin: '0 16px 12px', borderRadius: 14, padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>Points spent today</span>
                  <span style={{ color: '#f87171', fontWeight: 700, fontSize: 11 }}>−{todaySpent} pts</span>
                </div>
                {todayPtsBack > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>Points won back</span>
                    <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 11 }}>+{todayPtsBack} pts</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>Cash Won</span>
                    <p style={{ color: todayNetPts > 0 ? '#a5b4fc' : '#f87171', fontSize: 10, margin: '2px 0 0', fontWeight: 700 }}>
                      Net pts: {todayNetPts > 0 ? '+' : ''}{todayNetPts}
                    </p>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 18, color: todayCash > 0 ? '#4ade80' : '#6b7280' }}>
                    {todayCash > 0 ? `+₹${todayCash}` : '₹0'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '0 16px 18px', flexShrink: 0 }}>
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, marginBottom: 10 }}>Daily limit reached. Resets at midnight!</p>
                <button onClick={onClose} className="pts-btn-active"
                  style={{ width: '100%', padding: 14, borderRadius: 16, fontWeight: 900, fontSize: 14, color: '#fff', background: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'none', cursor: 'pointer' }}>
                  Done 🌙
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="pts-border-wrap w-full" style={{ maxWidth: 370 }}>
          <div className="pts-card-inner w-full" style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '16px 18px 10px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 19, margin: 0 }}>⭐ Points Spin</h2>
                <p style={{ color: '#22c55e', fontSize: 11, margin: '2px 0 0', fontWeight: 600, letterSpacing: '0.3px' }}>
                  {SPIN_COST} AI pts / spin · Win real ₹ · {DAILY_LIMIT}/day
                </p>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', margin: '0 16px 10px', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              {(['spin', 'history'] as ActiveTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s',
                    background: activeTab === tab ? 'linear-gradient(135deg,rgba(34,197,94,0.25),rgba(16,185,129,0.15))' : 'transparent',
                    color: activeTab === tab ? '#4ade80' : '#6b7280',
                    borderBottom: activeTab === tab ? '2px solid #22c55e' : '2px solid transparent',
                  }}>
                  {tab === 'spin' ? '🎰 Spin' : '📋 History'}
                </button>
              ))}
            </div>

            {/* ── Spin tab ── */}
            {activeTab === 'spin' && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                {/* AI Points balance + spins left row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 16px 10px', flexShrink: 0 }}>
                  <div style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <p style={{ color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>AI Points</p>
                    <p style={{ color: '#4ade80', fontSize: 16, fontWeight: 900, margin: 0 }}>
                      {aiPoints === null ? '…' : `⭐ ${aiPoints.toLocaleString()}`}
                    </p>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)' }}>
                    <p style={{ color: '#6b7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>Spins Left</p>
                    <p style={{ color: isLoading ? '#6b7280' : spinsLeftCalc === 0 ? '#f87171' : '#fde047', fontSize: 16, fontWeight: 900, margin: 0 }}>
                      {isLoading ? '…' : `${spinsLeftCalc} / ${DAILY_LIMIT}`}
                    </p>
                  </div>
                </div>

                {/* Progress dots */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, padding: '0 16px 8px', flexShrink: 0 }}>
                  {Array.from({ length: DAILY_LIMIT }).map((_, i) => {
                    const used = i < spinsUsedToday || (spinsLeft !== null && i < (DAILY_LIMIT - spinsLeft));
                    return (
                      <div key={i} style={{
                        width: used ? 18 : 7, height: 7, borderRadius: 4,
                        background: used ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.1)',
                        boxShadow: used ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
                        transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                        flexShrink: 0,
                      }} />
                    );
                  })}
                </div>

                {/* Wheel */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4, flexShrink: 0 }}>
                  <PointsWheel rotation={rotation} />
                </div>

                {/* Last result */}
                <AnimatePresence>
                  {lastResult && !spinning && (
                    <motion.div initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', damping: 18 }}
                      style={{ margin: '0 16px 10px', padding: '10px 14px', borderRadius: 14, textAlign: 'center', flexShrink: 0,
                        background: lastResult.amount > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                        border: lastResult.amount > 0 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                      <p style={{ fontSize: 26, margin: '0 0 3px', lineHeight: 1 }}>{lastResult.icon}</p>
                      <p style={{ color: '#fff', fontWeight: 900, fontSize: 14, margin: '0 0 2px' }}>{lastResult.label}</p>
                      {lastResult.amount > 0
                        ? lastResult.type === 'points'
                          ? <p style={{ color: '#a5b4fc', fontSize: 11, margin: 0, fontWeight: 600 }}>+{lastResult.amount} AI points added! ⭐</p>
                          : <p style={{ color: '#4ade80', fontSize: 11, margin: 0, fontWeight: 600 }}>+₹{lastResult.amount} added to wallet! 🎉</p>
                        : <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>Better luck next spin!</p>
                      }
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Spin button */}
                <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
                  {noPoints && !noSpins && (
                    <p style={{ textAlign: 'center', color: '#f97316', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>
                      Need {SPIN_COST} AI pts to spin. Play vs AI to earn more!
                    </p>
                  )}
                  <button onClick={doSpin} disabled={spinning || noSpins || noPoints || isLoading}
                    className={spinning || noSpins || noPoints ? '' : 'pts-btn-active'}
                    style={{ width: '100%', padding: 14, borderRadius: 16, fontWeight: 900, fontSize: 14, color: '#fff',
                      cursor: spinning || noSpins || noPoints ? 'not-allowed' : 'pointer',
                      background: spinning ? 'rgba(34,197,94,0.3)' : noSpins ? 'rgba(75,85,99,0.4)' : noPoints ? 'rgba(75,85,99,0.4)' : 'linear-gradient(135deg,#16a34a,#22c55e)',
                      border: 'none', opacity: noSpins || isLoading || noPoints ? 0.6 : 1, letterSpacing: '0.5px' }}>
                    {spinning    ? '🌀 Spinning…'
                      : noSpins  ? '✋ No spins left — come back tomorrow'
                      : noPoints ? `⭐ Need ${SPIN_COST} pts to spin`
                      : isLoading ? '…'
                      : `⭐ SPIN — ${SPIN_COST} pts  (${spinsLeftCalc} left)`}
                  </button>
                </div>
              </div>
            )}

            {/* ── History tab ── */}
            {activeTab === 'history' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 16px' }}>
                {sortedDates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: 32, margin: '0 0 8px' }}>📋</p>
                    <p style={{ color: '#6b7280', fontSize: 13, fontWeight: 600 }}>No spin history yet</p>
                    <p style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>Spin the wheel to get started!</p>
                  </div>
                ) : sortedDates.map(date => {
                  const entries = groupedHistory[date];
                  const dayCash    = entries.filter(e => e.type === 'cash').reduce((s, e) => s + e.amount, 0);
                  const dayPts     = entries.filter(e => e.type === 'points').reduce((s, e) => s + e.amount, 0);
                  const daySpent   = entries.length * SPIN_COST;
                  const dayNetPts  = dayPts - daySpent;
                  const isToday    = date === today;
                  return (
                    <div key={date} style={{ marginBottom: 16 }}>
                      {/* Day header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? '#4ade80' : '#9ca3af' }}>
                            {isToday ? 'Today' : date}
                          </span>
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{entries.length} spin{entries.length > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {dayCash > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>+₹{dayCash}</span>}
                          <span style={{ fontSize: 11, fontWeight: 700, color: dayNetPts >= 0 ? '#a5b4fc' : '#f87171' }}>
                            {dayNetPts > 0 ? '+' : ''}{dayNetPts} pts
                          </span>
                        </div>
                      </div>
                      {/* Entries */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {[...entries].reverse().map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 16 }}>{e.icon}</span>
                              <div>
                                <p style={{ color: '#d1d5db', fontWeight: 600, fontSize: 12, margin: 0 }}>{e.label}</p>
                                <p style={{ color: '#4b5563', fontSize: 9, margin: '1px 0 0' }}>
                                  {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · −{SPIN_COST} pts
                                </p>
                              </div>
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 13,
                              color: e.amount === 0 ? '#4b5563' : e.type === 'points' ? '#a5b4fc' : '#4ade80' }}>
                              {e.amount === 0 ? '—' : e.type === 'points' ? `+${e.amount} pts` : `+₹${e.amount}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </motion.div>
    </>
  );
}
