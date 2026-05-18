import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BossIntroProps {
  onDismiss: () => void;
  enemyBotNames?: string[];
  teammateName?: string;
}

function SunRays() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'conic-gradient(from 0deg at 50% 50%,' +
          'rgba(239,68,68,0.12) 0deg,transparent 20deg,' +
          'rgba(239,68,68,0.08) 40deg,transparent 60deg,' +
          'rgba(239,68,68,0.12) 80deg,transparent 100deg,' +
          'rgba(239,68,68,0.08) 120deg,transparent 140deg,' +
          'rgba(239,68,68,0.12) 160deg,transparent 180deg,' +
          'rgba(239,68,68,0.08) 200deg,transparent 220deg,' +
          'rgba(239,68,68,0.12) 240deg,transparent 260deg,' +
          'rgba(239,68,68,0.08) 280deg,transparent 300deg,' +
          'rgba(239,68,68,0.12) 320deg,transparent 340deg,' +
          'rgba(239,68,68,0.08) 360deg)',
        animation: 'spin 24s linear infinite',
      }}
    />
  );
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  angle: (i / 24) * 360,
  dist: 80 + Math.random() * 80,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 1.5,
}));

export function BossIntro({ onDismiss, enemyBotNames, teammateName }: BossIntroProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        key="boss-intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
        onClick={onDismiss}
      >
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes pulse-red { 0%,100% { opacity:0.4; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
        `}</style>

        <div className="relative flex flex-col items-center text-center px-6" style={{ maxWidth: 380 }}>
          {/* Background sun rays */}
          <div className="absolute inset-0 -m-32">
            <SunRays />
          </div>

          {/* Burst particles */}
          <div className="absolute" style={{ width: 0, height: 0 }}>
            {PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                animate={{
                  x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
                  y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{ duration: 1.8, delay: p.delay, ease: 'easeOut' }}
                className="absolute rounded-full"
                style={{
                  width: p.size, height: p.size,
                  background: '#ef4444',
                  boxShadow: '0 0 6px #ef4444',
                  marginLeft: -p.size / 2, marginTop: -p.size / 2,
                }}
              />
            ))}
          </div>

          {/* Radial glow */}
          <div
            className="absolute inset-0 -m-20 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 50%,rgba(239,68,68,0.35) 0%,transparent 70%)',
              animation: 'pulse-red 2s ease-in-out infinite',
            }}
          />

          {/* Crown icon */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="relative z-10 mb-4"
            style={{ fontSize: 72, lineHeight: 1, filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.9))' }}
          >
            👑
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative z-10"
          >
            <p
              className="text-xs font-black tracking-widest uppercase mb-2"
              style={{ color: '#ef4444', letterSpacing: '0.25em' }}
            >
              ⚔ FINAL ARENA ⚔
            </p>
            <h1
              className="text-3xl font-black mb-2"
              style={{
                background: 'linear-gradient(135deg,#fbbf24,#ef4444,#dc2626)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
                lineHeight: 1.1,
              }}
            >
              The Boss<br />Has Arrived
            </h1>
          </motion.div>

          {/* Enemy names */}
          {enemyBotNames && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="relative z-10 mt-3 mb-4"
            >
              <div className="flex items-center gap-3 justify-center">
                {enemyBotNames.map((name, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#fca5a5',
                    }}
                  >
                    {i === 0 ? '👑 ' : '⚡ '}{name}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quote */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="relative z-10 text-base italic font-semibold mb-6"
            style={{ color: 'rgba(252,165,165,0.85)' }}
          >
            "Master the SHOW."
          </motion.p>

          {/* Teammate line */}
          {teammateName && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="relative z-10 flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.35)',
              }}
            >
              <span style={{ fontSize: 16 }}>🤝</span>
              <span className="text-sm font-bold" style={{ color: '#a5b4fc' }}>
                {teammateName} stands with you
              </span>
            </motion.div>
          )}

          {/* Tap to skip */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="relative z-10 text-xs"
            style={{ color: 'rgba(148,163,184,0.5)' }}
          >
            Tap anywhere to begin
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
