import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressionStore } from '../../store/progressionStore';

// ── AI Mode definitions ───────────────────────────────────────────────────────

interface AIMode {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  difficulty: string;
  diffColor: string;
  diffDot: string;
  description: string;
  tag: string;
  tagColor: string;
  botCount: number;
  rounds: number;
  personality: string;
  personalityChips: string[];
  gradFrom: string;
  gradTo: string;
  borderColor: string;
  glowColor: string;
  accentColor: string;
}

const AI_MODES: AIMode[] = [
  {
    id: 'casual_duel',
    name: 'Casual Duel',
    tagline: '1v1 · Easy Start',
    emoji: '🛡',
    difficulty: 'Easy',
    diffColor: '#22c55e',
    diffDot: '#22c55e',
    description: 'Relaxed duel against a cautious defensive AI. Perfect for learning the game.',
    tag: 'For Beginners',
    tagColor: '#22c55e',
    botCount: 1,
    rounds: 5,
    personality: 'safe',
    personalityChips: ['🛡 Safe'],
    gradFrom: 'rgba(5,46,22,0.8)',
    gradTo: 'rgba(4,47,29,0.6)',
    borderColor: 'rgba(34,197,94,0.35)',
    glowColor: 'rgba(34,197,94,0.12)',
    accentColor: '#22c55e',
  },
  {
    id: 'survival_clash',
    name: 'Survival Clash',
    tagline: '1v2 · Coordinated AI',
    emoji: '⚡',
    difficulty: 'Medium',
    diffColor: '#f59e0b',
    diffDot: '#f59e0b',
    description: 'Two calculating AIs working together. Survive attack chains under pressure.',
    tag: 'Recommended',
    tagColor: '#f59e0b',
    botCount: 2,
    rounds: 7,
    personality: 'smart',
    personalityChips: ['⚡ Aggressive', '🧠 Smart'],
    gradFrom: 'rgba(45,26,3,0.8)',
    gradTo: 'rgba(36,20,3,0.6)',
    borderColor: 'rgba(245,158,11,0.35)',
    glowColor: 'rgba(245,158,11,0.12)',
    accentColor: '#f59e0b',
  },
  {
    id: 'chaos_arena',
    name: 'Chaos Arena',
    tagline: '1v3 · Maximum Pressure',
    emoji: '🎭',
    difficulty: 'Hard',
    diffColor: '#f97316',
    diffDot: '#f97316',
    description: 'Three AIs closing in fast. Every turn is critical — no room for mistakes.',
    tag: 'For Strategists',
    tagColor: '#f97316',
    botCount: 3,
    rounds: 5,
    personality: 'aggressive',
    personalityChips: ['🎭 Bluff', '⚡ Aggressive', '🧠 Smart'],
    gradFrom: 'rgba(42,15,3,0.8)',
    gradTo: 'rgba(35,10,3,0.6)',
    borderColor: 'rgba(249,115,22,0.35)',
    glowColor: 'rgba(249,115,22,0.12)',
    accentColor: '#f97316',
  },
  {
    id: 'boss_rush',
    name: 'Boss Rush',
    tagline: '1v1 · Ultimate Test',
    emoji: '💀',
    difficulty: 'Expert',
    diffColor: '#ef4444',
    diffDot: '#ef4444',
    description: 'The Boss AI: adaptive, relentless, built to read and counter every move you make.',
    tag: 'Max Challenge',
    tagColor: '#a855f7',
    botCount: 1,
    rounds: 7,
    personality: 'boss',
    personalityChips: ['💀 Boss'],
    gradFrom: 'rgba(40,5,5,0.9)',
    gradTo: 'rgba(25,3,25,0.7)',
    borderColor: 'rgba(239,68,68,0.4)',
    glowColor: 'rgba(239,68,68,0.15)',
    accentColor: '#ef4444',
  },
];

// ── AI Personality showcase ───────────────────────────────────────────────────

const AI_PERSONALITIES = [
  { emoji: '🛡', name: 'Safe AI', desc: 'Defensive & cautious', color: '#22c55e', key: 'safe' },
  { emoji: '⚡', name: 'Aggressive AI', desc: 'Fast attacks & pressure', color: '#f59e0b', key: 'aggressive' },
  { emoji: '🎭', name: 'Bluff AI', desc: 'Deceptive & unpredictable', color: '#a855f7', key: 'bluff' },
  { emoji: '🧠', name: 'Smart AI', desc: 'Calculative & adaptive', color: '#60a5fa', key: 'smart' },
  { emoji: '💀', name: 'Boss AI', desc: 'Maximum strategic pressure', color: '#ef4444', key: 'boss' },
];

// ── Daily challenge rotation ──────────────────────────────────────────────────

const DAILY_CHALLENGES = [
  { id: 'silent_victor',   emoji: '🤫', title: 'Silent Victor',      desc: 'Win a round without calling SHOW',           reward: '+50 XP',  mode: 'casual_duel'    },
  { id: 'outthink',        emoji: '🧠', title: 'Outthink the Machine',desc: 'Win 2 rounds in Survival Clash',              reward: '+75 XP',  mode: 'survival_clash' },
  { id: 'iron_defense',    emoji: '🛡', title: 'Iron Defense',        desc: 'Survive 3 attack chains in one game',        reward: '+60 XP',  mode: 'chaos_arena'    },
  { id: 'seven_specialist',emoji: '7️⃣', title: 'Seven Specialist',   desc: 'Win using only one 7 attack',                reward: '+80 XP',  mode: 'survival_clash' },
  { id: 'boss_slayer',     emoji: '💀', title: 'Boss Slayer',         desc: 'Defeat the Boss AI in Boss Rush mode',       reward: '+100 XP', mode: 'boss_rush'      },
  { id: 'chaos_master',    emoji: '🌀', title: 'Chaos Master',        desc: 'Win a round in Chaos Arena',                 reward: '+70 XP',  mode: 'chaos_arena'    },
  { id: 'perfect_show',    emoji: '🏆', title: 'Perfect Show',        desc: 'Call SHOW with 0 total hand points',         reward: '+150 XP', mode: 'casual_duel'    },
];

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_STATS_KEY = 'ai_mode_stats_v1';
const LS_DAILY_KEY = 'ai_daily_challenge_v1';

interface ModeStats {
  played: number;
  won: number;
}

function loadModeStats(): Record<string, ModeStats> {
  try {
    return JSON.parse(localStorage.getItem(LS_STATS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveModeStats(stats: Record<string, ModeStats>) {
  localStorage.setItem(LS_STATS_KEY, JSON.stringify(stats));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getDailyChallenge() {
  const dayIdx = new Date().getDay(); // 0=Sun … 6=Sat
  return DAILY_CHALLENGES[dayIdx % DAILY_CHALLENGES.length];
}

function isDailyChallengeCompleted(): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_DAILY_KEY) ?? '{}');
    return stored.date === getTodayKey() && stored.completed === true;
  } catch {
    return false;
  }
}

function markDailyChallengeCompleted() {
  localStorage.setItem(LS_DAILY_KEY, JSON.stringify({ date: getTodayKey(), completed: true }));
}

// ── Difficulty badge ──────────────────────────────────────────────────────────

function DiffBadge({ difficulty, color }: { difficulty: string; color: string }) {
  const dot = difficulty === 'Easy' ? '🟢' : difficulty === 'Medium' ? '🟡' : difficulty === 'Hard' ? '🟠' : '👑';
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {dot} {difficulty}
    </span>
  );
}

// ── AI Mode card ──────────────────────────────────────────────────────────────

function ModeCard({
  mode,
  stats,
  onStart,
  loading,
}: {
  mode: AIMode;
  stats: ModeStats;
  onStart: (mode: AIMode) => void;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -2 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative flex flex-col rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: `linear-gradient(145deg, ${mode.gradFrom}, ${mode.gradTo})`,
        border: `1px solid ${hovered ? mode.accentColor + '70' : mode.borderColor}`,
        boxShadow: hovered ? `0 0 24px ${mode.glowColor}, 0 4px 24px rgba(0,0,0,0.4)` : `0 2px 12px rgba(0,0,0,0.3)`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Glow orb */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: mode.glowColor, filter: 'blur(20px)', opacity: hovered ? 1 : 0.5, transition: 'opacity 0.3s' }}
      />

      <div className="relative p-3.5 flex flex-col gap-2.5 flex-1">
        {/* Header: icon + name/badge block (no justify-between — badge sits next to name) */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${mode.accentColor}18`, border: `1px solid ${mode.accentColor}35` }}
          >
            {mode.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap leading-none mb-0.5">
              <p className="font-black text-white text-sm leading-tight">{mode.name}</p>
              <DiffBadge difficulty={mode.difficulty} color={mode.diffColor} />
            </div>
            <p className="text-[10px] text-dark-muted truncate leading-none">{mode.tagline}</p>
          </div>
        </div>

        {/* Description — fixed 2-line height so all cards stay uniform */}
        <p className="text-[11px] text-dark-muted leading-relaxed line-clamp-2">{mode.description}</p>

        {/* Personality chips — single row, no wrap */}
        <div className="flex gap-1 overflow-hidden">
          {mode.personalityChips.map((chip) => (
            <span
              key={chip}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${mode.accentColor}15`, color: mode.accentColor, border: `1px solid ${mode.accentColor}30` }}
            >
              {chip}
            </span>
          ))}
        </div>

        {/* Config + tag row */}
        <div className="flex items-center justify-between gap-1 text-[10px] text-dark-muted">
          <span className="flex items-center gap-1 flex-shrink-0">
            <span>👥</span>
            <span>1v{mode.botCount} · {mode.rounds}R</span>
          </span>
          {winRate !== null ? (
            <span className="font-semibold" style={{ color: winRate >= 50 ? '#22c55e' : '#f59e0b' }}>
              {winRate}% win
            </span>
          ) : (
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold truncate"
              style={{ background: `${mode.tagColor}15`, color: mode.tagColor, border: `1px solid ${mode.tagColor}30` }}
            >
              {mode.tag}
            </span>
          )}
        </div>

        {/* Push button to bottom */}
        <div className="flex-1" />

        {/* Start button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onStart(mode)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-40"
          style={{
            background: hovered
              ? `linear-gradient(135deg, ${mode.accentColor}ee, ${mode.accentColor}99)`
              : `${mode.accentColor}22`,
            border: `1px solid ${mode.accentColor}55`,
            boxShadow: hovered ? `0 0 14px ${mode.glowColor}` : 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {loading ? 'Starting…' : `▶ Start ${mode.name}`}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Personality showcase strip ────────────────────────────────────────────────

function PersonalityStrip() {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-dark-muted font-semibold">AI Personalities</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {AI_PERSONALITIES.map((p) => (
          <div
            key={p.key}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl min-w-[72px]"
            style={{
              background: `${p.color}0a`,
              border: `1px solid ${p.color}25`,
            }}
          >
            <span className="text-xl">{p.emoji}</span>
            <p className="text-[9px] font-bold text-center leading-tight" style={{ color: p.color }}>{p.name}</p>
            <p className="text-[8px] text-dark-muted text-center leading-tight">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Daily challenge banner ────────────────────────────────────────────────────

function DailyChallengeBanner({
  challenge,
  completed,
  onGoToMode,
}: {
  challenge: (typeof DAILY_CHALLENGES)[number];
  completed: boolean;
  onGoToMode: (modeId: string) => void;
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background: completed
          ? 'rgba(34,197,94,0.07)'
          : 'linear-gradient(135deg,rgba(251,191,36,0.07),rgba(168,85,247,0.05))',
        border: completed ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(251,191,36,0.25)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: completed ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)' }}
      >
        {completed ? '✅' : challenge.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#fbbf24' }}>Daily Challenge</p>
          {completed && <span className="text-[9px] text-green-400 font-bold">COMPLETED</span>}
        </div>
        <p className="text-xs font-bold text-white leading-snug">{challenge.title}</p>
        <p className="text-[10px] text-dark-muted leading-snug">{challenge.desc}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className="text-[10px] font-bold text-blue-400">{challenge.reward}</span>
        {!completed && (
          <button
            onClick={() => onGoToMode(challenge.mode)}
            className="text-[9px] font-black px-2 py-1 rounded-lg"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
          >
            Play →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quick stats bar ───────────────────────────────────────────────────────────

function QuickStats({ progress, totalPlayed }: { progress: any; totalPlayed: number }) {
  const items = [
    { label: 'Win Streak',   value: progress?.winStreak ?? 0,     color: '#fbbf24', emoji: '🔥' },
    { label: 'Best Streak',  value: progress?.maxWinStreak ?? 0,  color: '#ef4444', emoji: '⚡' },
    { label: 'AI Games',     value: totalPlayed,                   color: '#60a5fa', emoji: '🤖' },
    { label: 'Total Wins',   value: progress?.totalWins ?? 0,     color: '#22c55e', emoji: '✅' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-xl p-2.5 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-base">{s.emoji}</p>
          <p className="text-lg font-black leading-none mt-0.5" style={{ color: s.color }}>{s.value}</p>
          <p className="text-[8px] text-dark-muted mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Streak / achievement banners ──────────────────────────────────────────────

function StreakBanner({ streak }: { streak: number }) {
  if (streak < 2) return null;
  const msg =
    streak >= 10 ? '🔥 LEGENDARY STREAK! Unstoppable!' :
    streak >= 7  ? '🔥 7+ Streak! You\'re on fire!' :
    streak >= 5  ? '⚡ 5-Win Streak! Keep it going!' :
                   `🔥 ${streak}-Win Streak! Keep pushing!`;
  const color = streak >= 10 ? '#ef4444' : streak >= 7 ? '#f97316' : '#f59e0b';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl p-2.5 text-center text-xs font-black"
      style={{ background: `${color}12`, border: `1px solid ${color}35`, color }}
    >
      {msg}
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface PlayVsAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (botCount: number, personality: string, rounds: number, modeName: string) => void;
  loading: boolean;
  adminMaxRounds: number;
  adminMinRounds: number;
}

export function PlayVsAIModal({
  isOpen,
  onClose,
  onStart,
  loading,
  adminMaxRounds,
  adminMinRounds,
}: PlayVsAIModalProps) {
  const { progress } = useProgressionStore();
  const [modeStats, setModeStats] = useState<Record<string, ModeStats>>(loadModeStats);
  const [dailyChallenge] = useState(getDailyChallenge);
  const [dailyCompleted, setDailyCompleted] = useState(isDailyChallengeCompleted);
  const [highlightMode, setHighlightMode] = useState<string | null>(null);

  const totalPlayed = Object.values(modeStats).reduce((s, v) => s + v.played, 0);

  const handleStart = useCallback(
    (mode: AIMode) => {
      // Track play in localStorage
      const stats = loadModeStats();
      const prev = stats[mode.id] ?? { played: 0, won: 0 };
      stats[mode.id] = { ...prev, played: prev.played + 1 };
      saveModeStats(stats);
      setModeStats({ ...stats });

      // If today's challenge mode was started, mark as completed (optimistic)
      if (mode.id === dailyChallenge.mode && !dailyCompleted) {
        markDailyChallengeCompleted();
        setDailyCompleted(true);
      }

      const rounds = Math.max(adminMinRounds, Math.min(adminMaxRounds, mode.rounds));
      onStart(mode.botCount, mode.personality, rounds, mode.name);
    },
    [onStart, dailyChallenge.mode, dailyCompleted, adminMinRounds, adminMaxRounds],
  );

  const handleGoToMode = useCallback((modeId: string) => {
    setHighlightMode(modeId);
    setTimeout(() => setHighlightMode(null), 2000);
  }, []);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleBackdrop}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 48, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl flex flex-col"
            style={{
              background: 'linear-gradient(160deg,rgba(10,12,22,0.98),rgba(8,6,18,0.99))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  🤖
                </div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight">Play vs AI</h2>
                  <p className="text-[10px] text-dark-muted">Choose your challenge</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-dark-muted hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">

              {/* Streak banner */}
              <StreakBanner streak={progress?.winStreak ?? 0} />

              {/* Quick stats */}
              {(progress || totalPlayed > 0) && (
                <QuickStats progress={progress} totalPlayed={totalPlayed} />
              )}

              {/* Mode cards — 2 column grid */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-dark-muted font-semibold mb-3">Choose Your Battle</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AI_MODES.map((mode, i) => (
                    <motion.div
                      key={mode.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      style={
                        highlightMode === mode.id
                          ? { outline: `2px solid ${mode.accentColor}`, borderRadius: 16 }
                          : {}
                      }
                    >
                      <ModeCard
                        mode={mode}
                        stats={modeStats[mode.id] ?? { played: 0, won: 0 }}
                        onStart={handleStart}
                        loading={loading}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Daily challenge */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-dark-muted font-semibold mb-2">Today's Challenge</p>
                <DailyChallengeBanner
                  challenge={dailyChallenge}
                  completed={dailyCompleted}
                  onGoToMode={handleGoToMode}
                />
              </div>

              {/* AI personality showcase */}
              <PersonalityStrip />

              {/* Tips */}
              <div
                className="rounded-xl p-3 text-[10px] text-dark-muted leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="text-white font-semibold">💡 Strategy tip: </span>
                Each AI has a distinct playstyle. Safe AI defends and preserves combos. Boss AI reads your patterns and adapts — it feels human because it is designed to be.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
