import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';

export function ShowButton() {
  const { canShow, showConfirmVisible, setShowConfirmVisible, callShow, handTotal } = useGameStore();

  if (!canShow) return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowConfirmVisible(true)}
        className={clsx(
          'relative w-full py-2 sm:py-2.5 rounded-xl font-bold text-base shadow-xl transition-all',
          'bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 text-dark-bg',
          'border-2 border-yellow-300 shadow-neon-gold',
          'animate-pulse-neon'
        )}
      >
        <span className="relative z-10 tracking-wide">🎯 SHOW!</span>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-200/20 via-transparent to-yellow-200/20" />
      </motion.button>

      <Modal
        isOpen={showConfirmVisible}
        onClose={() => setShowConfirmVisible(false)}
        title="Call SHOW?"
        size="sm"
      >
        <div className="text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-dark-text mb-2">
            Your hand total is <span className="font-bold text-neon-green text-xl">{handTotal} points</span>
          </p>
          <p className="text-dark-muted text-sm mb-6">
            All players will reveal their cards. If you don't have the lowest score,
            you'll receive everyone else's points as penalty!
          </p>

          <div className="bg-dark-bg rounded-xl p-3 mb-6 text-sm text-dark-muted">
            <p>✅ Win: Your hand is the lowest → 0 points</p>
            <p>❌ Lose: Someone has lower → You pay all opponents' totals</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmVisible(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-dark-border text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={callShow}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 text-dark-bg font-bold hover:from-yellow-300 hover:to-orange-300 transition-all shadow-neon-gold"
            >
              Yes, SHOW!
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
