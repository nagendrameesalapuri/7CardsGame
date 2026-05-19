import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Per-stage visual config ────────────────────────────────────────────────────

type EnemyEntry = { icon: string; name: string };

type StageCfg = {
  label: string;
  icon: string;
  title: string;
  subtitle: string;
  quote: string;
  color: string;
  titleGrad: string;
  diffBadge: string;
  diffColor: string;
  bgRadial: string;
  dismissMs: number;
  survivalEnemies: EnemyEntry[];
  teamArenaEnemies: EnemyEntry[];
};

const STAGE_CFG: StageCfg[] = [
  {
    label: 'STAGE 1 · WARMUP',
    icon: '🛡️',
    title: 'Iron Discipline',
    subtitle: 'The Cautious Defenders Await',
    quote: '"Patience outlasts every reckless move."',
    color: '#22c55e',
    titleGrad: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #16a34a 100%)',
    diffBadge: 'EASY',
    diffColor: '#4ade80',
    bgRadial: 'radial-gradient(ellipse at 50% 50%, rgba(22,101,52,0.45) 0%, transparent 68%)',
    dismissMs: 4500,
    survivalEnemies: [{ icon: '🛡️', name: 'Iron Fist' }],
    teamArenaEnemies: [{ icon: '⚔️', name: 'Iron Guard' }, { icon: '🌑', name: 'Shadow Strike' }],
  },
  {
    label: 'STAGE 2 · TACTICAL',
    icon: '🔥',
    title: 'Relentless Pressure',
    subtitle: 'They Never Let You Breathe',
    quote: '"Hesitation is your greatest enemy."',
    color: '#f59e0b',
    titleGrad: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 55%, #d97706 100%)',
    diffBadge: 'MEDIUM',
    diffColor: '#fcd34d',
    bgRadial: 'radial-gradient(ellipse at 50% 50%, rgba(146,64,14,0.5) 0%, transparent 68%)',
    dismissMs: 4500,
    survivalEnemies: [{ icon: '🔥', name: 'Blaze' }],
    teamArenaEnemies: [{ icon: '🔥', name: 'Blaze' }, { icon: '🧩', name: 'Tactician' }],
  },
  {
    label: 'STAGE 3 · MIND GAMES',
    icon: '🎭',
    title: 'The Art of Deception',
    subtitle: 'Nothing Is What It Seems',
    quote: '"They see only what you want them to see."',
    color: '#a855f7',
    titleGrad: 'linear-gradient(135deg, #e9d5ff 0%, #a855f7 55%, #7e22ce 100%)',
    diffBadge: 'HARD',
    diffColor: '#d8b4fe',
    bgRadial: 'radial-gradient(ellipse at 50% 50%, rgba(88,28,135,0.55) 0%, transparent 68%)',
    dismissMs: 4500,
    survivalEnemies: [{ icon: '🌀', name: 'Phantom' }],
    teamArenaEnemies: [{ icon: '🎭', name: 'Phantom' }, { icon: '🪞', name: 'Mirror' }],
  },
  {
    label: 'STAGE 4 · EXPERT',
    icon: '⚡',
    title: 'The Elite Duo',
    subtitle: 'Two Minds. One Strategy.',
    quote: '"Split your focus and fall. Stay locked and survive."',
    color: '#3b82f6',
    titleGrad: 'linear-gradient(135deg, #bfdbfe 0%, #3b82f6 55%, #1d4ed8 100%)',
    diffBadge: 'EXPERT',
    diffColor: '#93c5fd',
    bgRadial: 'radial-gradient(ellipse at 50% 50%, rgba(29,78,216,0.5) 0%, transparent 68%)',
    dismissMs: 4500,
    survivalEnemies: [{ icon: '🧠', name: 'Smart AI' }, { icon: '⚔️', name: 'Aggressive' }],
    teamArenaEnemies: [{ icon: '💎', name: 'Apex' }, { icon: '🔨', name: 'Crusher' }],
  },
  {
    label: '⚔ FINAL ARENA ⚔',
    icon: '💀',
    title: 'The Boss Has Arrived',
    subtitle: 'Win or Be Eliminated',
    quote: '"Master the SHOW."',
    color: '#ef4444',
    titleGrad: 'linear-gradient(135deg, #fbbf24 0%, #ef4444 55%, #dc2626 100%)',
    diffBadge: 'BOSS',
    diffColor: '#fca5a5',
    bgRadial: 'radial-gradient(ellipse at 50% 50%, rgba(185,28,28,0.55) 0%, transparent 68%)',
    dismissMs: 5500,
    survivalEnemies: [{ icon: '💀', name: 'Boss' }, { icon: '🧠', name: 'Smart AI' }, { icon: '⚔️', name: 'Aggressive' }],
    teamArenaEnemies: [{ icon: '👑', name: 'The Overlord' }, { icon: '👾', name: 'Nemesis' }],
  },
];

// ── Sun-rays background ────────────────────────────────────────────────────────

function SunRays({ color }: { color: string }) {
  const c = color;
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          `conic-gradient(from 0deg at 50% 50%,` +
          `${c}1e 0deg,transparent 18deg,` +
          `${c}14 36deg,transparent 54deg,` +
          `${c}1e 72deg,transparent 90deg,` +
          `${c}14 108deg,transparent 126deg,` +
          `${c}1e 144deg,transparent 162deg,` +
          `${c}14 180deg,transparent 198deg,` +
          `${c}1e 216deg,transparent 234deg,` +
          `${c}14 252deg,transparent 270deg,` +
          `${c}1e 288deg,transparent 306deg,` +
          `${c}14 324deg,transparent 342deg,` +
          `${c}1e 360deg)`,
        animation: 'stageIntroSpin 22s linear infinite',
      }}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface StageIntroProps {
  stage: number;
  mode: 'survival' | 'teamarena';
  teammateName?: string;
  onDismiss: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StageIntro({ stage, mode, teammateName, onDismiss }: StageIntroProps) {
  const idx = Math.max(0, Math.min(4, stage - 1));
  const cfg = STAGE_CFG[idx];

  const enemies = mode === 'survival' ? cfg.survivalEnemies : cfg.teamArenaEnemies;

  // Stable particle list
  const particles = useMemo(
    () =>
      Array.from({ length: stage === 5 ? 28 : 20 }, (_, i) => ({
        id: i,
        angle: (i / (stage === 5 ? 28 : 20)) * 360 + (Math.random() - 0.5) * 18,
        dist: 70 + Math.random() * 110,
        size: 1.5 + Math.random() * (stage === 5 ? 5 : 3.5),
        delay: Math.random() * 1.4,
      })),
    [stage],
  );

  useEffect(() => {
    const t = setTimeout(onDismiss, cfg.dismissMs);
    return () => clearTimeout(t);
  }, [onDismiss, cfg.dismissMs]);

  return (
    <AnimatePresence>
      <motion.div
        key={`stage-intro-${stage}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
        style={{ background: 'rgba(2,4,10,0.96)', backdropFilter: 'blur(14px)' }}
        onClick={onDismiss}
      >
        <style>{`
          @keyframes stageIntroSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes stageIntroPulse { 0%,100% { opacity: 0.35; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1.06); } }
          @keyframes stageIntroFlicker { 0%,100% { opacity: 0.6; } 45%,55% { opacity: 1; } }
        `}</style>

        {/* Spinning sun rays */}
        <div className="absolute inset-0 -scale-[1.6]">
          <SunRays color={cfg.color} />
        </div>

        {/* Radial atmospheric glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: cfg.bgRadial, animation: 'stageIntroPulse 2.2s ease-in-out infinite' }}
        />

        {/* Burst particles */}
        <div className="absolute" style={{ width: 0, height: 0 }}>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
                y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
                opacity: [0, 0.9, 0],
                scale: [0, 1, 0],
              }}
              transition={{ duration: 2.2, delay: p.delay, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                background: cfg.color,
                boxShadow: `0 0 ${p.size * 3}px ${cfg.color}`,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
              }}
            />
          ))}
        </div>

        {/* Content card */}
        <div className="relative flex flex-col items-center text-center px-6 z-10" style={{ maxWidth: 360 }}>

          {/* Difficulty badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mb-4 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.25em]"
            style={{
              background: `${cfg.color}22`,
              border: `1px solid ${cfg.color}55`,
              color: cfg.diffColor,
              letterSpacing: '0.2em',
            }}
          >
            {cfg.label}
          </motion.div>

          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: stage === 5 ? -25 : -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 210, damping: 14, delay: 0.08 }}
            className="mb-5 select-none"
            style={{
              fontSize: stage === 5 ? 80 : 68,
              lineHeight: 1,
              filter: `drop-shadow(0 0 28px ${cfg.color}cc) drop-shadow(0 0 10px ${cfg.color}88)`,
            }}
          >
            {cfg.icon}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.5 }}
            className="font-black mb-1.5 leading-tight"
            style={{
              fontSize: stage === 5 ? 32 : 28,
              background: cfg.titleGrad,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {cfg.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.4 }}
            className="text-sm font-semibold mb-4"
            style={{ color: `${cfg.color}cc` }}
          >
            {cfg.subtitle}
          </motion.p>

          {/* Enemy chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-2 mb-4"
          >
            {enemies.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.12, type: 'spring', stiffness: 300, damping: 20 }}
                className="px-3 py-1.5 rounded-lg text-sm font-bold"
                style={{
                  background: `${cfg.color}18`,
                  border: `1px solid ${cfg.color}44`,
                  color: cfg.diffColor,
                }}
              >
                {e.icon} {e.name}
              </motion.div>
            ))}
          </motion.div>

          {/* Divider line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.95, duration: 0.7 }}
            className="w-40 h-px mb-4"
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}88, transparent)` }}
          />

          {/* Quote */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-sm italic font-semibold mb-4"
            style={{ color: 'rgba(203,213,225,0.8)' }}
          >
            {cfg.quote}
          </motion.p>

          {/* Teammate line */}
          {teammateName && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25 }}
              className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(99,102,241,0.14)',
                border: '1px solid rgba(99,102,241,0.32)',
              }}
            >
              <span style={{ fontSize: 15 }}>🤝</span>
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
            className="text-[11px]"
            style={{ color: 'rgba(100,116,139,0.5)', animation: 'stageIntroFlicker 2s ease-in-out infinite' }}
          >
            Tap anywhere to begin
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
