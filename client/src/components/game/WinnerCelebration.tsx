import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchResult } from '../../types';
import { useAuthStore } from '../../store/authStore';

// ── Motivational quotes for non-winners ──────────────────────────────────────
const LOSER_QUOTES = [
  "The comeback is always stronger than the setback.",
  "Every champion was once a contender who refused to give up.",
  "Defeat is a stepping stone on the road to victory.",
  "You played hard. The arena remembers every move.",
  "Today's loss fuels tomorrow's triumph.",
  "The best players fall. Then rise again, unstoppable.",
  "One round doesn't define a champion. Keep fighting.",
  "Adversity reveals character. You showed yours.",
];

// ── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ gold }: { gold?: boolean }) {
  const pieces = useMemo(() => Array.from({ length: 160 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: gold
      ? ['#ffd700', '#ffec6e', '#fbbf24', '#f59e0b', '#fff7ae', '#ffe57a', '#ffffff'][Math.floor(Math.random() * 7)]
      : ['#00ff88', '#ffd700', '#00bfff', '#ff3b5c', '#bf00ff', '#ff9500', '#ffffff'][Math.floor(Math.random() * 7)],
    delay: Math.random() * 1.8,
    duration: 3 + Math.random() * 3,
    size: 5 + Math.random() * 14,
    rotate: Math.random() * 360,
    shape: Math.floor(Math.random() * 3),
    drift: (Math.random() - 0.5) * 140,
  })), [gold]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 60 }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: '-6%', x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            y: '115vh',
            x: `calc(${p.x}vw + ${p.drift}px)`,
            opacity: [1, 1, 0.6, 0],
            rotate: p.rotate * 7,
            scale: [1, 0.8, 0.3, 0.1],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.shape === 2 ? p.size * 2.2 : p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 0 ? '50%' : p.shape === 1 ? '2px' : '0',
            boxShadow: `0 0 ${p.size * 0.8}px ${p.color}90`,
          }}
        />
      ))}
    </div>
  );
}

// ── Burst particles at trophy ─────────────────────────────────────────────────
function BurstParticles({ color }: { color: string }) {
  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    return { id: i, angle, dist: 55 + Math.random() * 75, size: 3 + Math.random() * 6 };
  }), []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1.2 }}
          animate={{
            x: Math.cos(p.angle * Math.PI / 180) * p.dist,
            y: Math.sin(p.angle * Math.PI / 180) * p.dist,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 2.5}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

// ── Rotating sunray conic gradient behind trophy ─────────────────────────────
function SunRays({ color, size = 260 }: { color: string; size?: number }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'absolute',
        width: size, height: size,
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: `conic-gradient(
          ${color}22 0deg, transparent 18deg,
          ${color}16 36deg, transparent 54deg,
          ${color}1a 72deg, transparent 90deg,
          ${color}10 108deg, transparent 126deg,
          ${color}20 144deg, transparent 162deg,
          ${color}14 180deg, transparent 198deg,
          ${color}18 216deg, transparent 234deg,
          ${color}0e 252deg, transparent 270deg,
          ${color}1c 288deg, transparent 306deg,
          ${color}12 324deg, transparent 342deg,
          ${color}18 360deg
        )`,
        borderRadius: '50%',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Floating ambient stars ────────────────────────────────────────────────────
function AmbientStars({ color, count = 22 }: { color: string; count?: number }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2.5,
    delay: Math.random() * 2.5,
    dur: 1.8 + Math.random() * 2.2,
  })), [count]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {stars.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 0.4] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 ${s.size * 4}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

// ── Count-up number ───────────────────────────────────────────────────────────
function CountUp({ target, duration = 1400 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val.toLocaleString('en-IN')}</>;
}

// ── Shimmer sweep ─────────────────────────────────────────────────────────────
function Shimmer({ color = 'rgba(255,255,255,0.18)', delay = 0, repeatDelay = 3 }) {
  return (
    <motion.div
      animate={{ x: ['-110%', '210%'] }}
      transition={{ duration: 1.6, delay, repeat: Infinity, repeatDelay, ease: 'easeInOut' }}
      style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(105deg, transparent 30%, ${color} 50%, transparent 70%)`,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function WinnerCelebration({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  const { user } = useAuthStore();
  const winnerIds = result.winnerIds ?? [result.winnerId];
  const isTie     = winnerIds.length > 1;
  const isWinner  = !!user && winnerIds.includes(user.id);
  const hasPrize  = (result.prizePool ?? 0) > 0;
  const prizeWon  = result.prizePerWinner ?? 0;

  const [showConfetti, setShowConfetti] = useState(true);
  const [quote]   = useState(() => LOSER_QUOTES[Math.floor(Math.random() * LOSER_QUOTES.length)]);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const sortedScores = useMemo(() =>
    [...result.finalScores].sort((a, b) => a.totalScore - b.totalScore),
    [result.finalScores]
  );

  const myScore = result.finalScores.find(s => s.playerId === user?.id);
  const winnerScore = sortedScores[0];

  // ── Color palette ──────────────────────────────────────────────────────────
  const gold   = '#ffd700';
  const green  = '#00ff88';
  const purple = '#a855f7';

  const accent     = hasPrize && isWinner ? gold : isWinner ? green : purple;
  const accentDim  = hasPrize && isWinner ? 'rgba(255,215,0,' : isWinner ? 'rgba(0,255,136,' : 'rgba(168,85,247,';
  const accentGlow = hasPrize && isWinner ? 'rgba(255,215,0,0.45)' : isWinner ? 'rgba(0,255,136,0.38)' : 'rgba(168,85,247,0.3)';

  // ── Headline copy ──────────────────────────────────────────────────────────
  const headline = isWinner
    ? isTie ? "IT'S A TIE!" : 'VICTORY!'
    : `${result.winnerUsername.toUpperCase()} WINS`;

  const sub = isWinner
    ? hasPrize ? 'Prize money added to your wallet' : isTie ? 'Well played — shared glory!' : 'You dominated the arena!'
    : isTie ? 'A fierce battle — honour shared.' : quote;

  return (
    <>
      {/* ── Confetti ── */}
      {showConfetti && isWinner && <Confetti gold={hasPrize} />}

      {/* ── Backdrop ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-6"
        style={{
          zIndex: 50,
          background: isWinner
            ? `radial-gradient(ellipse 90% 70% at 50% 30%, ${accentDim}0.12) 0%, rgba(0,0,0,0.97) 70%)`
            : 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(88,28,135,0.12) 0%, rgba(0,0,0,0.97) 70%)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* ── Outer glow halo for winners ── */}
        {isWinner && (
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.97, 1.02, 0.97] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: 36,
              background: 'transparent',
              boxShadow: `0 0 80px 20px ${accentGlow}, 0 0 160px 40px ${accentDim}0.12)`,
              pointerEvents: 'none',
              maxWidth: 520,
              margin: 'auto',
              alignSelf: 'center',
            }}
          />
        )}

        {/* ── Card ── */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 80, rotateX: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.05 }}
          className="w-full overflow-hidden relative"
          style={{
            maxWidth: 480,
            borderRadius: 32,
            background: isWinner
              ? `linear-gradient(170deg, #0f0e1a 0%, #0a0c14 50%, #0d1020 100%)`
              : 'linear-gradient(170deg, #0c0a1a 0%, #080a14 55%, #0a0c18 100%)',
            border: `1px solid ${accentDim}0.35)`,
            boxShadow: `
              0 0 0 1px ${accentDim}0.08),
              0 0 60px ${accentDim}0.2),
              0 40px 100px rgba(0,0,0,0.9),
              inset 0 1px 0 ${accentDim}0.22)
            `,
          }}
        >
          {/* Animated top accent bar */}
          <div style={{ height: 4, position: 'relative', overflow: 'hidden', background: `${accentDim}0.15)` }}>
            <motion.div
              style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.8, delay: 0.4, repeat: Infinity, repeatDelay: 2.5 }}
            />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${accentDim}0.5), ${accent}, ${accentDim}0.5))` }} />
          </div>

          {/* ── HERO SECTION ── */}
          <div className="relative pt-10 pb-7 px-6 text-center overflow-hidden">
            {/* Background glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accentDim}0.18) 0%, transparent 70%)`,
            }} />
            <AmbientStars color={accent} count={isWinner ? 26 : 14} />

            {/* Trophy / Icon */}
            <div className="relative flex justify-center mb-5" style={{ height: 120 }}>
              {/* Rays */}
              {isWinner && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SunRays color={accent} size={220} />
                </div>
              )}

              {/* Burst on mount */}
              {isWinner && <BurstParticles color={accent} />}

              {/* Main icon */}
              <motion.div
                animate={isWinner ? {
                  y: [0, -14, 0, -8, 0, -5, 0],
                  rotate: [-2, 2, -1.5, 1.5, -1, 0.5, 0],
                  scale: [1, 1.08, 1, 1.04, 1],
                } : { y: [0, -4, 0], scale: [1, 1.03, 1] }}
                transition={{ duration: isWinner ? 1.4 : 3, delay: 0.3, ease: 'easeInOut', repeat: Infinity, repeatDelay: isWinner ? 2 : 4 }}
                style={{
                  fontSize: 96,
                  lineHeight: 1,
                  filter: `drop-shadow(0 0 ${isWinner ? 32 : 16}px ${accent}aa)`,
                  position: 'relative', zIndex: 2,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {isWinner
                  ? (isTie ? '🤝' : hasPrize ? '💰' : '🏆')
                  : '⚔️'}
              </motion.div>
            </div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.75 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 220, damping: 18 }}
              className="relative z-10"
            >
              <h1
                className="font-black leading-none tracking-tight"
                style={{
                  fontSize: isWinner ? 42 : 30,
                  letterSpacing: isWinner ? '-1px' : '-0.5px',
                  background: isWinner
                    ? hasPrize
                      ? 'linear-gradient(135deg, #fff7ae 0%, #ffd700 40%, #f59e0b 70%, #ffd700 100%)'
                      : 'linear-gradient(135deg, #a7ffcc 0%, #00ff88 40%, #00cc6a 70%, #00ff88 100%)'
                    : 'linear-gradient(135deg, #e9d5ff 0%, #a855f7 50%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none',
                  filter: `drop-shadow(0 0 ${isWinner ? 20 : 12}px ${accentDim}0.5))`,
                }}
              >
                {headline}
              </h1>

              {/* Sub-headline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="mt-3 text-sm font-medium leading-relaxed"
                style={{ color: isWinner ? `${accentDim}0.7)` : 'rgba(196,181,253,0.65)', maxWidth: 320, margin: '12px auto 0' }}
              >
                {sub}
              </motion.p>
            </motion.div>
          </div>

          {/* ── PRIZE BANNER (winner + cash game) ── */}
          {hasPrize && isWinner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 200 }}
              className="mx-4 mb-5 rounded-2xl relative overflow-hidden text-center py-5 px-4"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.14), rgba(245,158,11,0.06))',
                border: '1px solid rgba(255,215,0,0.4)',
                boxShadow: '0 0 30px rgba(255,215,0,0.12)',
              }}
            >
              <Shimmer color="rgba(255,215,0,0.14)" delay={1.1} repeatDelay={2.5} />
              <p className="text-[10px] font-black uppercase tracking-[0.24em] mb-2" style={{ color: 'rgba(255,215,0,0.5)' }}>Prize Won</p>
              <motion.p
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.9, type: 'spring', stiffness: 260 }}
                className="font-black"
                style={{ fontSize: 64, lineHeight: 1, color: gold, textShadow: `0 0 40px ${gold}80, 0 0 80px ${gold}40`, letterSpacing: '-2px' }}
              >
                ₹<CountUp target={prizeWon} duration={1300} />
              </motion.p>
              <p className="text-xs mt-2 font-semibold" style={{ color: 'rgba(255,215,0,0.45)' }}>✓ Credited to your wallet</p>
            </motion.div>
          )}

          {/* ── PRIZE INFO (loser, cash game) ── */}
          {hasPrize && !isWinner && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mx-4 mb-4 rounded-2xl px-5 py-3 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div>
                <p className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'rgba(255,255,255,0.25)' }}>Prize Pool</p>
                <p className="text-xl font-black" style={{ color: '#fbbf24' }}>₹{result.prizePool?.toLocaleString('en-IN')}</p>
              </div>
              <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'rgba(255,255,255,0.25)' }}>Winner Gets</p>
                <p className="text-xl font-black" style={{ color: '#fbbf24' }}>₹{prizeWon.toLocaleString('en-IN')}</p>
              </div>
            </motion.div>
          )}

          {/* ── SCOREBOARD ── */}
          <div className="px-4 pb-4">
            <p className="text-[9px] font-black uppercase tracking-[0.26em] mb-3 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Final Standings
            </p>

            <div className="space-y-2">
              {sortedScores.map((s, i) => {
                const isRow1Winner = winnerIds.includes(s.playerId);
                const isMe = s.playerId === user?.id;
                const rank = i + 1;

                const rankColor = isRow1Winner
                  ? hasPrize ? gold : green
                  : rank === 2 ? '#c0c8d8' : rank === 3 ? '#cd9060' : 'rgba(255,255,255,0.4)';

                const rankLabel = isRow1Winner
                  ? isTie ? '🤝' : '👑'
                  : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                return (
                  <motion.div
                    key={s.playerId}
                    initial={{ opacity: 0, x: -30, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 280, damping: 22 }}
                    className="relative overflow-hidden"
                    style={{
                      borderRadius: isRow1Winner ? 18 : 14,
                      background: isRow1Winner
                        ? hasPrize
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(245,158,11,0.07) 100%)'
                          : 'linear-gradient(135deg, rgba(0,255,136,0.12) 0%, rgba(0,204,106,0.06) 100%)'
                        : isMe
                          ? 'rgba(168,85,247,0.08)'
                          : 'rgba(255,255,255,0.03)',
                      border: isRow1Winner
                        ? `1px solid ${accentDim}${hasPrize ? '0.4)' : '0.35)'}`
                        : isMe
                          ? '1px solid rgba(168,85,247,0.2)'
                          : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isRow1Winner
                        ? `0 4px 20px ${accentDim}0.15), inset 0 1px 0 ${accentDim}0.18)`
                        : 'none',
                      padding: isRow1Winner ? '14px 14px' : '10px 12px',
                    }}
                  >
                    {isRow1Winner && <Shimmer color={hasPrize ? 'rgba(255,215,0,0.1)' : 'rgba(0,255,136,0.1)'} delay={1.5 + i * 0.3} repeatDelay={4} />}

                    <div className="flex items-center gap-3 relative z-10">
                      {/* Rank */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center font-black"
                        style={{
                          width: isRow1Winner ? 38 : 30,
                          height: isRow1Winner ? 38 : 30,
                          borderRadius: isRow1Winner ? '50%' : 8,
                          background: isRow1Winner
                            ? `linear-gradient(135deg, ${rankColor}30, ${rankColor}15)`
                            : 'rgba(255,255,255,0.06)',
                          border: `${isRow1Winner ? 2 : 1}px solid ${rankColor}${isRow1Winner ? '55' : '30'}`,
                          fontSize: isRow1Winner ? 18 : 13,
                          boxShadow: isRow1Winner ? `0 0 14px ${rankColor}40` : 'none',
                          color: rankColor,
                        }}
                      >
                        {rankLabel}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate font-bold"
                            style={{
                              fontSize: isRow1Winner ? 16 : 13,
                              color: isRow1Winner ? (hasPrize ? gold : green) : isMe ? '#c4b5fd' : 'rgba(255,255,255,0.7)',
                            }}
                          >
                            {s.username}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(168,85,247,0.2)', color: purple, border: '1px solid rgba(168,85,247,0.3)' }}>
                              YOU
                            </span>
                          )}
                          {isRow1Winner && isTie && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(0,255,136,0.15)', color: green, border: '1px solid rgba(0,255,136,0.3)' }}>
                              TIE
                            </span>
                          )}
                        </div>
                        {isRow1Winner && (
                          <p className="text-[10px] mt-0.5" style={{ color: `${accentDim}0.5)` }}>
                            {hasPrize ? `₹${prizeWon.toLocaleString('en-IN')} prize` : 'Champion of this round'}
                          </p>
                        )}
                      </div>

                      {/* Score */}
                      <div className="text-right flex-shrink-0">
                        <span
                          className="font-black"
                          style={{
                            fontSize: isRow1Winner ? 22 : 16,
                            color: isRow1Winner ? (hasPrize ? gold : green) : 'rgba(255,255,255,0.35)',
                            textShadow: isRow1Winner ? `0 0 16px ${accentDim}0.6)` : 'none',
                          }}
                        >
                          {s.totalScore}
                        </span>
                        <span className="text-[10px] font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.25)' }}>pts</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── LOSER MOTIVATION BOX ── */}
          {!isWinner && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mx-4 mb-4 rounded-2xl px-5 py-4 flex items-start gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(88,28,135,0.18), rgba(55,20,100,0.1))',
                border: '1px solid rgba(168,85,247,0.2)',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>💜</span>
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(168,85,247,0.7)' }}>Arena Wisdom</p>
                <p className="text-sm font-semibold leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{quote}</p>
              </div>
            </motion.div>
          )}

          {/* ── CTA BUTTON ── */}
          <div className="px-4 pb-5">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, type: 'spring', stiffness: 220 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-base relative overflow-hidden"
              style={
                isWinner && hasPrize
                  ? {
                      background: 'linear-gradient(135deg, #ffd700 0%, #fbbf24 50%, #f59e0b 100%)',
                      color: '#0d1117',
                      boxShadow: '0 8px 32px rgba(255,215,0,0.5), 0 2px 8px rgba(0,0,0,0.5)',
                      letterSpacing: '0.02em',
                    }
                  : isWinner
                    ? {
                        background: 'linear-gradient(135deg, #00ff88 0%, #00e07a 50%, #00cc6a 100%)',
                        color: '#051a0e',
                        boxShadow: '0 8px 32px rgba(0,255,136,0.42), 0 2px 8px rgba(0,0,0,0.5)',
                        letterSpacing: '0.02em',
                      }
                    : {
                        background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(124,58,237,0.15))',
                        color: '#c4b5fd',
                        border: '1px solid rgba(168,85,247,0.4)',
                        boxShadow: '0 4px 20px rgba(168,85,247,0.2)',
                        letterSpacing: '0.02em',
                      }
              }
            >
              {isWinner && (
                <Shimmer color="rgba(255,255,255,0.3)" delay={0.9} repeatDelay={2} />
              )}
              <span className="relative z-10">
                {isWinner && hasPrize
                  ? '💰 Claim Victory & Return'
                  : isWinner
                    ? '🏆 Back to Arena'
                    : '⚔️ Rise Again'}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
