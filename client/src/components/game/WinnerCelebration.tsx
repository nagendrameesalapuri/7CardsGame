import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MatchResult } from '../../types';
import { useAuthStore } from '../../store/authStore';

function Confetti({ gold }: { gold?: boolean }) {
  const pieces = Array.from({ length: 110 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: gold
      ? ['#ffd700', '#ffec6e', '#fbbf24', '#f59e0b', '#fff7ae', '#ffffff'][Math.floor(Math.random() * 6)]
      : ['#00ff88', '#ffd700', '#00bfff', '#ff3b5c', '#bf00ff', '#ff9500', '#ffffff'][Math.floor(Math.random() * 7)],
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2.5,
    size: 4 + Math.random() * 12,
    rotate: Math.random() * 360,
    shape: Math.floor(Math.random() * 3),
    drift: (Math.random() - 0.5) * 80,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: '-5%', x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            y: '115vh',
            x: `calc(${p.x}vw + ${p.drift}px)`,
            opacity: [1, 1, 0.7, 0],
            rotate: p.rotate * 5,
            scale: [1, 0.9, 0.5, 0.2],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.shape === 2 ? p.size * 2 : p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 0 ? '50%' : '2px',
            boxShadow: `0 0 ${p.size / 2}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

function CountUp({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val.toLocaleString('en-IN')}</>;
}

function StarField({ accent }: { accent: string }) {
  const stars = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 3,
    delay: Math.random() * 2,
    duration: 1.5 + Math.random() * 2,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map(s => (
        <motion.div
          key={s.id}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            backgroundColor: accent,
            boxShadow: `0 0 ${s.size * 3}px ${accent}`,
          }}
        />
      ))}
    </div>
  );
}

function RankBadge({ rank, isWinner, hasPrize, isTie }: { rank: number; isWinner: boolean; hasPrize: boolean; isTie: boolean }) {
  if (isWinner) {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
        style={{
          background: hasPrize
            ? 'linear-gradient(135deg, #ffd700, #f59e0b)'
            : 'linear-gradient(135deg, #00ff88, #00cc6a)',
          boxShadow: hasPrize
            ? '0 0 14px rgba(255,215,0,0.65)'
            : '0 0 14px rgba(0,255,136,0.55)',
        }}
      >
        {isTie ? '🤝' : '👑'}
      </div>
    );
  }
  const bg: Record<number, string> = {
    2: 'linear-gradient(135deg, #9ca3af, #6b7280)',
    3: 'linear-gradient(135deg, #cd7f32, #92400e)',
  };
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
      style={{ background: bg[rank] ?? 'rgba(255,255,255,0.08)', color: '#fff' }}
    >
      #{rank}
    </div>
  );
}

export function WinnerCelebration({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  const { user } = useAuthStore();
  const winnerIds = result.winnerIds ?? [result.winnerId];
  const isTie = winnerIds.length > 1;
  const isWinner = !!user && winnerIds.includes(user.id);
  const hasPrize = (result.prizePool ?? 0) > 0;
  const prizeWon = result.prizePerWinner ?? 0;

  const [showConfetti, setShowConfetti] = useState(true);
  const [prizePulse, setPrizePulse] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 6000);
    const p = setTimeout(() => setPrizePulse(true), 1200);
    return () => { clearTimeout(t); clearTimeout(p); };
  }, []);

  const sortedScores = [...result.finalScores].sort((a, b) => a.totalScore - b.totalScore);

  const accent = hasPrize && isWinner ? '#ffd700' : isWinner ? '#00ff88' : '#818cf8';
  const accentDim = hasPrize && isWinner ? 'rgba(255,215,0,' : isWinner ? 'rgba(0,255,136,' : 'rgba(129,140,248,';

  return (
    <>
      {showConfetti && <Confetti gold={hasPrize && isWinner} />}

      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(18px)' }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 70 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 210, damping: 22 }}
          className="w-full max-w-md overflow-hidden relative"
          style={{
            borderRadius: '28px',
            background: 'linear-gradient(170deg, #0f1520 0%, #0d1117 55%, #111827 100%)',
            border: `1px solid ${accentDim}0.3)`,
            boxShadow: `0 0 80px ${accentDim}0.18), 0 30px 80px rgba(0,0,0,0.85), inset 0 1px 0 ${accentDim}0.2)`,
          }}
        >
          {/* Top shimmer line */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, delay: 0.5, repeat: Infinity, repeatDelay: 3.5 }}
            style={{
              height: '2px',
              background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
              borderRadius: '28px 28px 0 0',
            }}
          />

          {/* Hero */}
          <div className="relative pt-10 pb-6 px-6 text-center overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% -10%, ${accentDim}0.22) 0%, transparent 65%)`,
              }}
            />
            <StarField accent={accent} />

            {/* Trophy */}
            <motion.div
              animate={{
                y: [0, -16, 0, -9, 0],
                rotate: [-3, 3, -2, 2, 0],
                scale: [1, 1.1, 1, 1.05, 1],
              }}
              transition={{ duration: 1.3, delay: 0.2, ease: 'easeInOut' }}
              className="relative z-10 mb-4"
              style={{ filter: `drop-shadow(0 0 28px ${accent}99)` }}
            >
              <span style={{ fontSize: 84, lineHeight: 1 }}>
                {isWinner ? (isTie ? '🤝' : hasPrize ? '💰' : '🏆') : '🎮'}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 22, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.38, type: 'spring', stiffness: 230 }}
              className="text-3xl font-black relative z-10 leading-tight"
              style={{
                background: isWinner
                  ? hasPrize
                    ? 'linear-gradient(135deg, #fff7ae 0%, #ffd700 45%, #f59e0b 100%)'
                    : 'linear-gradient(135deg, #a7ffcc 0%, #00ff88 45%, #00cc6a 100%)'
                  : 'linear-gradient(135deg, #c7d2fe 0%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {isWinner
                ? isTie ? "It's a Tie!" : 'You Won! 🎉'
                : isTie
                  ? `${result.winnerUsername} Tie!`
                  : `${result.winnerUsername} Wins!`}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm mt-2 relative z-10 font-medium"
              style={{ color: 'rgba(255,255,255,0.42)' }}
            >
              {isWinner
                ? hasPrize ? '💸 Prize money added to your wallet' : 'Congratulations on the win!'
                : 'Better luck next time!'}
            </motion.p>
          </div>

          {/* Prize banner */}
          {hasPrize && (
            <motion.div
              initial={{ opacity: 0, scale: 0.84, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 210 }}
              className="mx-4 mb-5 rounded-2xl relative overflow-hidden"
              style={{
                background: isWinner
                  ? 'linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(245,158,11,0.07) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: isWinner
                  ? '1px solid rgba(255,215,0,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {isWinner && (
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, delay: 1.1, repeat: Infinity, repeatDelay: 2.5 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.12) 50%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {isWinner ? (
                <div className="p-5 text-center relative">
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.22em] mb-3"
                    style={{ color: 'rgba(255,215,0,0.55)' }}
                  >
                    Prize Won
                  </p>
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{
                      scale: prizePulse ? [1, 1.07, 1] : 1,
                      opacity: 1,
                    }}
                    transition={prizePulse
                      ? { duration: 0.5, repeat: 2, repeatType: 'mirror' }
                      : { delay: 0.85, type: 'spring', stiffness: 240 }}
                    className="text-6xl font-black"
                    style={{
                      color: '#ffd700',
                      textShadow: '0 0 40px rgba(255,215,0,0.6), 0 0 80px rgba(255,215,0,0.3)',
                      letterSpacing: '-1px',
                    }}
                  >
                    ₹<CountUp target={prizeWon} duration={1300} />
                  </motion.div>
                  <p className="text-xs mt-2 font-semibold" style={{ color: 'rgba(255,215,0,0.48)' }}>
                    ✓ Added to your wallet
                  </p>
                </div>
              ) : (
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                      style={{ color: 'rgba(255,255,255,0.28)' }}>Prize Pool</p>
                    <p className="text-2xl font-black" style={{ color: '#fbbf24' }}>
                      ₹{result.prizePool?.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                      style={{ color: 'rgba(255,255,255,0.28)' }}>Winner Gets</p>
                    <p className="text-2xl font-black" style={{ color: '#fbbf24' }}>
                      ₹{prizeWon.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Final scores */}
          <div className="px-4 pb-3">
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em] mb-3 text-center"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              Final Scores
            </p>
            <div className="space-y-2">
              {sortedScores.map((s, i) => {
                const isPlayerWinner = winnerIds.includes(s.playerId);
                const rank = i + 1;
                const rowAccent = isPlayerWinner
                  ? hasPrize ? 'rgba(255,215,0,' : 'rgba(0,255,136,'
                  : rank === 2 ? 'rgba(156,163,175,' : rank === 3 ? 'rgba(205,127,50,' : 'rgba(255,255,255,';

                return (
                  <motion.div
                    key={s.playerId}
                    initial={{ opacity: 0, x: -26 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.1, type: 'spring', stiffness: 270 }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl relative overflow-hidden"
                    style={{
                      background: isPlayerWinner
                        ? hasPrize
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(245,158,11,0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,204,106,0.05) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${rowAccent}${isPlayerWinner ? '0.28)' : '0.06)'}`,
                    }}
                  >
                    {isPlayerWinner && (
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2.2, delay: 0.9 + i * 0.1, repeat: Infinity, repeatDelay: 4 }}
                        style={{
                          position: 'absolute', inset: 0,
                          background: `linear-gradient(90deg, transparent, ${hasPrize ? 'rgba(255,215,0,0.07)' : 'rgba(0,255,136,0.07)'}, transparent)`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    <RankBadge rank={rank} isWinner={isPlayerWinner} hasPrize={hasPrize} isTie={isTie} />
                    <span
                      className="flex-1 font-bold text-sm truncate"
                      style={{
                        color: isPlayerWinner
                          ? hasPrize ? '#ffd700' : '#00ff88'
                          : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {s.username}
                    </span>
                    {isPlayerWinner && isTie && (
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-black"
                        style={{
                          background: 'rgba(0,255,136,0.14)',
                          color: '#00ff88',
                          border: '1px solid rgba(0,255,136,0.3)',
                        }}
                      >
                        TIE
                      </span>
                    )}
                    <span
                      className="text-sm font-black flex-shrink-0"
                      style={{
                        color: isPlayerWinner
                          ? hasPrize ? '#ffd700' : '#00ff88'
                          : 'rgba(255,255,255,0.38)',
                      }}
                    >
                      {s.totalScore} pts
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* CTA button */}
          <div className="p-4 pt-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-base relative overflow-hidden"
              style={
                isWinner && hasPrize
                  ? {
                      background: 'linear-gradient(135deg, #ffd700 0%, #fbbf24 50%, #f59e0b 100%)',
                      color: '#0d1117',
                      boxShadow: '0 8px 32px rgba(255,215,0,0.45), 0 2px 8px rgba(0,0,0,0.4)',
                    }
                  : isWinner
                    ? {
                        background: 'linear-gradient(135deg, #00ff88 0%, #00e07a 50%, #00cc6a 100%)',
                        color: '#0d1117',
                        boxShadow: '0 8px 32px rgba(0,255,136,0.38), 0 2px 8px rgba(0,0,0,0.4)',
                      }
                    : {
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                        color: 'rgba(255,255,255,0.8)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }
              }
            >
              {isWinner && (
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <span className="relative z-10">
                {isWinner && hasPrize ? '💰 Back to Lobby' : isWinner ? '🏆 Back to Lobby' : 'Back to Lobby'}
              </span>
            </motion.button>
          </div>

          <div className="h-1" />
        </motion.div>
      </div>
    </>
  );
}
