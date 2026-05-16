import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { roomsApi, configApi } from '../services/api';
import { on } from '../services/socket';
import { Layout } from '../components/layout/Layout';
import { RoomLobby } from '../components/lobby/RoomLobby';
import { CreateRoomModal } from '../components/lobby/CreateRoomModal';
import { JoinRoomModal } from '../components/lobby/JoinRoomModal';
import { Button } from '../components/ui/Button';
import { HistoryTab } from '../components/lobby/HistoryTab';
import { SupportModal } from '../components/lobby/SupportModal';
import { PublicAdminConfig } from '../types';
import { DailyLoginModal } from '../components/DailyLoginModal';
import { PlayVsAIModal } from '../components/lobby/PlayVsAIModal';
import { useProgressionStore, RANK_CONFIG } from '../store/progressionStore';

type Tab = 'play' | 'history';

// ── Ambient floating orb ──────────────────────────────────────────────────────
function AmbientOrb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: `blur(${size * 0.55}px)` }}
      animate={{ y: [0, -18, 0], opacity: [0.35, 0.6, 0.35] }}
      transition={{ repeat: Infinity, duration: 5 + delay, delay, ease: 'easeInOut' }}
    />
  );
}

// ── Rank progress ring (SVG) ──────────────────────────────────────────────────
function RankRing({ pct, color, icon, label, level }: { pct: number; color: string; icon: string; label: string; level: number }) {
  const r = 26; const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl leading-none">{icon}</span>
        <span className="text-[9px] font-black leading-none mt-0.5" style={{ color }}>{level}</span>
      </div>
    </div>
  );
}

// ── Shimmer overlay (for premium cards) ──────────────────────────────────────
function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
      initial={false}
    >
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{ background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.04), transparent)', skewX: '-15deg' }}
        animate={{ x: ['-100%', '400%'] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'linear', repeatDelay: 2 }}
      />
    </motion.div>
  );
}

export function LobbyPage() {
  const { room, game, subscribeToEvents, createRoom, resumeRoomCode, clearResume, joinRoom, resumeGame } = useGameStore();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showDailyLogin, setShowDailyLogin] = useState(false);
  const { progress, load: loadProgression, subscribe: subscribeProgression } = useProgressionStore();
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [showPlayVsAI, setShowPlayVsAI] = useState(false);
  const [aiRounds, setAiRounds] = useState(5);
  const [aiRoundsText, setAiRoundsText] = useState('5');
  const [spectatorModeEnabled, setSpectatorModeEnabled] = useState(true);
  const [adminConfig, setAdminConfig] = useState<PublicAdminConfig>({
    featureFlags: { spectatorModeEnabled: true, publicRoomsEnabled: true, tournamentBannerEnabled: false, survivalEnabled: true, survivalTiers: { beginner: true, pro: true, elite: true, boss_arena: true } },
    gameConfig: { minPlayers: 2, maxPlayers: 6, minRounds: 1, maxRounds: 20, maxSpectators: 10, maxBots: 4 },
    walletConfig: { depositEnabled: true, withdrawEnabled: true, upiId: '', upiName: '', qrEnabled: true, qrCodeUrl: '' },
    survivalConfig: {
      beginner:   { entryPoints: 1000,  stageRewards: [200,  400,  700,  1200,  2500]  },
      pro:        { entryPoints: 2000,  stageRewards: [400,  800,  1400, 2400,  5000]  },
      elite:      { entryPoints: 5000,  stageRewards: [1000, 2000, 3500, 6000,  12500] },
      boss_arena: { entryPoints: 10000, stageRewards: [2000, 4000, 7000, 12000, 25000] },
    },
  });

  const clampedAiRounds = Math.max(adminConfig.gameConfig.minRounds, Math.min(adminConfig.gameConfig.maxRounds, aiRounds));

  const startAiGame = (botCount: number, personality = 'smart', rounds?: number, modeName?: string) => {
    setAiLoading(true);
    const roundCount = rounds
      ? Math.max(adminConfig.gameConfig.minRounds, Math.min(adminConfig.gameConfig.maxRounds, rounds))
      : clampedAiRounds;
    const name = `${user?.username ?? 'My'}'s ${modeName ?? 'AI'} Game`;

    createRoom({
      name: name.length > 30 ? `${name.slice(0, 27)}...` : name,
      maxPlayers: botCount + 1,
      roundCount,
      isPrivate: true,
      botCount,
      botPersonality: personality,
    });
  };

  const fetchRooms = useCallback(() => {
    roomsApi.list()
      .then(r => {
        setPublicRooms(r.data.rooms);
        setSpectatorModeEnabled(r.data.spectatorModeEnabled ?? true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    const unsub = subscribeToEvents();
    const unsubGame = on('game:state', () => navigate('/game'));
    const unsubLobby = on('lobby:rooms_updated', fetchRooms);

    fetchRooms();

    configApi.getPublic()
      .then(r => {
        setAdminConfig(r.data);
        setAiRounds(v => {
          const clamped = Math.max(r.data.gameConfig.minRounds, Math.min(r.data.gameConfig.maxRounds, v));
          setAiRoundsText(String(clamped));
          return clamped;
        });
      })
      .catch(() => {});

    const unsubConfig = on('admin:config_updated', (cfg) => {
      setAdminConfig(cfg as PublicAdminConfig);
      setSpectatorModeEnabled(cfg.featureFlags.spectatorModeEnabled);
      if (!cfg.featureFlags.publicRoomsEnabled) setPublicRooms([]);
    });

    if (!user?.isGuest) {
      loadProgression().then(() => {
        const prog = useProgressionStore.getState().progress;
        if (prog?.canClaimDaily) setShowDailyLogin(true);
      });
    }
    const unsubProg = subscribeProgression();

    return () => { unsub(); unsubGame(); unsubLobby(); unsubConfig(); unsubProg(); };
  }, [isAuthenticated, navigate, subscribeToEvents, fetchRooms]); // eslint-disable-line react-hooks/exhaustive-deps

  if (room) { if (aiLoading) setAiLoading(false); return <RoomLobby />; }
  if (game) { navigate('/game'); return null; }

  const maxBots = adminConfig.gameConfig.maxBots ?? 4;
  const maxPlayersLimit = adminConfig.gameConfig.maxPlayers ?? 6;
  const effectiveMaxBots = Math.min(maxBots, maxPlayersLimit - 1, 9);
  const botOptions = Array.from({ length: effectiveMaxBots }, (_, i) => ({
    bots: i + 1,
    label: `${i + 1} Bot${i + 1 > 1 ? 's' : ''}`,
    desc: `${i + 2} players`,
  }));

  const waitingRooms = publicRooms.filter(r => r.status === 'waiting');
  const liveRooms    = publicRooms.filter(r => r.status === 'playing');

  const rankCfg = progress ? (RANK_CONFIG[progress.rank] ?? RANK_CONFIG.bronze) : null;
  const xpPct   = progress ? Math.round((progress.xpProgress / Math.max(1, progress.xpNeeded)) * 100) : 0;

  return (
    <Layout>
      <AnimatePresence>
        {showDailyLogin && <DailyLoginModal onClose={() => setShowDailyLogin(false)} />}
      </AnimatePresence>

      {/* ── Global ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <AmbientOrb x="5%"   y="10%"  size={220} color="rgba(99,102,241,0.13)"  delay={0}   />
        <AmbientOrb x="75%"  y="5%"   size={180} color="rgba(16,185,129,0.10)"  delay={1.2} />
        <AmbientOrb x="60%"  y="55%"  size={250} color="rgba(168,85,247,0.09)"  delay={2.1} />
        <AmbientOrb x="15%"  y="65%"  size={160} color="rgba(239,68,68,0.07)"   delay={0.7} />
        <AmbientOrb x="88%"  y="80%"  size={200} color="rgba(245,158,11,0.08)"  delay={1.8} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative max-w-2xl mx-auto" style={{ zIndex: 1 }}>

        {/* ── Premium hero header ── */}
        <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-center pt-2 pb-5 sm:pb-7">
          <div className="relative inline-block">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none"
              style={{ background: 'linear-gradient(135deg,#ffffff 0%,#c7d2fe 35%,#a78bfa 65%,#818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', textShadow: 'none' }}>
              GAME LOBBY
            </h1>
            {/* glow under text */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-2 rounded-full"
              style={{ background: 'radial-gradient(ellipse,rgba(129,140,248,0.5),transparent 70%)', filter: 'blur(4px)' }} />
          </div>
          <p className="text-dark-muted text-xs sm:text-sm mt-2 tracking-wide">
            {user?.username ? `Welcome back, ${user.username}` : 'Create a room or jump into a game'}
          </p>
        </motion.div>

        {/* ── Premium rank card ── */}
        {progress && !user?.isGuest && rankCfg && (
          <motion.button
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/progression')}
            className="w-full flex items-center gap-4 mb-5 px-4 py-3 rounded-2xl relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${rankCfg.color}0d, rgba(10,12,22,0.95))`,
              border: `1px solid ${rankCfg.color}30`,
              boxShadow: `0 4px 32px ${rankCfg.color}12, 0 1px 0 rgba(255,255,255,0.05) inset`,
            }}
          >
            <Shimmer />
            <RankRing pct={xpPct} color={rankCfg.color} icon={rankCfg.icon} label={rankCfg.label} level={progress.level} />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-black" style={{ color: rankCfg.color }}>{rankCfg.label}</span>
                <span className="text-[10px] text-dark-muted font-semibold">Level {progress.level}</span>
                {progress.winStreak >= 3 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                    🔥 {progress.winStreak} Streak
                  </span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ background: `linear-gradient(90deg, ${rankCfg.color}bb, ${rankCfg.color})`, boxShadow: `0 0 8px ${rankCfg.color}80` }} />
              </div>
              <p className="text-[10px] text-dark-muted mt-1">{progress.xpProgress} / {progress.xpNeeded} XP</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
              {progress.canClaimDaily && (
                <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-[10px] font-black px-2 py-1 rounded-xl"
                  style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}>
                  🎁 Claim Daily
                </motion.span>
              )}
              <span className="text-[9px] text-dark-muted">View Stats →</span>
            </div>
          </motion.button>
        )}

        {/* ── Tabs ── */}
        <div className="flex items-center gap-3 mb-5 sm:mb-7">
          <div className="flex gap-1 p-1 rounded-2xl flex-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {([
              { key: 'play', label: '🎮', text: 'Play' },
              { key: 'history', label: '📋', text: 'History' },
            ] as { key: Tab; label: string; text: string }[]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all"
                style={activeTab === tab.key
                  ? { background: 'linear-gradient(135deg,rgba(129,140,248,0.3),rgba(99,102,241,0.2))', color: '#c7d2fe', boxShadow: '0 0 12px rgba(99,102,241,0.2)' }
                  : { color: 'rgba(255,255,255,0.35)' }}>
                <span>{tab.label}</span>
                <span>{tab.text}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowSupport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
            🎧
          </button>
        </div>

        {/* ── Resume game banner ── */}
        {resumeRoomCode && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 relative overflow-hidden rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)' }}>
            <Shimmer />
            <div className="flex items-center gap-3 min-w-0">
              <motion.span animate={{ rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                className="text-2xl flex-shrink-0">🎮</motion.span>
              <div className="min-w-0">
                <p className="font-black text-yellow-300 text-sm">Game in progress!</p>
                <p className="text-dark-muted text-xs truncate">Room {resumeRoomCode} · Tap to rejoin</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="primary" size="sm" onClick={() => { resumeGame(resumeRoomCode); navigate('/game'); }}>▶ Resume</Button>
              <button onClick={clearResume} className="text-dark-muted hover:text-white text-sm px-2 transition-colors">✕</button>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && <HistoryTab />}

        {activeTab === 'play' && (
          <div className="space-y-4">

            {/* ── Tournament Banner ── */}
            {adminConfig.featureFlags.tournamentBannerEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.012, y: -3 }} whileTap={{ scale: 0.99 }}
                onClick={() => navigate('/tournament')}
                className="relative overflow-hidden rounded-2xl cursor-pointer group"
                style={{
                  background: 'linear-gradient(145deg,rgba(20,8,4,0.97),rgba(30,12,3,0.95))',
                  border: '1px solid rgba(245,158,11,0.35)',
                  boxShadow: '0 4px 40px rgba(245,158,11,0.1)',
                }}
              >
                <Shimmer />
                {/* Background art */}
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle,rgba(245,158,11,0.2),transparent 70%)', filter: 'blur(30px)' }} />
                <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle,rgba(239,68,68,0.15),transparent 70%)', filter: 'blur(24px)' }} />
                {/* Decorative crossing swords */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl opacity-10 group-hover:opacity-20 transition-opacity select-none">⚔️</div>

                <div className="relative flex items-center gap-4 px-5 py-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.15))', border: '1px solid rgba(245,158,11,0.3)' }}>
                    ⚔️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-base font-black text-white leading-tight">Bots vs Human Tournament</p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)' }}>
                        🔥 LIVE
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted">Play vs 2 Bots · Win ₹15–₹45 · Entry ₹10 or ₹20</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex -space-x-1">
                        {['🧑','👩','👨','🧑'].map((e, i) => (
                          <span key={i} className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                            style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.3)' }}>{e}</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-dark-muted">+24 playing now</span>
                    </div>
                  </div>
                  <motion.div
                    className="flex-shrink-0 flex flex-col items-end gap-2"
                    animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <span className="text-xs font-black px-3 py-2 rounded-xl"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}>
                      Play Now →
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold">Win up to ₹45</span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ── AI Survival Championship ── */}
            {adminConfig.featureFlags.survivalEnabled !== false && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.012, y: -3 }} whileTap={{ scale: 0.99 }}
                onClick={() => navigate('/survival')}
                className="relative overflow-hidden rounded-2xl cursor-pointer group"
                style={{
                  background: 'linear-gradient(145deg,rgba(3,16,12,0.97),rgba(4,20,16,0.95))',
                  border: '1px solid rgba(16,185,129,0.35)',
                  boxShadow: '0 4px 40px rgba(16,185,129,0.1)',
                }}
              >
                <Shimmer />
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.22),transparent 70%)', filter: 'blur(28px)' }} />
                <div className="absolute -bottom-8 left-1/3 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.12),transparent 70%)', filter: 'blur(24px)' }} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-6xl opacity-8 group-hover:opacity-15 transition-opacity select-none">🏆</div>

                <div className="relative flex items-center gap-4 px-5 py-4">
                  <div className="flex-shrink-0 relative">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.22),rgba(6,182,212,0.15))', border: '1px solid rgba(16,185,129,0.35)' }}>
                      🏆
                    </div>
                    {/* Stage indicators */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <div key={s} className="w-1.5 h-1.5 rounded-full" style={{ background: s <= 2 ? '#10b981' : 'rgba(255,255,255,0.15)' }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-base font-black text-white leading-tight">AI Survival Championship</p>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                        5 STAGES
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted">Beat 5 AI personalities · Earn points · 4 tiers</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {['🛡 Safe','⚡ Aggr.','🎭 Bluff','🧠 Smart','💀 Boss'].map((p, i) => (
                        <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                          style={{
                            background: i < 2 ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
                            color: i < 2 ? '#6ee7b7' : 'rgba(199,210,254,0.7)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <motion.div
                    className="flex-shrink-0 flex flex-col items-end gap-2"
                    animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}
                  >
                    <span className="text-xs font-black px-3 py-2 rounded-xl"
                      style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', color: '#fff', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
                      Enter →
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Use wallet points</span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ── Play vs AI ── */}
            {botOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.012, y: -3 }} whileTap={{ scale: 0.99 }}
              >
                <button
                  onClick={() => setShowPlayVsAI(true)}
                  disabled={aiLoading}
                  className="w-full relative overflow-hidden rounded-2xl cursor-pointer text-left disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(145deg,rgba(8,6,28,0.98),rgba(16,10,42,0.96))',
                    border: '1px solid rgba(99,102,241,0.38)',
                    boxShadow: '0 4px 40px rgba(99,102,241,0.12)',
                  }}
                >
                  <Shimmer />
                  {/* Background art */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.22),transparent 70%)', filter: 'blur(28px)' }} />
                  <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%)', filter: 'blur(24px)' }} />
                  {/* Decorative circuit lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" viewBox="0 0 400 120" preserveAspectRatio="none">
                    <path d="M0,60 L40,60 L60,30 L100,30 L120,60 L200,60" stroke="rgba(129,140,248,1)" strokeWidth="1" fill="none" />
                    <path d="M200,60 L260,60 L280,90 L320,90 L340,60 L400,60" stroke="rgba(129,140,248,1)" strokeWidth="1" fill="none" />
                    <circle cx="200" cy="60" r="3" fill="rgba(129,140,248,1)" />
                  </svg>

                  <div className="relative flex items-center gap-4 px-5 py-4">
                    <div className="flex-shrink-0 relative">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.18))', border: '1px solid rgba(99,102,241,0.4)' }}>
                        🤖
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                        transition={{ repeat: Infinity, duration: 2.2 }}
                        className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full"
                        style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-base sm:text-xl font-black text-white leading-tight">Play vs AI</p>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.22)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)' }}>
                          4 MODES
                        </span>
                        {aiLoading && <span className="text-[9px] text-green-400 animate-pulse font-bold">Starting…</span>}
                      </div>
                      <p className="text-xs text-dark-muted">Casual Duel · Survival Clash · Chaos Arena · Boss Rush</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {[
                          { label: '🛡 Safe',       color: 'rgba(34,197,94,0.7)' },
                          { label: '⚡ Aggressive', color: 'rgba(245,158,11,0.7)' },
                          { label: '🎭 Bluff',      color: 'rgba(168,85,247,0.7)' },
                          { label: '🧠 Smart',      color: 'rgba(96,165,250,0.7)' },
                          { label: '💀 Boss',       color: 'rgba(239,68,68,0.7)' },
                        ].map(p => (
                          <span key={p.label} className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.05)', color: p.color, border: '1px solid rgba(255,255,255,0.07)' }}>
                            {p.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <motion.div
                      animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 18 }}>
                      →
                    </motion.div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* ── Multiplayer ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(145deg,rgba(3,18,14,0.97),rgba(4,22,17,0.95))',
                border: '1px solid rgba(16,185,129,0.28)',
                boxShadow: '0 4px 40px rgba(16,185,129,0.08)',
              }}
            >
              <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.15),transparent 70%)', filter: 'blur(24px)' }} />
              <div className="absolute -bottom-8 right-1/4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.1),transparent 70%)', filter: 'blur(20px)' }} />

              <div className="relative px-5 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.22),rgba(6,182,212,0.15))', border: '1px solid rgba(16,185,129,0.3)' }}>
                    👥
                  </div>
                  <div>
                    <p className="text-base font-black text-white leading-tight">Multiplayer</p>
                    <p className="text-xs text-dark-muted">Play with friends in real time</p>
                  </div>
                  {/* Live player count decoration */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <motion.div className="w-2 h-2 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
                    <span className="text-[10px] text-emerald-400 font-semibold">Online</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowCreate(true)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl font-black text-sm transition-all relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      color: '#fff',
                      boxShadow: '0 6px 24px rgba(16,185,129,0.35)',
                    }}
                  >
                    <span className="text-2xl">➕</span>
                    <span>Create Room</span>
                    <span className="text-[9px] font-normal opacity-70">Set your own rules</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowJoin(true)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl font-black text-sm transition-all"
                    style={{
                      background: 'rgba(16,185,129,0.08)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16,185,129,0.3)',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.06)',
                    }}
                  >
                    <span className="text-2xl">🔑</span>
                    <span>Join with Code</span>
                    <span className="text-[9px] font-normal opacity-60">Enter room code</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* ── Public Rooms ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>🌐</div>
                <h2 className="text-sm font-black text-white tracking-wide">Public Rooms</h2>
                {publicRooms.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }}>
                    {publicRooms.length} open
                  </span>
                )}
              </div>

              {publicRooms.length === 0 ? (
                <div className="text-center py-10 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
                  <p className="text-4xl mb-3">🃏</p>
                  <p className="text-sm font-semibold text-dark-muted">No public rooms yet</p>
                  <p className="text-xs text-dark-muted opacity-60 mt-1">Create one and invite friends!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Waiting rooms */}
                  {waitingRooms.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-dark-muted font-bold mb-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Waiting to Start
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {waitingRooms.map((r, i) => (
                          <motion.div key={r.code}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="relative overflow-hidden rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.07)',
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <p className="font-bold text-white text-sm truncate">{r.name}</p>
                                {r.entryFee > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                                    ₹{r.entryFee}
                                  </span>
                                )}
                              </div>
                              <p className="text-dark-muted text-xs">
                                {r.playerCount}/{r.maxPlayers} players · {r.roundCount}R
                                {r.entryFee > 0 && ` · Pot ₹${r.entryFee * r.playerCount}`}
                              </p>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
                              onClick={() => useGameStore.getState().joinRoom(r.code)}
                              className="flex-shrink-0 text-xs font-black px-3 py-1.5 rounded-lg"
                              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                              Join
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live rooms */}
                  {liveRooms.length > 0 && spectatorModeEnabled && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-dark-muted font-bold mb-2 flex items-center gap-1.5">
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"
                          animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
                        Live Matches
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <AnimatePresence>
                          {liveRooms.map((r, i) => (
                            <motion.div key={r.code}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ delay: i * 0.05 }}
                              className="relative overflow-hidden rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="font-bold text-white text-sm truncate">{r.name}</p>
                                  <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>LIVE</motion.span>
                                </div>
                                <p className="text-dark-muted text-xs">
                                  {r.playerCount} players{r.spectatorCount > 0 && ` · 👁 ${r.spectatorCount}`}
                                </p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(`/spectate/${r.code}`)}
                                className="flex-shrink-0 text-xs font-black px-3 py-1.5 rounded-lg"
                                style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                                👁 Watch
                              </motion.button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* ── Bottom spacer ── */}
            <div className="h-4" />
          </div>
        )}
      </div>

      <PlayVsAIModal
        isOpen={showPlayVsAI}
        onClose={() => setShowPlayVsAI(false)}
        onStart={(botCount, personality, rounds, modeName) => {
          setShowPlayVsAI(false);
          startAiGame(botCount, personality, rounds, modeName);
        }}
        loading={aiLoading}
        adminMaxRounds={adminConfig.gameConfig.maxRounds ?? 20}
        adminMinRounds={adminConfig.gameConfig.minRounds ?? 1}
      />
      <CreateRoomModal isOpen={showCreate} onClose={() => setShowCreate(false)} adminConfig={adminConfig} />
      <JoinRoomModal isOpen={showJoin} onClose={() => setShowJoin(false)} />
      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </Layout>
  );
}
