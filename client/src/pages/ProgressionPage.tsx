import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useProgressionStore, RANK_CONFIG } from '../store/progressionStore';
import { progressionApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { notify } from '../services/notify';
import { useAuthStore } from '../store/authStore';

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af', rare: '#60a5fa', epic: '#a855f7', legendary: '#fbbf24',
};
const RARITY_GLOW: Record<string, string> = {
  common: 'rgba(156,163,175,0.15)', rare: 'rgba(96,165,250,0.15)',
  epic: 'rgba(168,85,247,0.15)', legendary: 'rgba(251,191,36,0.2)',
};

function XpBar({ progress }: { progress: any }) {
  const pct = progress.xpNeeded > 0 ? Math.min(100, Math.round((progress.xpProgress / progress.xpNeeded) * 100)) : 100;
  const rc = RANK_CONFIG[progress.rank] ?? RANK_CONFIG.bronze;
  return (
    <div className="rounded-2xl p-5 space-y-3"
      style={{ background: 'linear-gradient(135deg,rgba(12,14,22,0.95),rgba(18,10,28,0.95))', border: `1px solid ${rc.color}40` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: `${rc.color}18`, border: `2px solid ${rc.color}`, boxShadow: `0 0 16px ${rc.glow}` }}>
            {rc.icon}
          </div>
          <div>
            <p className="text-xs text-dark-muted uppercase tracking-widest">Rank</p>
            <p className="font-black text-lg" style={{ color: rc.color }}>{rc.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-dark-muted">Level</p>
          <p className="text-3xl font-black text-white">{progress.level}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-dark-muted mb-1">
          <span>{progress.xpProgress.toLocaleString()} / {progress.xpNeeded.toLocaleString()} XP</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full" style={{ background: `linear-gradient(90deg,${rc.color},${rc.color}cc)`, boxShadow: `0 0 8px ${rc.glow}` }} />
        </div>
        <p className="text-[10px] text-dark-muted mt-1 text-right">Total: {progress.xp.toLocaleString()} XP</p>
      </div>
    </div>
  );
}

function RankProgressionRow({ currentRank }: { currentRank: string }) {
  const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
  const currentIdx = ranks.indexOf(currentRank);
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] text-dark-muted uppercase tracking-widest mb-3 text-center">Rank Progression</p>
      <div className="flex items-center justify-between">
        {ranks.map((rank, i) => {
          const rc = RANK_CONFIG[rank];
          const isActive = rank === currentRank;
          const isDone = i < currentIdx;
          return (
            <React.Fragment key={rank}>
              <div className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                  style={{
                    background: isActive ? `${rc.color}20` : isDone ? `${rc.color}15` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${isActive ? rc.color : isDone ? `${rc.color}80` : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isActive ? `0 0 12px ${rc.glow}` : 'none',
                    opacity: isDone || isActive ? 1 : 0.4,
                  }}>
                  {rc.icon}
                </div>
                <span className="text-[8px]" style={{ color: isActive ? rc.color : '#4b5563' }}>{rc.label}</span>
              </div>
              {i < ranks.length - 1 && (
                <div className="flex-1 h-0.5 mx-1" style={{ background: i < currentIdx ? `${rc.color}60` : 'rgba(255,255,255,0.06)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StatsGrid({ progress }: { progress: any }) {
  const stats = [
    { label: 'Win Streak',     value: progress.winStreak,     color: '#fbbf24', emoji: '🔥' },
    { label: 'Best Streak',    value: progress.maxWinStreak,  color: '#ef4444', emoji: '⚡' },
    { label: 'Total Wins',     value: progress.totalWins,     color: '#22c55e', emoji: '✅' },
    { label: 'Games Played',   value: progress.totalGames,    color: '#60a5fa', emoji: '🎮' },
    { label: 'Survival Wins',  value: progress.survivalWins,  color: '#a855f7', emoji: '🏆' },
    { label: 'Login Streak',   value: progress.loginStreak,   color: '#f59e0b', emoji: '📅' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl p-3 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-lg mb-0.5">{s.emoji}</p>
          <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
          <p className="text-[9px] text-dark-muted mt-0.5">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

function AchievementsSection({ progress, allDefs }: { progress: any; allDefs: any[] }) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const unlockedIds = new Set((progress.achievements ?? []).map((a: any) => a.id));
  const filtered = allDefs.filter(def =>
    filter === 'all' ? true : filter === 'unlocked' ? unlockedIds.has(def.id) : !unlockedIds.has(def.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Achievements <span className="text-dark-muted font-normal">({unlockedIds.size}/{allDefs.length})</span></p>
        <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1 text-[10px] font-semibold capitalize transition-all"
              style={filter === f ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { color: '#6b7280' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((def, i) => {
          const unlocked = unlockedIds.has(def.id);
          const unlockedEntry = progress.achievements?.find((a: any) => a.id === def.id);
          return (
            <motion.div key={def.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: unlocked ? RARITY_GLOW[def.rarity] : 'rgba(255,255,255,0.02)',
                border: `1px solid ${unlocked ? RARITY_COLOR[def.rarity] + '40' : 'rgba(255,255,255,0.06)'}`,
                opacity: unlocked ? 1 : 0.55,
              }}>
              <div className="text-2xl" style={{ filter: unlocked ? 'none' : 'grayscale(1)' }}>{def.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold" style={{ color: unlocked ? RARITY_COLOR[def.rarity] : '#6b7280' }}>{def.name}</p>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full capitalize font-semibold"
                    style={{ background: `${RARITY_COLOR[def.rarity]}20`, color: RARITY_COLOR[def.rarity] }}>
                    {def.rarity}
                  </span>
                </div>
                <p className="text-[10px] text-dark-muted">{def.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {unlocked ? (
                  <div>
                    <p className="text-[9px] text-green-400 font-semibold">✓ Done</p>
                    {unlockedEntry?.unlockedAt && (
                      <p className="text-[8px] text-dark-muted">{new Date(unlockedEntry.unlockedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    {def.xpReward > 0 && <p className="text-[9px] text-blue-400">+{def.xpReward} XP</p>}
                    {def.pointsReward > 0 && <p className="text-[9px] text-yellow-400">+{def.pointsReward} pts</p>}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Lucky Spin Wheel ─────────────────────────────────────────────────────────

// Segments mirror the server's LUCKY_OUTCOMES (miss/20/40/100/200/400/1500)
// repeated proportionally so the visual wheel matches real probabilities.
const WHEEL_SEGMENTS = [
  { label: 'MISS',      emoji: '💨', pts: 0,    xp: 0,   color: '#374151', textColor: '#9ca3af' },
  { label: '+20 pts',   emoji: '⭐', pts: 20,   xp: 10,  color: '#1e3a5f', textColor: '#93c5fd' },
  { label: '+40 pts',   emoji: '💫', pts: 40,   xp: 15,  color: '#1e40af', textColor: '#bfdbfe' },
  { label: 'MISS',      emoji: '💨', pts: 0,    xp: 0,   color: '#374151', textColor: '#9ca3af' },
  { label: '+20 pts',   emoji: '⭐', pts: 20,   xp: 10,  color: '#1e3a5f', textColor: '#93c5fd' },
  { label: '+100 pts',  emoji: '✨', pts: 100,  xp: 25,  color: '#065f46', textColor: '#6ee7b7' },
  { label: 'MISS',      emoji: '💨', pts: 0,    xp: 0,   color: '#374151', textColor: '#9ca3af' },
  { label: '+40 pts',   emoji: '💫', pts: 40,   xp: 15,  color: '#1e40af', textColor: '#bfdbfe' },
  { label: '+200 pts',  emoji: '🌟', pts: 200,  xp: 50,  color: '#78350f', textColor: '#fcd34d' },
  { label: 'MISS',      emoji: '💨', pts: 0,    xp: 0,   color: '#374151', textColor: '#9ca3af' },
  { label: 'JACKPOT!',  emoji: '🎰', pts: 400,  xp: 100, color: '#7c2d12', textColor: '#fb923c' },
  { label: 'MEGA!',     emoji: '💥', pts: 1500, xp: 500, color: '#4c1d95', textColor: '#c084fc' },
];

const SEG_COUNT = WHEEL_SEGMENTS.length;
const SEG_DEG = 360 / SEG_COUNT; // 30°

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function SpinWheel({ rotation, spinning, decelerating }: { rotation: number; spinning: boolean; decelerating: boolean }) {
  const cx = 150, cy = 150, r = 138, rText = 108;
  return (
    <div className="relative" style={{ width: 300, height: 300 }}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full" style={{
        boxShadow: spinning ? '0 0 40px 10px rgba(168,85,247,0.5)' : '0 0 20px 4px rgba(168,85,247,0.25)',
        transition: 'box-shadow 0.3s',
        borderRadius: '50%',
      }} />

      {/* Wheel SVG */}
      <svg width={300} height={300} style={{
        transform: `rotate(${rotation}deg)`,
        transition: decelerating ? `transform 4s cubic-bezier(0.17,0.67,0.12,1.0)` : 'none',
        display: 'block',
      }}>
        <defs>
          <filter id="seg-shadow">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.4" />
          </filter>
        </defs>

        {WHEEL_SEGMENTS.map((seg, i) => {
          const startDeg = i * SEG_DEG - 90;
          const endDeg = startDeg + SEG_DEG;
          const midDeg = startDeg + SEG_DEG / 2;
          const toRad = (d: number) => (d * Math.PI) / 180;
          const tx = cx + rText * Math.cos(toRad(midDeg));
          const ty = cy + rText * Math.sin(toRad(midDeg));

          return (
            <g key={i}>
              <path d={describeArc(cx, cy, r, startDeg, endDeg)}
                fill={seg.color}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
              <text
                x={tx} y={ty}
                textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${midDeg + 90},${tx},${ty})`}
                fontSize={seg.pts >= 1000 ? 9 : 10}
                fontWeight="bold"
                fill={seg.textColor}
              >
                {seg.label}
              </text>
              <text
                x={tx} y={ty + 13}
                textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${midDeg + 90},${tx},${ty + 13})`}
                fontSize={12}
              >
                {seg.emoji}
              </text>
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={22} fill="#0d1022" stroke="rgba(168,85,247,0.6)" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={14} fill="rgba(168,85,247,0.3)" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14}>🎰</text>
      </svg>

      {/* Pointer (fixed, points down toward center from top) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1" style={{ zIndex: 10 }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderTop: '22px solid #fbbf24',
          filter: 'drop-shadow(0 2px 6px rgba(251,191,36,0.8))',
        }} />
      </div>
    </div>
  );
}

function LuckySpinSection({ progress, onSpun }: { progress: any; onSpun: (result: any) => void }) {
  const { luckySpin } = useProgressionStore();
  const [animating, setAnimating] = useState(false);
  const [decelerating, setDecelerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const canSpin = progress.canSpin;

  function segIndexForOutcome(pts: number): number {
    if (pts >= 1500) return 11; // MEGA!
    if (pts >= 400)  return 10; // JACKPOT!
    if (pts >= 200)  return 8;  // +200 pts
    if (pts >= 100)  return 5;  // +100 pts
    if (pts >= 40)   return 2;  // +40 pts
    if (pts >= 20)   return 1;  // +20 pts
    return 0;                    // MISS
  }

  const handleSpin = async () => {
    if (animating || !canSpin) return;
    setAnimating(true);
    setDecelerating(false);
    setResult(null);

    try {
      const data = await luckySpin();
      const outcome = data.outcome;

      const segIdx = segIndexForOutcome(outcome.points ?? 0);
      const segCentre = segIdx * SEG_DEG;
      // Segment i's centre in the unrotated SVG is at (i*30 - 75)°, not (i*30)°,
      // because segments start at -90° and each is 30° wide (centre offset = -90 + 15 = -75).
      // To land segment i under the top pointer (270°): R = (270 - (i*30-75)) = (345 - i*30).
      const targetMod = (345 - segCentre + 360) % 360;
      const spins = 6 * 360;
      // Ensure we always go forward from current rotation
      const currentMod = rotation % 360;
      const extra = targetMod >= currentMod ? 0 : 360;
      const finalRot = rotation - currentMod + extra + spins + targetMod;

      // Enable CSS transition then set final angle — browser renders the transition
      setDecelerating(true);
      setRotation(finalRot);

      setTimeout(() => {
        setResult(outcome);
        setAnimating(false);
        setDecelerating(false);
        onSpun(data);
      }, 4300);

    } catch (err: any) {
      notify.error(err.response?.data?.error ?? 'Spin failed');
      setAnimating(false);
    }
  };

  const isBig = result && result.points >= 400;

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: 'linear-gradient(135deg,rgba(76,29,149,0.12),rgba(30,58,138,0.12))', border: '1px solid rgba(168,85,247,0.25)' }}>
      <p className="text-[10px] uppercase tracking-widest text-dark-muted text-center">Daily Lucky Spin</p>

      {/* Wheel */}
      <div className="flex justify-center">
        <SpinWheel rotation={rotation} spinning={animating} decelerating={decelerating} />
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-3 text-center"
            style={{
              background: isBig ? 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(168,85,247,0.15))' : 'rgba(255,255,255,0.05)',
              border: isBig ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isBig ? '0 0 24px rgba(251,191,36,0.3)' : 'none',
            }}>
            <p className="text-2xl mb-1">{result.emoji}</p>
            <p className="font-black text-sm" style={{ color: isBig ? '#fbbf24' : '#c084fc' }}>{result.label}</p>
            {result.points > 0 && <p className="text-xs text-yellow-400 mt-0.5">+{result.points} pts credited!</p>}
            {result.xp > 0 && <p className="text-xs text-blue-400">+{result.xp} XP earned!</p>}
            {result.points === 0 && <p className="text-xs text-dark-muted">Better luck tomorrow!</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin button */}
      {!result && (
        <motion.button
          whileHover={!animating && canSpin ? { scale: 1.02 } : {}}
          whileTap={!animating && canSpin ? { scale: 0.97 } : {}}
          onClick={handleSpin}
          disabled={!canSpin || animating}
          className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40 transition-all"
          style={{
            background: canSpin ? 'linear-gradient(135deg,#7c3aed,#4338ca)' : 'rgba(255,255,255,0.06)',
            color: '#fff',
            boxShadow: canSpin && !animating ? '0 0 20px rgba(124,58,237,0.4)' : 'none',
          }}>
          {animating ? '🎰 Spinning…' : canSpin ? '🎰 Spin Now!' : '✓ Spun Today'}
        </motion.button>
      )}
      {result && (
        <p className="text-[10px] text-center text-dark-muted">Come back tomorrow for another spin!</p>
      )}
    </div>
  );
}

function DailyRewardSection({ progress }: { progress: any }) {
  const days = [
    { day: 1, pts: 50,  emoji: '👋' },
    { day: 2, pts: 75,  emoji: '🔥' },
    { day: 3, pts: 150, emoji: '⚡' },
    { day: 4, pts: 100, emoji: '💫' },
    { day: 5, pts: 125, emoji: '🌟' },
    { day: 6, pts: 200, emoji: '✨' },
    { day: 7, pts: 500, emoji: '🏆' },
  ];
  const currentDay = progress.dailyRewardDay ?? 0;

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">Daily Rewards</p>
        <span className="text-[10px] text-yellow-400">{progress.loginStreak > 0 ? `🔥 ${progress.loginStreak}-day streak` : 'Start your streak!'}</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(d => {
          const done = d.day <= currentDay && !progress.canClaimDaily;
          const isNext = d.day === (currentDay % 7) + 1 && progress.canClaimDaily;
          return (
            <div key={d.day} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{
                  background: done ? 'rgba(34,197,94,0.15)' : isNext ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${done ? '#22c55e50' : isNext ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                {done ? '✓' : d.emoji}
              </div>
              <p className="text-[7px] text-dark-muted">₹{(d.pts / 100).toFixed(0)}</p>
            </div>
          );
        })}
      </div>
      {!progress.canClaimDaily && (
        <p className="text-[10px] text-center text-green-400">✓ Claimed today — come back tomorrow!</p>
      )}
    </div>
  );
}

export function ProgressionPage() {
  const { user } = useAuthStore();
  const { progress, loaded, load, subscribe } = useProgressionStore();
  const navigate = useNavigate();
  const [allAchievements, setAllAchievements] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'achievements' | 'leaderboard'>('overview');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [lbCategory, setLbCategory] = useState<'xp' | 'streak' | 'survival'>('xp');
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    load();
    progressionApi.achievements().then(r => setAllAchievements(r.data.achievements)).catch(() => {});
    const unsub = subscribe();
    return unsub;
  }, []);

  useEffect(() => {
    if (tab !== 'leaderboard') return;
    setLbLoading(true);
    progressionApi.leaderboard(lbCategory)
      .then(r => setLeaderboardData(r.data.leaderboard))
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, [tab, lbCategory]);

  if (!loaded || !progress) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const rc = RANK_CONFIG[progress.rank] ?? RANK_CONFIG.bronze;

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">My Progression</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: `${rc.color}15`, border: `1px solid ${rc.color}40` }}>
            <span>{rc.icon}</span>
            <span className="text-sm font-bold" style={{ color: rc.color }}>{rc.label}</span>
            <span className="text-xs text-dark-muted">Lv.{progress.level}</span>
          </div>
        </div>

        <XpBar progress={progress} />
        <RankProgressionRow currentRank={progress.rank} />

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['overview', 'achievements', 'leaderboard'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2.5 text-sm font-semibold capitalize transition-all"
              style={tab === t ? { background: 'rgba(168,85,247,0.18)', color: '#c084fc' } : { color: '#6b7280' }}>
              {t === 'overview' ? '📊 Overview' : t === 'achievements' ? '🏅 Achievements' : '🏆 Leaderboard'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }} className="space-y-4">

            {tab === 'overview' && (
              <>
                <StatsGrid progress={progress} />
                <DailyRewardSection progress={progress} />
                <LuckySpinSection progress={progress} onSpun={() => load()} />
              </>
            )}

            {tab === 'achievements' && (
              <AchievementsSection progress={progress} allDefs={allAchievements} />
            )}

            {tab === 'leaderboard' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['xp', 'streak', 'survival'] as const).map(c => (
                    <button key={c} onClick={() => setLbCategory(c)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all"
                      style={lbCategory === c ? { background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' } : { background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {c === 'xp' ? '⭐ XP' : c === 'streak' ? '🔥 Win Streak' : '🏆 Survival'}
                    </button>
                  ))}
                </div>

                {lbLoading ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>
                ) : leaderboardData.length === 0 ? (
                  <div className="text-center py-8 text-dark-muted text-sm">No data yet</div>
                ) : (
                  <div className="space-y-2">
                    {leaderboardData.map((entry, i) => {
                      const erc = RANK_CONFIG[entry.playerRank] ?? RANK_CONFIG.bronze;
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                      const val = lbCategory === 'xp' ? `${entry.xp.toLocaleString()} XP`
                        : lbCategory === 'streak' ? `${entry.maxWinStreak} streak`
                        : `${entry.survivalWins} wins`;
                      return (
                        <div key={entry.userId} className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: i < 3 ? `${erc.color}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${i < 3 ? erc.color + '25' : 'rgba(255,255,255,0.06)'}` }}>
                          <span className="w-6 text-center text-sm">{medal ?? <span className="text-dark-muted text-xs">#{i + 1}</span>}</span>
                          <span className="text-sm">{erc.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{entry.username}</p>
                            <p className="text-[10px] text-dark-muted">Lv.{entry.level} · {erc.label}</p>
                          </div>
                          <p className="text-sm font-bold" style={{ color: erc.color }}>{val}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
