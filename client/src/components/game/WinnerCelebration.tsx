import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchResult } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface WinnerCelebrationProps {
  result: MatchResult;
  onClose: () => void;
}

function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#00ff88', '#ffd700', '#00bfff', '#ff3b5c', '#bf00ff'][Math.floor(Math.random() * 5)],
    delay: Math.random() * 1,
    duration: 1.5 + Math.random() * 2,
    size: 6 + Math.random() * 10,
    rotate: Math.random() * 360,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: '-10%', x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: p.rotate * 3 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}

export function WinnerCelebration({ result, onClose }: WinnerCelebrationProps) {
  const { user } = useAuthStore();
  const winnerIds = result.winnerIds ?? [result.winnerId];
  const isTie = winnerIds.length > 1;
  const isWinner = user && winnerIds.includes(user.id);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {showConfetti && <Confetti />}

      <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-dark-surface border border-dark-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-center"
        >
          {/* Trophy */}
          <div className="bg-gradient-to-b from-yellow-500/20 to-transparent pt-8 pb-4">
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [-5, 5, -5, 0] }}
              transition={{ repeat: 2, duration: 0.5 }}
              className="text-8xl mb-2"
            >
              {isWinner ? (isTie ? '🤝' : '🏆') : '🎮'}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white"
            >
              {isWinner
                ? (isTie ? "It's a Tie — You Win!" : 'You Won!')
                : isTie
                  ? `🤝 Tie — ${result.winnerUsername} Win!`
                  : `${result.winnerUsername} Wins!`}
            </motion.h1>
            <p className="text-dark-muted mt-1">
              {isWinner ? 'Congratulations! 🎉' : 'Better luck next time!'}
            </p>
          </div>

          {/* Final scores */}
          <div className="p-5 space-y-2">
            <h3 className="text-dark-muted text-sm uppercase tracking-wide mb-3">Final Scores</h3>
            {result.finalScores
              .sort((a, b) => a.totalScore - b.totalScore)
              .map((s, i) => (
                <motion.div
                  key={s.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center justify-between px-4 py-2 rounded-xl bg-dark-bg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-dark-muted text-sm">
                      {winnerIds.includes(s.playerId) ? (isTie ? '🤝' : '👑') : `#${i + 1}`}
                    </span>
                    <span className={winnerIds.includes(s.playerId) ? 'text-neon-green font-bold' : 'text-dark-text'}>
                      {s.username}
                    </span>
                    {winnerIds.includes(s.playerId) && isTie && (
                      <span className="text-[10px] bg-neon-green/20 text-neon-green px-1.5 py-0.5 rounded-full font-bold">TIE</span>
                    )}
                  </div>
                  <span className={winnerIds.includes(s.playerId) ? 'text-neon-green font-bold' : 'text-dark-muted'}>
                    {s.totalScore} pts
                  </span>
                </motion.div>
              ))}
          </div>

          {/* Actions */}
          <div className="p-5 pt-0 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-neon-green text-dark-bg font-bold rounded-xl hover:bg-green-400 transition-all active:scale-95"
            >
              Back to Lobby
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
