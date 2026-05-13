import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchResult } from '../../types';
import { useAuthStore } from '../../store/authStore';

function Confetti({ gold }: { gold?: boolean }) {
  const pieces = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: gold
      ? ['#ffd700', '#ffec6e', '#fbbf24', '#f59e0b', '#ffffff'][Math.floor(Math.random() * 5)]
      : ['#00ff88', '#ffd700', '#00bfff', '#ff3b5c', '#bf00ff', '#ffffff'][Math.floor(Math.random() * 6)],
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 2,
    size: 5 + Math.random() * 10,
    rotate: Math.random() * 360,
    shape: Math.random() > 0.5,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: '-5%', x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ y: '110vh', opacity: 0, rotate: p.rotate * 4, scale: 0.3 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape ? '50%' : '2px',
            boxShadow: `0 0 ${p.size / 2}px ${p.color}88`,
          }}
        />
      ))}
    </div>
  );
}

// Animated number counter
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

export function WinnerCelebration({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  const { user } = useAuthStore();
  const winnerIds = result.winnerIds ?? [result.winnerId];
  const isTie = winnerIds.length > 1;
  const isWinner = !!user && winnerIds.includes(user.id);
  const hasPrize = (result.prizePool ?? 0) > 0;
  const prizeWon = result.prizePerWinner ?? 0;

  const [showConfetti, setShowConfetti] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const sortedScores = [...result.finalScores].sort((a, b) => a.totalScore - b.totalScore);

  return (
    <>
      {showConfetti && <Confetti gold={hasPrize && isWinner} />}

      <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>

        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
          className="w-full max-w-md overflow-hidden rounded-3xl shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)',
            border: hasPrize && isWinner
              ? '1px solid rgba(255,215,0,0.4)'
              : '1px solid rgba(255,255,255,0.08)',
            boxShadow: hasPrize && isWinner
              ? '0 0 60px rgba(255,215,0,0.15), 0 25px 60px rgba(0,0,0,0.6)'
              : '0 25px 60px rgba(0,0,0,0.6)',
          }}
        >

          {/* ── Hero section ── */}
          <div className="relative pt-8 pb-5 px-6 text-center overflow-hidden">
            {/* Glow background */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: isWinner
                  ? hasPrize
                    ? 'radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.18) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse at 50% 0%, rgba(0,255,136,0.15) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at 50% 0%, rgba(100,100,255,0.1) 0%, transparent 70%)',
              }}
            />

            {/* Trophy / emoji */}
            <motion.div
              animate={{ y: [0, -12, 0], rotate: [-4, 4, -2, 0] }}
              transition={{ repeat: 2, duration: 0.6, delay: 0.3 }}
              className="text-8xl mb-3 relative z-10"
            >
              {isWinner ? (isTie ? '🤝' : hasPrize ? '💰' : '🏆') : '🎮'}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-3xl font-bold relative z-10"
              style={{ color: isWinner ? (hasPrize ? '#ffd700' : '#00ff88') : '#e6edf3' }}
            >
              {isWinner
                ? isTie ? "It's a Tie!" : 'You Won!'
                : isTie
                  ? `${result.winnerUsername} Tie!`
                  : `${result.winnerUsername} Wins!`}
            </motion.h1>
            <p className="text-sm mt-1 relative z-10" style={{ color: '#8b949e' }}>
              {isWinner
                ? hasPrize ? 'Prize money has been added to your wallet!' : 'Congratulations! 🎉'
                : 'Better luck next time!'}
            </p>
          </div>

          {/* ── Prize banner (cash games only) ── */}
          {hasPrize && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              className="mx-4 mb-4 rounded-2xl overflow-hidden"
              style={{
                background: isWinner
                  ? 'linear-gradient(135deg, rgba(255,215,0,0.18) 0%, rgba(251,191,36,0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                border: isWinner ? '1px solid rgba(255,215,0,0.35)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {isWinner ? (
                /* Winner prize card */
                <div className="p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(255,215,0,0.7)' }}>
                    Prize Won
                  </p>
                  <motion.p
                    className="text-5xl font-bold"
                    style={{ color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.5)' }}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.7, type: 'spring', stiffness: 250 }}
                  >
                    ₹<CountUp target={prizeWon} duration={1200} />
                  </motion.p>
                  <p className="text-xs mt-1.5" style={{ color: 'rgba(255,215,0,0.55)' }}>
                    Added to your wallet ✓
                  </p>
                </div>
              ) : (
                /* Non-winner sees the pot size */
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-dark-muted uppercase tracking-wide">Prize Pool</p>
                    <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>₹{result.prizePool?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dark-muted uppercase tracking-wide">Winner Gets</p>
                    <p className="text-lg font-bold" style={{ color: '#fbbf24' }}>₹{prizeWon.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Final scores ── */}
          <div className="px-4 pb-2">
            <p className="text-xs text-dark-muted uppercase tracking-widest mb-2 text-center">Final Scores</p>
            <div className="space-y-1.5">
              {sortedScores.map((s, i) => {
                const isPlayerWinner = winnerIds.includes(s.playerId);
                return (
                  <motion.div
                    key={s.playerId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{
                      background: isPlayerWinner
                        ? hasPrize
                          ? 'rgba(255,215,0,0.07)'
                          : 'rgba(0,255,136,0.07)'
                        : 'rgba(255,255,255,0.03)',
                      border: isPlayerWinner
                        ? hasPrize
                          ? '1px solid rgba(255,215,0,0.2)'
                          : '1px solid rgba(0,255,136,0.2)'
                        : '1px solid transparent',
                    }}
                  >
                    <span className="w-6 text-center text-sm flex-shrink-0">
                      {isPlayerWinner ? (isTie ? '🤝' : hasPrize ? '💰' : '👑') : `#${i + 1}`}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate"
                      style={{ color: isPlayerWinner ? (hasPrize ? '#ffd700' : '#00ff88') : '#e6edf3' }}>
                      {s.username}
                    </span>
                    {isPlayerWinner && isTie && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}>TIE</span>
                    )}
                    <span className="text-sm font-bold flex-shrink-0"
                      style={{ color: isPlayerWinner ? (hasPrize ? '#ffd700' : '#00ff88') : '#8b949e' }}>
                      {s.totalScore} pts
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="p-4 pt-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl font-bold text-base transition-all"
              style={
                isWinner && hasPrize
                  ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117', boxShadow: '0 4px 20px rgba(251,191,36,0.35)' }
                  : isWinner
                    ? { background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#0d1117', boxShadow: '0 4px 20px rgba(0,255,136,0.3)' }
                    : { background: 'rgba(255,255,255,0.08)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' }
              }
            >
              {isWinner && hasPrize ? '💰 Back to Lobby' : isWinner ? '🏆 Back to Lobby' : 'Back to Lobby'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
