import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressionStore } from '../store/progressionStore';
import { notify } from '../services/notify';

const DAY_EMOJIS = ['👋', '🔥', '⚡', '💫', '🌟', '✨', '🏆'];
const RARITY_COLOR: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a855f7',
  legendary: '#fbbf24',
};

export function DailyLoginModal({ onClose }: { onClose: () => void }) {
  const { claimDaily } = useProgressionStore();
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [achIdx, setAchIdx] = useState(0);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const data = await claimDaily();
      setResult(data);
    } catch (err: any) {
      notify.error(err.response?.data?.error ?? 'Failed to claim reward');
      onClose();
    } finally {
      setClaiming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={() => result && onClose()}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="rounded-3xl overflow-hidden max-w-sm w-full"
        style={{ background: 'linear-gradient(135deg,#0d1022,#12091a)', border: '1px solid rgba(255,215,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {!result ? (
          <>
            {/* Pre-claim */}
            <div className="p-6 text-center space-y-4">
              <div className="text-5xl">🎁</div>
              <h2 className="text-xl font-black text-white">Daily Reward</h2>
              <p className="text-dark-muted text-sm">Come back every day to earn bigger rewards!</p>

              {/* 7-day preview */}
              <div className="grid grid-cols-7 gap-1 mt-2">
                {DAY_EMOJIS.map((emoji, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                      style={{ background: i === 6 ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 6 ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
                      {emoji}
                    </div>
                    <span className="text-[8px] text-dark-muted">D{i + 1}</span>
                  </div>
                ))}
              </div>

              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleClaim} disabled={claiming}
                className="w-full py-3 rounded-2xl font-black text-base disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#09090f' }}>
                {claiming ? '⏳ Claiming…' : '🎁 Claim Daily Reward'}
              </motion.button>
              <button onClick={onClose} className="text-xs text-dark-muted hover:text-white transition-colors w-full py-1">
                Remind me later
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Post-claim result */}
            <div className="p-6 text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.5 }}
                className="text-5xl">{result.reward.emoji}</motion.div>

              <div>
                <p className="text-xs text-dark-muted uppercase tracking-widest mb-1">Day {result.newDay} Reward</p>
                <h2 className="text-xl font-black text-white">{result.reward.label}</h2>
                <p className="text-dark-muted text-sm mt-1">
                  {result.loginStreak > 1 ? `🔥 ${result.loginStreak}-Day Login Streak!` : 'Keep coming back for bigger rewards!'}
                </p>
              </div>

              {/* Rewards breakdown */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <p className="text-lg font-black text-yellow-400">+{result.reward.points} pts</p>
                  <p className="text-[10px] text-dark-muted">≡ ₹{(result.reward.points / 100).toFixed(0)} wallet</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                  <p className="text-lg font-black text-blue-400">+{result.reward.xp} XP</p>
                  <p className="text-[10px] text-dark-muted">progression XP</p>
                </div>
              </div>

              {/* Level up / rank up */}
              {result.leveled && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <p className="text-green-400 font-bold text-sm">🎉 Level Up! → Level {result.newLevel}</p>
                </motion.div>
              )}
              {result.rankedUp && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
                  <p className="text-purple-400 font-bold text-sm">🏆 Rank Up! → {result.newRank.charAt(0).toUpperCase() + result.newRank.slice(1)}</p>
                </motion.div>
              )}

              {/* New achievements */}
              {result.newAchievements?.length > 0 && (
                <div className="space-y-1">
                  {result.newAchievements.map((ach: any) => (
                    <div key={ach.id} className="flex items-center gap-2 rounded-xl p-2"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <span className="text-xl">{ach.emoji}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold text-yellow-400">{ach.name} unlocked!</p>
                        <p className="text-[10px] text-dark-muted">{ach.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                Continue Playing →
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
