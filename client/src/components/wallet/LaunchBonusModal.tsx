import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walletApi } from '../../services/api';
import { notify } from '../../services/notify';

interface Props {
  onClaim: (aiPoints: number, bonusSpins: number) => void;
  onClose: () => void;
}

export function LaunchBonusModal({ onClaim, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1200);
    return () => clearInterval(t);
  }, []);

  async function handleClaim() {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const r = await walletApi.claimLaunchBonus();
      setClaimed(true);
      notify.success('🎉 Launch bonus claimed! 1 free spin + 250 AI points added!', { duration: 6000 });
      setTimeout(() => {
        onClaim(r.data.aiPoints, r.data.bonusSpins);
      }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to claim bonus';
      notify.error(msg);
      setClaiming(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.82)' }}
        onClick={() => !claiming && onClose()}
      />

      {/* card */}
      <motion.div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg,#1a1200 0%,#0d0d0d 40%,#130d00 100%)',
          border: '1.5px solid rgba(250,204,21,0.35)',
          boxShadow: '0 0 60px rgba(250,204,21,0.18), 0 0 120px rgba(250,204,21,0.08)',
        }}
        initial={{ scale: 0.75, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      >
        {/* shimmer stripe */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg,transparent 30%,rgba(250,204,21,0.06) 50%,transparent 70%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: 'linear', repeatDelay: 1.5 }}
        />

        {/* top glow bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,transparent,#facc15,transparent)' }} />

        <div className="relative p-6">
          {/* close */}
          {!claiming && !claimed && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 transition-colors text-lg"
            >
              ×
            </button>
          )}

          {/* emoji burst */}
          <AnimatePresence mode="wait">
            {!claimed ? (
              <motion.div key="pre" className="text-center mb-4">
                <motion.div
                  className="text-6xl mb-2 inline-block"
                  animate={{ rotate: pulse ? -8 : 8, scale: pulse ? 1.05 : 0.97 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                  🎁
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="post"
                className="text-center mb-4"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              >
                <div className="text-6xl mb-2">🎉</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* title */}
          <AnimatePresence mode="wait">
            {!claimed ? (
              <motion.div key="title-pre">
                <h2 className="text-center font-black text-xl mb-1" style={{ color: '#facc15' }}>
                  Spin Wheel Launch Bonus!
                </h2>
                <p className="text-center text-white/55 text-xs mb-5">
                  One-time gift to celebrate the Spin & Win launch
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="title-post"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-center font-black text-xl mb-1 text-emerald-400">
                  Bonus Claimed! 🎊
                </h2>
                <p className="text-center text-white/55 text-xs mb-5">
                  Check your wallet & AI points balance
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* reward cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* money spin card */}
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'linear-gradient(135deg,rgba(250,204,21,0.12),rgba(250,204,21,0.04))',
                border: '1px solid rgba(250,204,21,0.25)',
              }}
              animate={claimed ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <div className="text-3xl mb-1">🎰</div>
              <div className="font-black text-lg" style={{ color: '#facc15' }}>1</div>
              <div className="text-white/60 text-[10px] font-semibold uppercase tracking-wide">Free Money Spin</div>
              <div className="text-white/35 text-[9px] mt-0.5">Win up to ₹100!</div>
            </motion.div>

            {/* AI points card */}
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'linear-gradient(135deg,rgba(139,92,246,0.18),rgba(139,92,246,0.05))',
                border: '1px solid rgba(139,92,246,0.3)',
              }}
              animate={claimed ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="text-3xl mb-1">⭐</div>
              <div className="font-black text-lg text-violet-400">250</div>
              <div className="text-white/60 text-[10px] font-semibold uppercase tracking-wide">AI Points</div>
              <div className="text-white/35 text-[9px] mt-0.5">2.5 Points Spins!</div>
            </motion.div>
          </div>

          {/* note */}
          {!claimed && (
            <p className="text-center text-white/35 text-[10px] mb-4">
              ⚠️ This bonus can only be claimed once per account
            </p>
          )}

          {/* CTA button */}
          <AnimatePresence mode="wait">
            {!claimed ? (
              <motion.button
                key="btn-claim"
                onClick={handleClaim}
                disabled={claiming}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: claiming
                    ? 'rgba(250,204,21,0.4)'
                    : 'linear-gradient(135deg,#facc15,#f59e0b)',
                  color: '#0d0d0d',
                  boxShadow: claiming ? 'none' : '0 4px 20px rgba(250,204,21,0.35)',
                }}
                whileHover={!claiming ? { scale: 1.02 } : {}}
                whileTap={!claiming ? { scale: 0.97 } : {}}
              >
                {claiming ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                      className="inline-block"
                    >
                      ⏳
                    </motion.span>
                    Claiming…
                  </span>
                ) : (
                  '🎁 Claim My Bonus'
                )}
              </motion.button>
            ) : (
              <motion.button
                key="btn-done"
                onClick={onClose}
                className="w-full py-3 rounded-xl font-black text-sm tracking-wide"
                style={{
                  background: 'linear-gradient(135deg,#10b981,#059669)',
                  color: '#fff',
                  boxShadow: '0 4px 20px rgba(16,185,129,0.35)',
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                ✅ Awesome, Let's Spin!
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* bottom glow bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,transparent,#facc15,transparent)' }} />
      </motion.div>
    </motion.div>
  );
}
