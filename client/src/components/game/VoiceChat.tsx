import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useVoiceChat } from '../../hooks/useVoiceChat';

function MicIcon({ muted, className }: { muted: boolean; className?: string }) {
  return muted ? (
    // Mic with strikethrough
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0019 12v-1" />
      <path d="M5 10v2a7 7 0 007 7" />
      <path d="M12 19v3" />
      <path d="M8 23h8" />
      <path d="M11 5H9a3 3 0 00-3 3v3" />
      <path d="M15 9V8a3 3 0 00-3-3" />
      <path d="M12 12v-2" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SpeakingRing({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: [0.8, 0.3, 0.8], scale: [1, 1.25, 1] }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full border-2 border-neon-green pointer-events-none"
        />
      )}
    </AnimatePresence>
  );
}

export function VoiceChat() {
  const {
    isInVoice, isJoining, isMuted, isSpeaking,
    participants, permissionError,
    joinVoice, leaveVoice, toggleMute,
  } = useVoiceChat();

  const [showError, setShowError] = useState(false);

  const handleJoin = async () => {
    setShowError(false);
    await joinVoice();
    if (permissionError) setShowError(true);
  };

  // ── NOT in voice: join button ────────────────────────────────────────────
  if (!isInVoice) {
    return (
      <div className="relative">
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleJoin}
          disabled={isJoining}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          title="Join voice chat"
        >
          {isJoining ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="block w-3.5 h-3.5 rounded-full border-2 border-dark-muted border-t-neon-green"
            />
          ) : (
            <MicIcon muted={false} className="w-3.5 h-3.5 text-dark-muted" />
          )}
          <span className="text-dark-muted text-[11px] font-medium">Voice</span>
        </motion.button>

        {/* Permission error tooltip */}
        <AnimatePresence>
          {showError && permissionError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute top-full mt-1.5 right-0 z-50 text-xs text-neon-red bg-dark-surface border border-neon-red/30 rounded-xl px-3 py-2 whitespace-nowrap shadow-lg"
            >
              {permissionError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── IN voice: controls + participant avatars ──────────────────────────────
  return (
    <div className="flex items-center gap-1.5">
      {/* Participant speaking chips */}
      <AnimatePresence>
        {participants.map(p => (
          <motion.div
            key={p.userId}
            initial={{ opacity: 0, scale: 0.6, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 'auto' }}
            exit={{ opacity: 0, scale: 0.6, width: 0 }}
            className="relative flex-shrink-0"
          >
            <div className={clsx(
              'relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white',
              p.isSpeaking ? 'bg-neon-green text-dark-bg' : 'bg-dark-border',
            )}>
              {p.username.slice(0, 2).toUpperCase()}
              <SpeakingRing active={p.isSpeaking} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Self speaking indicator + mic button */}
      <div className="relative flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          className={clsx(
            'relative w-7 h-7 rounded-xl flex items-center justify-center transition-all',
            isMuted
              ? 'bg-neon-red/20 border border-neon-red/50'
              : 'bg-neon-green/15 border border-neon-green/40',
          )}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <MicIcon
            muted={isMuted}
            className={clsx('w-3.5 h-3.5', isMuted ? 'text-neon-red' : 'text-neon-green')}
          />
          {/* Speaking pulse on mic button */}
          {!isMuted && isSpeaking && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="absolute inset-0 rounded-xl border-2 border-neon-green"
            />
          )}
        </motion.button>
      </div>

      {/* Leave voice */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={leaveVoice}
        className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors text-[10px]"
        style={{ background: 'rgba(255,59,92,0.15)', border: '1px solid rgba(255,59,92,0.35)', color: '#ff3b5c' }}
        title="Leave voice"
      >
        ✕
      </motion.button>
    </div>
  );
}
