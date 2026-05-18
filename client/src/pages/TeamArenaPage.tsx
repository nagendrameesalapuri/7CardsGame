import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useTeamArenaStore } from '../store/teamArenaStore';
import { useGameStore } from '../store/gameStore';
import { socketTeamArena } from '../services/socket';
import { teamArenaApi } from '../services/api';
import { Layout } from '../components/layout/Layout';
import { TeamStageResult } from '../components/team-arena/TeamStageResult';
import { BossIntro } from '../components/team-arena/BossIntro';

const POINTS_PER_RUPEE = 100;

const AI_PROFILES = [
  { personality: 'safe',       name: 'Sentinel', icon: '🛡',  playstyle: 'Cautious Defender',       desc: 'Patient and methodical. Minimises risk, holds out for the perfect SHOW.', color: '#22c55e', difficulty: 'Easy' },
  { personality: 'aggressive', name: 'Vanguard', icon: '⚡',  playstyle: 'Relentless Attacker',     desc: 'Maximum pressure. Throws 7s and skips constantly to tire opponents.',    color: '#f59e0b', difficulty: 'Hard' },
  { personality: 'bluff',      name: 'Mirage',   icon: '🎭',  playstyle: 'Mind-Game Specialist',    desc: 'Unpredictable and deceptive. Opponents can never read Mirage\'s hand.',   color: '#a855f7', difficulty: 'Hard' },
  { personality: 'smart',      name: 'Oracle',   icon: '🧠',  playstyle: 'Adaptive Strategist',     desc: 'Reads the board and adapts. Balances attack, defence, and SHOW timing.', color: '#3b82f6', difficulty: 'Expert' },
];

const STAGES = [
  { stage: 1, name: 'Warmup Duel',       subtitle: 'Enter the Arena',           emoji: '🟢', color: '#22c55e', difficulty: 'Easy',   enemies: ['Iron Guard', 'Shadow Strike'] },
  { stage: 2, name: 'Tactical Pressure', subtitle: 'Pressure Begins',           emoji: '🟡', color: '#f59e0b', difficulty: 'Medium', enemies: ['Blaze', 'Tactician'] },
  { stage: 3, name: 'Mind Games',        subtitle: 'Nothing Is What It Seems',  emoji: '🟠', color: '#f97316', difficulty: 'Hard',   enemies: ['Phantom', 'Mirror'] },
  { stage: 4, name: 'Survival Clash',    subtitle: 'Survive the Arena',         emoji: '🔴', color: '#ef4444', difficulty: 'Expert', enemies: ['Apex', 'Crusher'] },
  { stage: 5, name: 'Final Arena',       subtitle: 'Master the SHOW',           emoji: '👑', color: '#ef4444', difficulty: 'Boss',   enemies: ['The Overlord', 'Nemesis'] },
];

const ENTRY_POINTS = 1000;
const STAGE_REWARDS = [150, 300, 550, 900, 1600];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StageMapRow({ stageResults, currentStage, active }: {
  stageResults: any[]; currentStage: number; active: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {STAGES.map((s, i) => {
        const done = stageResults.find((r) => r.stage === s.stage);
        const isCurrent = active && s.stage === currentStage;
        const won = done?.teamAWon;

        return (
          <React.Fragment key={s.stage}>
            <motion.div
              animate={isCurrent ? { scale: [1, 1.12, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                style={{
                  background: done
                    ? won ? 'linear-gradient(135deg,#34d399,#10b981)' : 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : isCurrent
                      ? `linear-gradient(135deg,${s.color}aa,${s.color}66)`
                      : 'rgba(255,255,255,0.06)',
                  border: isCurrent ? `2px solid ${s.color}` : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isCurrent ? `0 0 14px ${s.color}88` : 'none',
                  color: done || isCurrent ? '#fff' : 'rgba(148,163,184,0.4)',
                }}
              >
                {done ? (won ? '✓' : '✗') : isCurrent ? s.emoji : s.stage}
              </div>
              <span className="text-xs" style={{ color: isCurrent ? s.color : 'rgba(100,116,139,0.6)', fontSize: 10 }}>
                S{s.stage}
              </span>
            </motion.div>
            {i < 4 && (
              <div
                className="h-px"
                style={{
                  width: 20,
                  background: done ? (won ? '#34d399' : '#ef4444') : 'rgba(255,255,255,0.08)',
                  marginBottom: 14,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TeamArenaPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    active, tournamentId, inviteCode, teammateType, teammateName,
    aiPersonality, entryPoints, currentStage, totalStages,
    totalPointsEarned, stageResults, waitingForTeammate, isTeammate,
    stageResult, showBossIntro,
    subscribe, clearStageResult, continueToNextStage, dismissBossIntro, reset,
  } = useTeamArenaStore();
  const { game, subscribeToEvents } = useGameStore();

  // Setup view state
  const [view, setView] = useState<'lobby' | 'teammate_select' | 'ai_select' | 'entry_mode' | 'join_invite'>('lobby');
  const [selectedTeammate, setSelectedTeammate] = useState<'ai' | 'human' | null>(null);
  const [selectedAI, setSelectedAI] = useState<string>('smart');
  const [selectedEntryMode, setSelectedEntryMode] = useState<'host_pays' | 'split'>('split');
  const [inviteInput, setInviteInput] = useState('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [statusChecked, setStatusChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copied, setCopied] = useState(false);

  // Subscribe to both team-arena socket events AND game:state events so we can
  // receive the game state and navigate to /game when it arrives
  useEffect(() => {
    const unsub1 = subscribe();
    const unsub2 = subscribeToEvents();
    return () => { unsub1(); unsub2(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check wallet balance
  useEffect(() => {
    import('../services/api').then(({ walletApi }) => {
      walletApi.get()
        .then((r) => setWalletBalance(r.data.balance))
        .catch(() => {});
    });
  }, []);

  // Check for active tournament on mount
  useEffect(() => {
    teamArenaApi.status()
      .then((r) => {
        if (r.data.tournament && (r.data.tournament.status === 'active' || r.data.tournament.status === 'waiting_teammate')) {
          socketTeamArena.status();
        }
        setStatusChecked(true);
      })
      .catch(() => setStatusChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to game when game state arrives
  useEffect(() => {
    if (game && active && !stageResult && !waitingForTeammate) {
      navigate('/game');
    }
  }, [game, active, stageResult, waitingForTeammate, navigate]);

  // Auto-rejoin room when we have an active tournament but no game (e.g. after
  // stage result is cleared or page is refreshed mid-tournament)
  useEffect(() => {
    if (active && !game && !stageResult && !waitingForTeammate && statusChecked) {
      socketTeamArena.continue();
    }
  }, [active, game, stageResult, waitingForTeammate, statusChecked]);

  const startWithAI = useCallback(() => {
    if (starting) return;
    setStarting(true);
    socketTeamArena.start({
      teammateType: 'ai',
      aiPersonality: selectedAI,
      entryMode: 'host_pays',
    });
    setTimeout(() => setStarting(false), 4000);
  }, [selectedAI, starting]);

  const startWithHuman = useCallback(() => {
    if (starting) return;
    setStarting(true);
    socketTeamArena.start({
      teammateType: 'human',
      entryMode: selectedEntryMode,
    });
    setTimeout(() => setStarting(false), 4000);
  }, [selectedEntryMode, starting]);

  const joinAsTeammate = useCallback(() => {
    if (!inviteInput.trim()) return;
    setJoinError('');
    socketTeamArena.joinAsTeammate(inviteInput.trim().toUpperCase());
  }, [inviteInput]);

  const handleAbandon = useCallback(() => {
    socketTeamArena.abandon();
    reset();
    setView('lobby');
  }, [reset]);

  const handleContinue = useCallback(() => {
    continueToNextStage();
  }, [continueToNextStage]);

  const copyInvite = useCallback(() => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [inviteCode]);

  // ── AI entry fee calculation
  const aiEntryPoints = ENTRY_POINTS * 2;
  const aiEntryRupees = aiEntryPoints / POINTS_PER_RUPEE;
  const humanEntryPoints = ENTRY_POINTS;
  const hostPays = selectedEntryMode === 'host_pays' ? humanEntryPoints : Math.ceil(humanEntryPoints / 2);
  const hostPaysRupees = hostPays / POINTS_PER_RUPEE;

  // ── BOSS INTRO ──────────────────────────────────────────────────────────────
  if (showBossIntro) {
    return (
      <BossIntro
        onDismiss={dismissBossIntro}
        enemyBotNames={STAGES[4].enemies}
        teammateName={teammateName ?? undefined}
      />
    );
  }

  // ── STAGE RESULT ────────────────────────────────────────────────────────────
  if (stageResult) {
    return (
      <AnimatePresence mode="wait">
        <TeamStageResult
          key={`result-${stageResult.stage}`}
          result={stageResult}
          stageResults={stageResults}
          onContinue={handleContinue}
          onAbandon={handleAbandon}
        />
      </AnimatePresence>
    );
  }

  // ── WAITING FOR TEAMMATE ────────────────────────────────────────────────────
  if (active && waitingForTeammate && inviteCode) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl overflow-hidden p-6 text-center"
            style={{
              maxWidth: 380,
              background: 'rgba(15,18,40,0.95)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 0 40px rgba(99,102,241,0.15)',
            }}
          >
            <div className="text-5xl mb-4">🤝</div>
            <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Waiting for Teammate</h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Share this invite code with your teammate
            </p>

            <div
              className="rounded-xl p-4 mb-6 cursor-pointer select-all"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '2px dashed rgba(99,102,241,0.4)',
              }}
              onClick={copyInvite}
            >
              <p className="text-3xl font-black tracking-widest" style={{ color: '#818cf8', letterSpacing: '0.3em' }}>
                {inviteCode}
              </p>
              <p className="text-xs mt-1" style={{ color: copied ? '#34d399' : 'rgba(148,163,184,0.5)' }}>
                {copied ? '✓ Copied!' : 'Tap to copy'}
              </p>
            </div>

            {/* Entry mode info */}
            <div
              className="rounded-xl p-3 mb-6 text-left"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-xs font-bold mb-1" style={{ color: '#a5b4fc' }}>Entry split</p>
              <div className="flex justify-between text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
                <span>You paid</span>
                <span className="font-bold" style={{ color: '#e2e8f0' }}>
                  {hostPays} pts (₹{hostPaysRupees.toFixed(2)})
                </span>
              </div>
              {selectedEntryMode === 'split' && (
                <div className="flex justify-between text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  <span>Teammate pays</span>
                  <span className="font-bold" style={{ color: '#e2e8f0' }}>
                    {Math.floor(ENTRY_POINTS / 2)} pts
                  </span>
                </div>
              )}
            </div>

            <StageMapRow stageResults={[]} currentStage={1} active={false} />

            <button
              onClick={handleAbandon}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#64748b',
              }}
            >
              Cancel
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── ACTIVE TOURNAMENT (joining game, waiting for game:state) ────────────────
  if (active && !game) {
    const currentStageInfo = STAGES.find((s) => s.stage === currentStage);
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4"
          style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-2xl p-6"
            style={{
              maxWidth: 380,
              background: 'rgba(15,18,40,0.95)',
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            <div className="text-center mb-5">
              <span className="text-4xl">{currentStageInfo?.emoji}</span>
              <h2 className="text-lg font-black mt-2" style={{ color: '#e2e8f0' }}>
                Stage {currentStage} — {currentStageInfo?.name}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                {currentStageInfo?.subtitle}
              </p>
            </div>

            <StageMapRow stageResults={stageResults} currentStage={currentStage} active />

            <div
              className="mt-4 rounded-xl p-3 flex items-center justify-between"
              style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <span className="text-xs" style={{ color: '#fbbf24' }}>Pts earned so far</span>
              <span className="text-sm font-black" style={{ color: '#fbbf24' }}>{totalPointsEarned}</span>
            </div>

            {/* Joining indicator — auto-continue fires from useEffect */}
            <div className="mt-4 rounded-xl p-3 flex items-center justify-center gap-2"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#818cf8' }}
              />
              <span className="text-xs font-bold" style={{ color: '#a5b4fc' }}>Joining game…</span>
            </div>

            <div className="mt-3 flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => socketTeamArena.continue()}
                className="flex-1 py-3 rounded-xl font-black text-sm"
                style={{
                  background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                Retry →
              </motion.button>
              <button
                onClick={handleAbandon}
                className="px-4 py-3 rounded-xl text-sm font-bold"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#64748b',
                }}
              >
                Quit
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // ── SETUP FLOW ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div
        className="min-h-screen px-4 py-6"
        style={{ background: 'linear-gradient(160deg,#04060e 0%,#0a0d1f 55%,#060410 100%)' }}
      >
        <div className="max-w-md mx-auto">

          <AnimatePresence mode="wait">

            {/* ── LOBBY ─────────────────────────────────────────────────────── */}
            {view === 'lobby' && (
              <motion.div key="lobby" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span style={{ fontSize: 32 }}>⚔️</span>
                    <div>
                      <h1 className="text-2xl font-black" style={{
                        background: 'linear-gradient(135deg,#818cf8,#a78bfa,#c084fc)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      }}>
                        TEAM ARENA
                      </h1>
                      <p className="text-xs tracking-widest" style={{ color: 'rgba(148,163,184,0.5)', letterSpacing: '0.2em' }}>
                        SURVIVE TOGETHER
                      </p>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    2v2 tactical survival — 5 stages of escalating AI opponents
                  </p>
                </div>

                {/* Stage map preview */}
                <div
                  className="rounded-2xl p-4 mb-5"
                  style={{
                    background: 'rgba(15,18,40,0.8)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  <p className="text-xs font-bold tracking-widest uppercase mb-3 text-center"
                    style={{ color: 'rgba(165,180,252,0.6)' }}>
                    Tournament Path
                  </p>
                  <StageMapRow stageResults={[]} currentStage={1} active={false} />
                  <div className="mt-3 space-y-1.5">
                    {STAGES.map((s) => (
                      <div key={s.stage} className="flex items-center gap-2.5 text-xs">
                        <span style={{ color: s.color, fontSize: 12 }}>{s.emoji}</span>
                        <span className="font-bold" style={{ color: 'rgba(226,232,240,0.7)' }}>{s.name}</span>
                        <span style={{ color: 'rgba(100,116,139,0.6)' }}>·</span>
                        <span style={{ color: 'rgba(100,116,139,0.6)' }}>{s.subtitle}</span>
                        <span
                          className="ml-auto px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${s.color}18`, color: s.color, fontSize: 10 }}
                        >
                          {s.difficulty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rules card */}
                <div
                  className="rounded-xl p-4 mb-5"
                  style={{ background: 'rgba(15,18,40,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-xs font-black tracking-widest uppercase mb-2.5" style={{ color: 'rgba(165,180,252,0.6)' }}>
                    How It Works
                  </p>
                  {[
                    ['🎮', 'Each player plays independently with their own hand'],
                    ['📊', 'Your team\'s combined score is compared to the enemy team'],
                    ['🏆', 'Lower team total wins (same as standard 7-card rules)'],
                    ['💺', 'Players alternate seats for balanced attack chains'],
                    ['💰', `Stage rewards: ${STAGE_REWARDS.map((r, i) => `S${i+1}:${r}`).join(' · ')} pts`],
                  ].map(([icon, text], i) => (
                    <div key={i} className="flex items-start gap-2 text-xs mb-1.5">
                      <span style={{ flexShrink: 0 }}>{icon}</span>
                      <span style={{ color: 'rgba(148,163,184,0.75)' }}>{text}</span>
                    </div>
                  ))}
                </div>

                {/* Entry options */}
                <div className="space-y-3 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView('ai_select')}
                    className="w-full rounded-xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))',
                      border: '1px solid rgba(99,102,241,0.4)',
                    }}
                  >
                    <div className="p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sm" style={{ color: '#a5b4fc' }}>
                            🤖 Play with AI Teammate
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>
                            Solo entry, AI partner — starts instantly
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black" style={{ color: '#818cf8' }}>
                            {aiEntryPoints} pts
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                            ₹{aiEntryRupees.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        {AI_PROFILES.map((p) => (
                          <span key={p.personality}
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}40` }}>
                            {p.icon} {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView('entry_mode')}
                    className="w-full rounded-xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg,rgba(52,211,153,0.12),rgba(16,185,129,0.08))',
                      border: '1px solid rgba(52,211,153,0.3)',
                    }}
                  >
                    <div className="p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sm" style={{ color: '#6ee7b7' }}>
                            👤 Invite Human Teammate
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>
                            Play with a friend — split or host pays
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black" style={{ color: '#34d399' }}>
                            {ENTRY_POINTS} pts
                          </p>
                          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
                            ₹{(ENTRY_POINTS / POINTS_PER_RUPEE).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView('join_invite')}
                    className="w-full py-3 rounded-xl text-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(148,163,184,0.7)',
                    }}
                  >
                    🔗 Join as Teammate (enter invite code)
                  </motion.button>
                </div>

                <button
                  onClick={() => navigate('/lobby')}
                  className="w-full py-2 text-xs"
                  style={{ color: 'rgba(100,116,139,0.5)' }}
                >
                  ← Back to Lobby
                </button>
              </motion.div>
            )}

            {/* ── AI TEAMMATE SELECT ─────────────────────────────────────────── */}
            {view === 'ai_select' && (
              <motion.div key="ai_select" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <button onClick={() => setView('lobby')} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  ← Back
                </button>
                <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Choose Your Teammate</h2>
                <p className="text-xs mb-5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  Your AI partner plays independently — their score adds to your team total
                </p>

                <div className="space-y-3 mb-6">
                  {AI_PROFILES.map((p) => (
                    <motion.button
                      key={p.personality}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedAI(p.personality)}
                      className="w-full rounded-xl p-4 text-left transition-all"
                      style={{
                        background: selectedAI === p.personality
                          ? `linear-gradient(135deg,${p.color}20,${p.color}10)`
                          : 'rgba(15,18,40,0.7)',
                        border: selectedAI === p.personality
                          ? `2px solid ${p.color}80`
                          : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: selectedAI === p.personality ? `0 0 20px ${p.color}25` : 'none',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: `${p.color}18`, border: `1px solid ${p.color}40` }}
                        >
                          {p.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-black text-sm" style={{ color: selectedAI === p.personality ? p.color : '#e2e8f0' }}>
                              {p.name}
                            </span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-bold"
                              style={{ background: `${p.color}18`, color: p.color }}
                            >
                              {p.difficulty}
                            </span>
                            {selectedAI === p.personality && (
                              <span className="ml-auto text-xs font-bold" style={{ color: p.color }}>✓ Selected</span>
                            )}
                          </div>
                          <p className="text-xs font-bold mb-0.5" style={{ color: `${p.color}cc` }}>{p.playstyle}</p>
                          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.65)', lineHeight: 1.4 }}>{p.desc}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Entry fee summary */}
                <div
                  className="rounded-xl p-4 mb-5"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'rgba(148,163,184,0.7)' }}>Entry fee (AI teammate)</span>
                    <span className="font-black" style={{ color: '#818cf8' }}>{aiEntryPoints} pts</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>Your balance</span>
                    <span style={{ color: 'rgba(148,163,184,0.7)' }}>₹{walletBalance.toFixed(2)}</span>
                  </div>
                  {walletBalance < aiEntryRupees && (
                    <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>
                      ⚠ Insufficient balance (need ₹{aiEntryRupees.toFixed(2)})
                    </p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startWithAI}
                  disabled={starting || walletBalance < aiEntryRupees}
                  className="w-full py-3.5 rounded-xl font-black text-sm tracking-wide"
                  style={{
                    background: starting || walletBalance < aiEntryRupees
                      ? 'rgba(99,102,241,0.3)'
                      : 'linear-gradient(135deg,#6366f1,#818cf8)',
                    color: '#fff',
                    opacity: starting || walletBalance < aiEntryRupees ? 0.6 : 1,
                    boxShadow: starting || walletBalance < aiEntryRupees ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                  }}
                >
                  {starting ? 'Starting…' : `⚔ Enter Team Arena — ${aiEntryPoints} pts`}
                </motion.button>
              </motion.div>
            )}

            {/* ── HUMAN TEAMMATE ENTRY MODE ─────────────────────────────────── */}
            {view === 'entry_mode' && (
              <motion.div key="entry_mode" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <button onClick={() => setView('lobby')} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  ← Back
                </button>
                <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Entry Payment</h2>
                <p className="text-xs mb-5" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  Choose how to handle the {ENTRY_POINTS} pts entry fee
                </p>

                <div className="space-y-3 mb-6">
                  {[
                    {
                      mode: 'split' as const,
                      title: '⚖ Split Entry',
                      desc: `You pay ${Math.ceil(ENTRY_POINTS / 2)} pts · Teammate pays ${Math.floor(ENTRY_POINTS / 2)} pts`,
                      color: '#34d399',
                    },
                    {
                      mode: 'host_pays' as const,
                      title: '🎁 Host Pays Full',
                      desc: `You pay all ${ENTRY_POINTS} pts · Teammate joins free`,
                      color: '#fbbf24',
                    },
                  ].map((opt) => (
                    <motion.button
                      key={opt.mode}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedEntryMode(opt.mode)}
                      className="w-full rounded-xl p-4 text-left"
                      style={{
                        background: selectedEntryMode === opt.mode
                          ? `${opt.color}14`
                          : 'rgba(15,18,40,0.7)',
                        border: selectedEntryMode === opt.mode
                          ? `2px solid ${opt.color}60`
                          : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-sm" style={{ color: selectedEntryMode === opt.mode ? opt.color : '#e2e8f0' }}>
                            {opt.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.65)' }}>{opt.desc}</p>
                        </div>
                        {selectedEntryMode === opt.mode && (
                          <span className="text-sm font-black ml-3" style={{ color: opt.color }}>✓</span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div
                  className="rounded-xl p-4 mb-5"
                  style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'rgba(148,163,184,0.7)' }}>You pay now</span>
                    <span className="font-black" style={{ color: '#34d399' }}>{hostPays} pts</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(148,163,184,0.5)' }}>Your balance</span>
                    <span style={{ color: 'rgba(148,163,184,0.7)' }}>₹{walletBalance.toFixed(2)}</span>
                  </div>
                  {walletBalance < hostPaysRupees && (
                    <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>
                      ⚠ Insufficient balance (need ₹{hostPaysRupees.toFixed(2)})
                    </p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={startWithHuman}
                  disabled={starting || walletBalance < hostPaysRupees}
                  className="w-full py-3.5 rounded-xl font-black text-sm tracking-wide"
                  style={{
                    background: starting || walletBalance < hostPaysRupees
                      ? 'rgba(52,211,153,0.2)'
                      : 'linear-gradient(135deg,#10b981,#34d399)',
                    color: '#fff',
                    opacity: starting || walletBalance < hostPaysRupees ? 0.6 : 1,
                    boxShadow: starting || walletBalance < hostPaysRupees ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
                  }}
                >
                  {starting ? 'Creating…' : `👥 Create Team — ${hostPays} pts`}
                </motion.button>
              </motion.div>
            )}

            {/* ── JOIN AS TEAMMATE ───────────────────────────────────────────── */}
            {view === 'join_invite' && (
              <motion.div key="join_invite" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <button onClick={() => setView('lobby')} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  ← Back
                </button>
                <h2 className="text-xl font-black mb-1" style={{ color: '#e2e8f0' }}>Join as Teammate</h2>
                <p className="text-xs mb-6" style={{ color: 'rgba(148,163,184,0.6)' }}>
                  Enter the 6-letter invite code from your team captain
                </p>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Enter code (e.g. ABC123)"
                    maxLength={6}
                    value={inviteInput}
                    onChange={(e) => { setInviteInput(e.target.value.toUpperCase()); setJoinError(''); }}
                    className="w-full rounded-xl px-4 py-3 text-center text-xl font-black tracking-widest outline-none"
                    style={{
                      background: 'rgba(15,18,40,0.8)',
                      border: joinError ? '2px solid rgba(239,68,68,0.6)' : '2px solid rgba(99,102,241,0.4)',
                      color: '#818cf8',
                      letterSpacing: '0.3em',
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && joinAsTeammate()}
                  />
                  {joinError && (
                    <p className="text-xs mt-1.5 text-center" style={{ color: '#f87171' }}>{joinError}</p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={joinAsTeammate}
                  disabled={inviteInput.length < 6}
                  className="w-full py-3.5 rounded-xl font-black text-sm"
                  style={{
                    background: inviteInput.length < 6 ? 'rgba(99,102,241,0.25)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                    color: '#fff',
                    opacity: inviteInput.length < 6 ? 0.5 : 1,
                    boxShadow: inviteInput.length < 6 ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                  }}
                >
                  🤝 Join Team
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
