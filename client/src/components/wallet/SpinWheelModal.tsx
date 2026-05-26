import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../../services/api';
import { notify } from '../../services/notify';

const DEFAULT_dailyLimit = 3;

const SEGMENTS = [
  { label: 'Try Again', icon: '😔', color: '#111827', stroke: '#374151', textColor: '#6b7280' },
  { label: '₹2 Back',  icon: '🥈', color: '#1e1b4b', stroke: '#6366f1', textColor: '#a5b4fc' },
  { label: '₹5 Back',  icon: '🎯', color: '#2d1b69', stroke: '#8b5cf6', textColor: '#c4b5fd' },
  { label: '₹10',      icon: '✨', color: '#0c3547', stroke: '#06b6d4', textColor: '#67e8f9' },
  { label: '500 XP',   icon: '🎁', color: '#3d1e08', stroke: '#f59e0b', textColor: '#fcd34d' },
  { label: '₹20',      icon: '💰', color: '#052e16', stroke: '#22c55e', textColor: '#86efac' },
  { label: '₹50',      icon: '🌟', color: '#431407', stroke: '#f97316', textColor: '#fdba74' },
  { label: '₹100 🎉',  icon: '🏆', color: '#3b1a03', stroke: '#eab308', textColor: '#fde047' },
];

const SEG_DEG = 360 / SEGMENTS.length;

const PREMIUM_STYLES = `
  @keyframes spinBorderRotate {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes cardGlow {
    0%,100% { box-shadow: 0 0 30px rgba(99,102,241,0.35), 0 0 60px rgba(99,102,241,0.15); }
    50%      { box-shadow: 0 0 40px rgba(168,85,247,0.5), 0 0 80px rgba(168,85,247,0.2); }
  }
  @keyframes btnShimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(220%) skewX(-15deg); }
  }
  @keyframes btnPulse {
    0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.5); }
    50%      { box-shadow: 0 0 35px rgba(168,85,247,0.7), 0 0 50px rgba(99,102,241,0.3); }
  }
  @keyframes floatIcon {
    0%,100% { transform: translateY(0px) rotate(-2deg); }
    50%      { transform: translateY(-5px) rotate(2deg); }
  }
  @keyframes celebrationPop {
    0%   { transform: scale(0.5) rotate(-10deg); opacity: 0; }
    60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes starFloat {
    0%   { transform: translateY(0) scale(1); opacity: 0.8; }
    100% { transform: translateY(-60px) scale(0); opacity: 0; }
  }
  .spin-border-wrap {
    background: linear-gradient(135deg,#6366f1,#a855f7,#f59e0b,#ec4899,#6366f1);
    background-size: 400% 400%;
    animation: spinBorderRotate 5s ease infinite;
    padding: 2px;
    border-radius: 28px;
  }
  .spin-card-inner {
    border-radius: 26px;
    background: linear-gradient(160deg, #0d0a20 0%, #12082e 50%, #0a0d22 100%);
    animation: cardGlow 3s ease-in-out infinite;
  }
  .spin-btn-active {
    position: relative;
    overflow: hidden;
    animation: btnPulse 2s ease-in-out infinite;
  }
  .spin-btn-active::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 40%; height: 100%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
    animation: btnShimmer 2.5s ease-in-out infinite;
  }
  .spin-icon-float { animation: floatIcon 2s ease-in-out infinite; }
  .celebrate-pop { animation: celebrationPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .star-float { animation: starFloat 1s ease-out forwards; }
`;

function PremiumWheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const size = 272;
  const cx = size / 2;
  const r = size / 2 - 8;

  return (
    <div style={{ position: 'relative', width: size + 16, height: size + 28 }}>
      {/* Background glow halo */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: size + 40, height: size + 40,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Pointer arrow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        filter: 'drop-shadow(0 0 10px #f59e0b) drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
      }}>
        <svg width="28" height="34" viewBox="0 0 28 34">
          <polygon points="14,32 1,6 27,6" fill="#f59e0b" />
          <polygon points="14,28 5,10 23,10" fill="#fde68a" opacity="0.5" />
          <polygon points="14,24 9,14 19,14" fill="rgba(255,255,255,0.3)" />
        </svg>
      </div>

      <motion.svg
        width={size} height={size}
        style={{ transformOrigin: 'center', display: 'block', marginTop: 14 }}
        animate={{ rotate: rotation }}
        transition={{ duration: 4, ease: [0.17, 0.67, 0.35, 0.99] }}
      >
        <defs>
          <radialGradient id="wheelBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1035" />
            <stop offset="100%" stopColor="#0a0818" />
          </radialGradient>
          <radialGradient id="hubGold" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="35%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </radialGradient>
          <radialGradient id="hubInner" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0d0b21" />
          </radialGradient>
          <filter id="segGlow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="hubShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.6)" />
          </filter>
        </defs>

        {/* Base disc */}
        <circle cx={cx} cy={cx} r={r + 4} fill="url(#wheelBg)" />

        {/* Segments */}
        {SEGMENTS.map((seg, i) => {
          const startAngle = (i * SEG_DEG - 90) * (Math.PI / 180);
          const endAngle   = ((i + 1) * SEG_DEG - 90) * (Math.PI / 180);
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cx + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cx + r * Math.sin(endAngle);
          const midAngle = ((i + 0.5) * SEG_DEG - 90) * (Math.PI / 180);
          const textR = r * 0.62;
          const tx = cx + textR * Math.cos(midAngle);
          const ty = cx + textR * Math.sin(midAngle);
          const textRotate = (i + 0.5) * SEG_DEG;
          const path = `M ${cx} ${cx} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
          return (
            <g key={i}>
              {/* Segment fill */}
              <path d={path} fill={seg.color} />
              {/* Colored glow overlay for non-zero prizes */}
              {seg.label !== 'Try Again' && (
                <path d={path} fill={`${seg.stroke}18`} />
              )}
              {/* Stroke border */}
              <path d={path} fill="none" stroke={seg.stroke} strokeWidth="1.5" opacity="0.7" />
              {/* Icon */}
              <text x={tx} y={ty - 4} textAnchor="middle" dominantBaseline="middle"
                fill={seg.textColor} fontSize="14" fontWeight="bold"
                transform={`rotate(${textRotate}, ${tx}, ${ty - 4})`}
                style={{ filter: `drop-shadow(0 0 4px ${seg.stroke})` }}
              >{seg.icon}</text>
              {/* Label */}
              <text x={tx} y={ty + 12} textAnchor="middle" dominantBaseline="middle"
                fill={seg.textColor} fontSize="8.5" fontWeight="700" letterSpacing="0.2"
                transform={`rotate(${textRotate}, ${tx}, ${ty + 12})`}
              >{seg.label}</text>
            </g>
          );
        })}

        {/* Gold outer ring */}
        <circle cx={cx} cy={cx} r={r + 4} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.5" />
        <circle cx={cx} cy={cx} r={r + 2} fill="none" stroke="#fde68a" strokeWidth="3" opacity="0.8" />
        <circle cx={cx} cy={cx} r={r + 6} fill="none" stroke="#d97706" strokeWidth="1" opacity="0.4" />

        {/* Tick marks (rotate with wheel — decorative) */}
        {Array.from({ length: 32 }).map((_, i) => {
          const angle = (i * (360 / 32) - 90) * (Math.PI / 180);
          const r1 = r + 1, r2 = r - 3;
          const isMajor = i % 4 === 0;
          return (
            <line key={i}
              x1={cx + r1 * Math.cos(angle)} y1={cx + r1 * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)} y2={cx + r2 * Math.sin(angle)}
              stroke={isMajor ? '#fde68a' : '#f59e0b'} strokeWidth={isMajor ? 2 : 1}
              opacity={isMajor ? 0.9 : 0.5}
            />
          );
        })}

        {/* Center hub outer */}
        <circle cx={cx} cy={cx} r={28} fill="url(#hubGold)" filter="url(#hubShadow)" />
        <circle cx={cx} cy={cx} r={24} fill="url(#hubInner)" />
        <circle cx={cx} cy={cx} r={28} fill="none" stroke="#fde68a" strokeWidth="1.5" opacity="0.8" />
        {/* Center icon */}
        <text x={cx} y={cx + 1} textAnchor="middle" dominantBaseline="middle" fontSize="18">🎰</text>
      </motion.svg>
    </div>
  );
}

function StarParticles({ color }: { color: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="star-float" style={{
          position: 'absolute',
          width: 6 + (i % 3) * 4, height: 6 + (i % 3) * 4,
          borderRadius: '50%',
          background: color,
          left: `${15 + i * 7}%`,
          top: `${40 + (i % 3) * 10}%`,
          animationDelay: `${i * 0.1}s`,
          boxShadow: `0 0 8px ${color}`,
        }} />
      ))}
    </div>
  );
}

type SpinResult = { label: string; icon: string; amount: number; type: string; color: string; isFree?: boolean };

interface Props {
  onClose: () => void;
  onBalanceUpdate: (balance: number) => void;
}

export function SpinWheelModal({ onClose, onBalanceUpdate }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinsLeft, setSpinsLeft] = useState<number | null>(null);
  const [bonusSpins, setBonusSpins] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_dailyLimit);
  const [spinHistory, setSpinHistory] = useState<SpinResult[]>([]);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [showParticles, setShowParticles] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const totalRotation = useRef(0);

  useEffect(() => {
    walletApi.spinStatus().then(r => {
      const bonus = (r.data as any).bonusSpins ?? 0;
      setSpinsLeft(r.data.spinsLeft);
      setBonusSpins(bonus);
      setDailyLimit((r.data as any).dailyLimit ?? DEFAULT_dailyLimit);
      if (r.data.spinsLeft === 0 && bonus === 0) setShowSummary(true);
    }).catch(() => {});
  }, []);

  const doSpin = async () => {
    if (spinning || (spinsLeft !== null && spinsLeft <= 0 && bonusSpins <= 0)) return;
    setSpinning(true);
    setLastResult(null);
    setShowParticles(false);

    try {
      const { data } = await walletApi.spin();
      const prizeIdx = SEGMENTS.findIndex(s => s.label === data.prize.label);
      const idx = prizeIdx >= 0 ? prizeIdx : 0;
      const targetDeg = 360 - (idx * SEG_DEG + SEG_DEG / 2);
      const extra = 360 * (5 + Math.floor(Math.random() * 3));
      totalRotation.current += extra + targetDeg - (totalRotation.current % 360);
      setRotation(totalRotation.current);
      onBalanceUpdate(data.balance);

      setTimeout(() => {
        const result: SpinResult = { ...data.prize, isFree: !!((data as any).isFreeSplin) };
        const newBonusSpins = (data as any).bonusSpins ?? 0;
        setLastResult(result);
        setSpinsLeft(data.spinsLeft);
        setBonusSpins(newBonusSpins);
        const newHistory = [...spinHistory, result];
        setSpinHistory(newHistory);
        setSpinning(false);

        if (result.amount > 0) {
          setShowParticles(true);
          setTimeout(() => setShowParticles(false), 1200);
        }

        if (data.spinsLeft === 0 && newBonusSpins === 0) {
          // Mark exhausted date for daily unlock notification
          localStorage.setItem('spin_exhausted_date', new Date().toISOString().slice(0, 10));
          // Toast with total winnings
          const totalCash = newHistory.filter(r => r.type === 'cash').reduce((s, r) => s + r.amount, 0);
          const totalXp   = newHistory.filter(r => r.type === 'xp').reduce((s, r) => s + r.amount, 0);
          let msg = `All ${dailyLimit} spins used! `;
          if (totalCash > 0) msg += `Won ₹${totalCash}`;
          if (totalXp > 0)   msg += `${totalCash > 0 ? ' + ' : ''}${totalXp} XP`;
          if (totalCash === 0 && totalXp === 0) msg += 'Better luck tomorrow!';
          notify.info(msg, { duration: 8000 });
          setTimeout(() => setShowSummary(true), 1400);
        }
      }, 4200);
    } catch (err: any) {
      notify.error(err?.response?.data?.error ?? 'Spin failed');
      setSpinning(false);
    }
  };

  const spinsUsed  = spinsLeft !== null ? dailyLimit - spinsLeft : 0;
  const totalCash  = spinHistory.filter(r => r.type === 'cash').reduce((s, r) => s + r.amount, 0);
  const totalXp    = spinHistory.filter(r => r.type === 'xp').reduce((s, r) => s + r.amount, 0);
  const totalSpent = spinHistory.filter(r => !(r as any).isFree).length * 5;
  const netGain    = totalCash - totalSpent;
  const isLoading  = spinsLeft === null;
  const noSpins    = spinsLeft !== null && spinsLeft <= 0 && bonusSpins <= 0;
  const hasBonusSpin = bonusSpins > 0;

  // ── Summary screen ────────────────────────────────────────────────────────
  if (showSummary && spinHistory.length > 0) {
    return (
      <>
        <style>{PREMIUM_STYLES}</style>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="spin-border-wrap w-full" style={{ maxWidth: 380 }}>
            <div className="spin-card-inner w-full">
              {/* Header */}
              <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 18, margin: 0 }}>
                    {netGain >= 0 ? '🏆 Spin Summary' : '🎰 Spin Summary'}
                  </h2>
                  <p style={{ color: '#8b5cf6', fontSize: 11, margin: '2px 0 0', fontWeight: 600 }}>
                    {netGain > 0 ? `Great session! You're up ₹${netGain}` : netGain === 0 ? 'Broke even!' : 'Come back tomorrow!'}
                  </p>
                </div>
                <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* Spin results list */}
              <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {spinHistory.map((r, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{r.icon}</span>
                      <div>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: 0 }}>Spin {i + 1}</p>
                        <p style={{ fontSize: 10, margin: '1px 0 0', color: r.isFree ? '#facc15' : '#6b7280' }}>
                          {r.isFree ? 'FREE Bonus Spin 🎁' : 'Cost: ₹5'}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontWeight: 900, fontSize: 14, margin: 0,
                        color: r.amount === 0 ? '#6b7280' : r.type === 'xp' ? '#f59e0b' : r.amount >= 5 ? '#4ade80' : '#f87171',
                      }}>
                        {r.amount === 0 ? '—' : r.type === 'xp' ? `+${r.amount} XP` : `+₹${r.amount}`}
                      </p>
                      <p style={{ color: '#6b7280', fontSize: 10, margin: '1px 0 0' }}>{r.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Totals card */}
              <div style={{ margin: '0 16px 16px', borderRadius: 16, padding: '14px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>Total spent</span>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>
                    ₹{totalSpent}{totalSpent < spinHistory.length * 5 ? <span style={{ color: '#facc15', fontSize: 10, marginLeft: 4 }}>({spinHistory.filter(r => r.isFree).length} free)</span> : null}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>Total won</span>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>
                    {totalCash > 0 ? `₹${totalCash}` : '—'}{totalXp > 0 ? ` + ${totalXp} XP` : ''}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Net</span>
                  <span style={{ fontWeight: 900, fontSize: 16, color: netGain >= 0 ? '#4ade80' : '#f87171' }}>
                    {netGain >= 0 ? '+' : ''}₹{netGain}
                  </span>
                </div>
              </div>

              <div style={{ padding: '0 16px 20px' }}>
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 11, marginBottom: 12 }}>
                  Daily spins used up. Resets at midnight!
                </p>
                <button onClick={onClose} className="spin-btn-active"
                  style={{ width: '100%', padding: '14px', borderRadius: 16, fontWeight: 900, fontSize: 14, color: '#fff', background: 'linear-gradient(135deg,#6366f1,#a855f7)', border: 'none', cursor: 'pointer' }}>
                  Done — See you tomorrow! 🌙
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  // ── Main spin screen ──────────────────────────────────────────────────────
  return (
    <>
      <style>{PREMIUM_STYLES}</style>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="spin-border-wrap w-full" style={{ maxWidth: 360 }}>
          <div className="spin-card-inner w-full">

            {/* Header */}
            <div style={{ padding: '18px 18px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="spin-icon-float">🎰</span> Money Spin
                </h2>
                <p style={{ color: '#8b5cf6', fontSize: 11, margin: '3px 0 0', fontWeight: 600, letterSpacing: '0.3px' }}>
                  ₹5 per spin · Win up to ₹100 · {dailyLimit} spins daily
                </p>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>✕</button>
            </div>

            {/* Spin dots tracker */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: hasBonusSpin ? 6 : 10 }}>
              {Array.from({ length: dailyLimit }).map((_, i) => {
                const used = i < spinsUsed;
                return (
                  <div key={i} style={{
                    width: used ? 28 : 10, height: 10, borderRadius: 5,
                    background: used ? 'linear-gradient(90deg,#6366f1,#a855f7)' : 'rgba(255,255,255,0.1)',
                    boxShadow: used ? '0 0 8px rgba(99,102,241,0.7)' : 'none',
                    transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                );
              })}
              <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 4 }}>
                {isLoading ? '…' : `${spinsLeft} left`}
              </span>
            </div>

            {/* Bonus spin badge */}
            {hasBonusSpin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  margin: '0 16px 8px',
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg,rgba(250,204,21,0.18),rgba(245,158,11,0.08))',
                  border: '1px solid rgba(250,204,21,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>🎁</span>
                <span style={{ color: '#facc15', fontWeight: 800, fontSize: 12 }}>
                  {bonusSpins} FREE BONUS SPIN{bonusSpins > 1 ? 'S' : ''} AVAILABLE!
                </span>
                <span style={{ fontSize: 16 }}>🎁</span>
              </motion.div>
            )}

            {/* Wheel */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 6, paddingTop: 4, position: 'relative' }}>
              <PremiumWheel rotation={rotation} spinning={spinning} />
              {showParticles && lastResult && <StarParticles color={lastResult.color || '#f59e0b'} />}
            </div>

            {/* Last result reveal */}
            <AnimatePresence>
              {lastResult && !spinning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', damping: 18 }}
                  style={{
                    margin: '0 16px 12px', padding: '12px 16px', borderRadius: 16, textAlign: 'center',
                    background: lastResult.amount > 0 ? `${SEGMENTS.find(s => s.label === lastResult.label)?.stroke ?? '#6366f1'}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${lastResult.amount > 0 ? SEGMENTS.find(s => s.label === lastResult.label)?.stroke ?? '#6366f1' : 'rgba(255,255,255,0.1)'}55`,
                  }}
                >
                  <p style={{ fontSize: 28, margin: '0 0 4px', lineHeight: 1 }}>{lastResult.icon}</p>
                  <p style={{ color: '#fff', fontWeight: 900, fontSize: 15, margin: '0 0 3px' }}>{lastResult.label}</p>
                  {lastResult.amount > 0
                    ? <p style={{ color: '#4ade80', fontSize: 12, margin: 0, fontWeight: 600 }}>
                        {lastResult.type === 'xp' ? `+${lastResult.amount} XP added to your account!` : `+₹${lastResult.amount} added to wallet! 🎉`}
                      </p>
                    : <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>Better luck next spin!</p>
                  }
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spin button */}
            <div style={{ padding: '0 16px 20px' }}>
              <button
                onClick={doSpin}
                disabled={spinning || noSpins || isLoading}
                className={spinning || noSpins ? '' : 'spin-btn-active'}
                style={{
                  width: '100%', padding: '15px', borderRadius: 18,
                  fontWeight: 900, fontSize: 15,
                  color: hasBonusSpin && (spinsLeft ?? 0) <= 0 ? '#0d0d0d' : '#fff',
                  cursor: spinning || noSpins ? 'not-allowed' : 'pointer',
                  background: spinning
                    ? 'rgba(99,102,241,0.4)'
                    : noSpins
                    ? 'rgba(75,85,99,0.4)'
                    : hasBonusSpin && (spinsLeft ?? 0) <= 0
                    ? 'linear-gradient(135deg,#f59e0b,#facc15)'
                    : 'linear-gradient(135deg,#6366f1,#a855f7)',
                  border: 'none',
                  opacity: noSpins || isLoading ? 0.6 : 1,
                  letterSpacing: '0.5px',
                  transition: 'all 0.3s ease',
                }}
              >
                {spinning
                  ? '🌀 Spinning…'
                  : noSpins
                  ? '✋ Come back tomorrow'
                  : isLoading
                  ? '…'
                  : hasBonusSpin && (spinsLeft ?? 0) <= 0
                  ? `🎁 USE FREE BONUS SPIN (${bonusSpins} left)`
                  : `🎰 SPIN NOW · ₹5  (${spinsLeft} left)`}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
