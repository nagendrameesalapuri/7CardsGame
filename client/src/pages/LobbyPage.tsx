import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { roomsApi, configApi, walletApi, referralApi } from '../services/api';
import { notify } from '../services/notify';
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
import { GameGuideModal } from '../components/lobby/GameGuideModal';
import { useProgressionStore, RANK_CONFIG } from '../store/progressionStore';
import { SpinWheelModal } from '../components/wallet/SpinWheelModal';
import { PointsSpinModal } from '../components/wallet/PointsSpinModal';
import { LaunchBonusModal } from '../components/wallet/LaunchBonusModal';

type Tab = 'play' | 'history';

function Shimmer() {
  return (
    <motion.div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <motion.div
        className="absolute inset-y-0 w-1/3"
        style={{ background: 'linear-gradient(105deg,transparent,rgba(255,255,255,0.04),transparent)', skewX: '-15deg' }}
        animate={{ x: ['-100%', '400%'] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'linear', repeatDelay: 2 }}
      />
    </motion.div>
  );
}

function RankRing({ pct, color, icon, level }: { pct: number; color: string; icon: string; level: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <motion.circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-[9px] font-black leading-none mt-0.5" style={{ color }}>{level}</span>
      </div>
    </div>
  );
}

export function LobbyPage() {
  const { room, game, subscribeToEvents, createRoom, resumeRoomCodes, clearResume, joinRoom, resumeGame } = useGameStore();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showDailyLogin, setShowDailyLogin] = useState(false);
  const [showSpin, setShowSpin] = useState(false);
  const [showPointsSpin, setShowPointsSpin] = useState(false);
  const [showLaunchBonus, setShowLaunchBonus] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const { progress, load: loadProgression, subscribe: subscribeProgression } = useProgressionStore();
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [joiningRoomCode, setJoiningRoomCode] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPoints, setAiPoints] = useState<number>((user as any)?.aiPoints ?? 0);
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [showPlayVsAI, setShowPlayVsAI] = useState(false);
  const [spectatorModeEnabled, setSpectatorModeEnabled] = useState(true);
  const [roomMeta, setRoomMeta] = useState<Record<string, any>>({});
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [adminConfig, setAdminConfig] = useState<PublicAdminConfig>({
    featureFlags: { spectatorModeEnabled: true, publicRoomsEnabled: true, tournamentBannerEnabled: false, survivalEnabled: true, survivalTiers: { beginner: true, pro: true, elite: true, boss_arena: true }, teamArenaEnabled: true, teamArenaDisabledReason: '' },
    gameConfig: { minPlayers: 2, maxPlayers: 6, minRounds: 1, maxRounds: 20, maxSpectators: 10, maxBots: 4 },
    walletConfig: { depositEnabled: true, withdrawEnabled: true, upiId: '', upiName: '', qrEnabled: true, qrCodeUrl: '' },
    survivalConfig: {
      beginner:   { entryPoints: 1000,  stageRewards: [200,  400,  700,  1200,  2500]  },
      pro:        { entryPoints: 2000,  stageRewards: [400,  800,  1400, 2400,  5000]  },
      elite:      { entryPoints: 5000,  stageRewards: [1000, 2000, 3500, 6000,  12500] },
      boss_arena: { entryPoints: 10000, stageRewards: [2000, 4000, 7000, 12000, 25000] },
    },
  });

  const clampedAiRounds = Math.max(adminConfig.gameConfig.minRounds, Math.min(adminConfig.gameConfig.maxRounds, 5));

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
      .then(r => setAdminConfig(r.data))
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

    const joinCode = searchParams.get('join');
    if (joinCode) {
      setSearchParams({}, { replace: true });
      setTimeout(() => joinRoom(joinCode.toUpperCase()), 500);
    }

    // Load wallet balance and AI points on mount
    if (!user?.isGuest) {
      walletApi.get().then(r => {
        setWalletBalance(r.data.balance);
        setAiPoints((r.data as any).aiPoints ?? 0);
        if (!(r.data as any).launchBonusClaimed) {
          setShowLaunchBonus(true);
        }
      }).catch(() => {});
      referralApi.get().then(r => {
        setReferralCode(r.data.referralCode);
      }).catch(() => {});
    }

    // Daily spin unlock notification
    const lastExhaustedDate = localStorage.getItem('spin_exhausted_date');
    const today = new Date().toISOString().slice(0, 10);
    if (lastExhaustedDate && lastExhaustedDate < today) {
      walletApi.spinStatus().then(r => {
        if (r.data.spinsLeft > 0) {
          localStorage.removeItem('spin_exhausted_date');
          notify.success(`🎰 Daily spins reset! You have ${r.data.spinsLeft} free spins. Win up to ₹100!`, { duration: 8000 });
          if (typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted') {
            new window.Notification('🎰 Money Spin Unlocked!', { body: 'Your daily spins are ready! Win up to ₹100 today.' });
          } else if (typeof window.Notification !== 'undefined' && window.Notification.permission !== 'denied') {
            window.Notification.requestPermission().then(p => {
              if (p === 'granted') new window.Notification('🎰 Money Spin Unlocked!', { body: 'Your daily spins are ready! Win up to ₹100 today.' });
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    }

    // AI points won — update local state and record mode win in localStorage
    const unsubAiPoints = on('ai:points_earned', (d: { points: number; total: number; modeId: string; modeLabel: string }) => {
      setAiPoints(d.total);
      try {
        const LS_KEY = 'ai_mode_stats_v1';
        const stats = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
        const prev = stats[d.modeId] ?? { played: 0, won: 0 };
        stats[d.modeId] = { ...prev, won: prev.won + 1 };
        localStorage.setItem(LS_KEY, JSON.stringify(stats));
      } catch {}
    });

    return () => { unsub(); unsubGame(); unsubLobby(); unsubConfig(); unsubProg(); unsubAiPoints(); };
  }, [isAuthenticated, navigate, subscribeToEvents, fetchRooms]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resumeRoomCodes.forEach(code => {
      if (roomMeta[code]) return;
      roomsApi.get(code).then(r => setRoomMeta(prev => ({ ...prev, [code]: r.data.room }))).catch(() => {});
    });
  }, [resumeRoomCodes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (room) { if (aiLoading) setAiLoading(false); return <RoomLobby />; }
  if (game) { navigate('/game'); return null; }

  const maxBots = adminConfig.gameConfig.maxBots ?? 4;
  const maxPlayersLimit = adminConfig.gameConfig.maxPlayers ?? 6;
  const effectiveMaxBots = Math.min(maxBots, maxPlayersLimit - 1, 9);
  const botOptions = Array.from({ length: effectiveMaxBots }, (_, i) => i + 1);

  const waitingRooms = publicRooms.filter(r => r.status === 'waiting');
  const liveRooms    = publicRooms.filter(r => r.status === 'playing');

  const rankCfg = progress ? (RANK_CONFIG[progress.rank] ?? RANK_CONFIG.bronze) : null;
  const xpPct   = progress ? Math.round((progress.xpProgress / Math.max(1, progress.xpNeeded)) * 100) : 0;

  const getResumeInfo = (code: string) => {
    const meta = roomMeta[code];
    if (!meta) return { icon: '🎮', title: 'Resume Game', sub: `Room ${code}`, accent: '#fbbf24', border: 'rgba(251,191,36,0.35)', badge: 'LIVE' };
    const name: string = meta.name ?? '';
    const entryFee: number = meta.config?.entryFee ?? 0;
    const botCount: number = meta.config?.botCount ?? 0;
    if (name.startsWith('Team Survival')) return { icon: '👥', title: 'Team Survival', sub: 'Championship in progress', accent: '#c4b5fd', border: 'rgba(139,92,246,0.45)', badge: 'TEAM' };
    if (name.startsWith('Survival S')) return { icon: '🏆', title: 'AI Survival', sub: 'Tournament in progress', accent: '#6ee7b7', border: 'rgba(16,185,129,0.45)', badge: 'TOURNAMENT' };
    if (entryFee > 0) return { icon: '⚔️', title: 'Wager Match', sub: `₹${entryFee} stakes game`, accent: '#fca5a5', border: 'rgba(239,68,68,0.4)', badge: 'WAGER' };
    if (botCount > 0) return { icon: '🤖', title: 'Play vs AI', sub: `${botCount} bot${botCount > 1 ? 's' : ''} · AI match`, accent: '#93c5fd', border: 'rgba(59,130,246,0.4)', badge: 'VS AI' };
    return { icon: '🌐', title: 'Multiplayer', sub: 'Live match · Tap to rejoin', accent: '#a5b4fc', border: 'rgba(99,102,241,0.4)', badge: 'LIVE' };
  };

  return (
    <Layout>
      <AnimatePresence>
        {showDailyLogin && <DailyLoginModal onClose={() => setShowDailyLogin(false)} />}
      </AnimatePresence>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-1/3 right-0 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle,rgba(168,85,247,0.09),transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute top-1/2 left-0 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.07),transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div className="relative max-w-lg mx-auto px-0 sm:px-2" style={{ zIndex: 1 }}>

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center justify-between pt-1 pb-4 sm:pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none"
              style={{ background: 'linear-gradient(135deg,#ffffff,#c7d2fe 50%,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Game Lobby
            </h1>
            <p className="text-xs text-dark-muted mt-0.5">
              {user?.username ? `Welcome back, ${user.username}` : 'Jump into a game'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGuide(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              📖
            </button>
            <button onClick={() => setShowSupport(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
              🎧
            </button>
          </div>
        </motion.div>

        {/* ── Rank card ── */}
        {progress && !user?.isGuest && rankCfg && (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
            onClick={() => navigate('/progression')}
            className="w-full flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl relative overflow-hidden text-left"
            style={{
              background: `linear-gradient(135deg,${rankCfg.color}0e,rgba(10,12,22,0.96))`,
              border: `1px solid ${rankCfg.color}28`,
              boxShadow: `0 2px 20px ${rankCfg.color}10`,
            }}>
            <Shimmer />
            <RankRing pct={xpPct} color={rankCfg.color} icon={rankCfg.icon} level={progress.level} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm font-black" style={{ color: rankCfg.color }}>{rankCfg.label}</span>
                <span className="text-[10px] text-dark-muted">Lv.{progress.level}</span>
                {progress.winStreak >= 3 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                    🔥 {progress.winStreak}
                  </span>
                )}
                {progress.canClaimDaily && (
                  <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                    🎁 Daily
                  </motion.span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  style={{ background: `linear-gradient(90deg,${rankCfg.color}99,${rankCfg.color})` }} />
              </div>
              <p className="text-[10px] text-dark-muted mt-1">{progress.xpProgress} / {progress.xpNeeded} XP</p>
            </div>
            <span className="text-[10px] text-dark-muted flex-shrink-0">Stats →</span>
          </motion.button>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { key: 'play', icon: '🎮', label: 'Play' },
            { key: 'history', icon: '📋', label: 'History' },
          ] as { key: Tab; icon: string; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={activeTab === t.key
                ? { background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(99,102,241,0.18))', color: '#c7d2fe', boxShadow: '0 0 12px rgba(99,102,241,0.18)' }
                : { color: 'rgba(255,255,255,0.35)' }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Resume game banners ── */}
        <AnimatePresence>
          {resumeRoomCodes.map((code, i) => {
            const info = getResumeInfo(code);
            return (
              <motion.div key={code}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                transition={{ delay: i * 0.05 }}
                className="mb-3 relative overflow-hidden rounded-2xl"
                style={{ border: `1px solid ${info.border}`, background: 'rgba(10,8,20,0.96)' }}>
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg,${info.accent}88,${info.accent}22)` }} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${info.border.replace('0.45','0.15').replace('0.4','0.12')}`, border: `1px solid ${info.border}` }}>
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-black" style={{ color: info.accent }}>{info.title}</span>
                      <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: `${info.border.replace('0.45','0.15').replace('0.4','0.12')}`, color: info.accent, border: `1px solid ${info.border}` }}>
                        {info.badge}
                      </motion.span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{info.sub}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="primary" size="sm" onClick={() => { resumeGame(code); navigate('/game'); }}>▶ Resume</Button>
                    <button onClick={() => clearResume(code)} className="text-dark-muted text-sm px-1">✕</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── History tab ── */}
        {activeTab === 'history' && <HistoryTab />}

        {/* ── Play tab ── */}
        {activeTab === 'play' && (
          <div className="space-y-3 pb-8">

            {/* AI Survival Championship */}
            {adminConfig.featureFlags.survivalEnabled !== false && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                onClick={() => navigate('/survival')}
                className="relative overflow-hidden rounded-2xl cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg,rgba(5,20,15,0.98),rgba(4,18,14,0.96))',
                  border: '1px solid rgba(16,185,129,0.3)',
                  boxShadow: '0 4px 32px rgba(16,185,129,0.08)',
                }}>
                <Shimmer />
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.2),transparent 70%)', filter: 'blur(24px)' }} />
                <div className="flex items-center gap-4 px-4 py-4 relative">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 relative"
                    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(6,182,212,0.12))', border: '1px solid rgba(16,185,129,0.3)' }}>
                    🏆
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <div key={s} className="w-1 h-1 rounded-full" style={{ background: s <= 2 ? '#10b981' : 'rgba(255,255,255,0.15)' }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-black text-white">AI Survival Championship</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.18)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                        5 STAGES
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted mb-2">Beat 5 AI personalities · Earn points · 4 tiers</p>
                    <div className="flex flex-wrap gap-1">
                      {['🛡 Safe','⚡ Aggr.','🎭 Bluff','🧠 Smart','💀 Boss'].map((p, i) => (
                        <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.05)', color: i < 2 ? '#6ee7b7' : 'rgba(199,210,254,0.65)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <motion.div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 16 }}>
                    →
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Play vs AI */}
            {botOptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                <button
                  onClick={() => setShowPlayVsAI(true)}
                  disabled={aiLoading}
                  className="w-full relative overflow-hidden rounded-2xl text-left disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg,rgba(10,8,32,0.98),rgba(14,10,40,0.96))',
                    border: '1px solid rgba(99,102,241,0.32)',
                    boxShadow: '0 4px 32px rgba(99,102,241,0.08)',
                  }}>
                  <Shimmer />
                  <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%)', filter: 'blur(24px)' }} />
                  <div className="flex items-center gap-4 px-4 py-4 relative">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 relative"
                      style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.22),rgba(168,85,247,0.15))', border: '1px solid rgba(99,102,241,0.35)' }}>
                      🤖
                      <motion.div
                        animate={{ scale: [1, 1.8, 1], opacity: [0.9, 0, 0.9] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                        style={{ background: '#22c55e' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-black text-white">Play vs AI</p>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}>
                          4 MODES
                        </span>
                        {aiLoading && <span className="text-[9px] text-emerald-400 font-bold animate-pulse">Starting…</span>}
                      </div>
                      <p className="text-xs text-dark-muted mb-2">Casual Duel · Survival Clash · Chaos Arena · Boss Rush</p>
                      <div className="flex flex-wrap gap-1">
                        {['🛡 Safe','⚡ Aggressive','🎭 Bluff','🧠 Smart','💀 Boss'].map((p, i) => (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.04)', color: ['rgba(34,197,94,0.8)','rgba(245,158,11,0.8)','rgba(168,85,247,0.8)','rgba(96,165,250,0.8)','rgba(239,68,68,0.8)'][i], border: '1px solid rgba(255,255,255,0.06)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <motion.div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                      animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.28)', color: '#a5b4fc', fontSize: 16 }}>
                      →
                    </motion.div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Spin & Win */}
            {!user?.isGuest && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
                className="relative overflow-hidden rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg,rgba(6,8,26,0.98),rgba(4,5,18,0.97))',
                  border: '1px solid rgba(250,204,21,0.22)',
                  boxShadow: '0 4px 32px rgba(250,204,21,0.05)',
                }}>
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(250,204,21,0.13),transparent 70%)', filter: 'blur(28px)' }} />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.1),transparent 70%)', filter: 'blur(24px)' }} />

                {/* Header */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,rgba(250,204,21,0.18),rgba(251,146,60,0.1))', border: '1px solid rgba(250,204,21,0.28)' }}>
                    🎰
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-black text-white">Spin &amp; Win</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(250,204,21,0.15)', color: '#fde047', border: '1px solid rgba(250,204,21,0.28)' }}>
                        DAILY
                      </span>
                    </div>
                    <p className="text-xs text-dark-muted">Spin wheels · Win real ₹ daily</p>
                  </div>
                </div>

                {/* Spin buttons */}
                <div className="flex flex-col gap-2 px-4 py-3 relative">
                  {/* Money Spin */}
                  <motion.button
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowSpin(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.18),rgba(168,85,247,0.12))', border: '1px solid rgba(99,102,241,0.35)' }}>
                    <Shimmer />
                    <span className="text-xl relative z-10 flex-shrink-0">🎰</span>
                    <div className="flex-1 text-left relative z-10">
                      <div className="text-xs font-black text-white leading-tight">Money Spin</div>
                      <div className="text-[9px] leading-tight" style={{ color: 'rgba(165,180,252,0.7)' }}>₹5/spin · 3/day</div>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full relative z-10 flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.3)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.35)' }}>
                      WIN ₹100
                    </span>
                  </motion.button>

                  {/* Points Spin */}
                  <motion.button
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowPointsSpin(true)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.14),rgba(6,182,212,0.08))', border: '1px solid rgba(16,185,129,0.32)' }}>
                    <Shimmer />
                    <span className="text-xl relative z-10 flex-shrink-0">⭐</span>
                    <div className="flex-1 text-left relative z-10">
                      <div className="text-xs font-black text-white leading-tight">Points Spin</div>
                      <div className="text-[9px] leading-tight" style={{ color: 'rgba(52,211,153,0.7)' }}>100 pts/spin · 10/day</div>
                    </div>
                    <div className="flex items-center gap-1.5 relative z-10 flex-shrink-0">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.25)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.32)' }}>
                        WIN REAL ₹
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>
                        ⭐ {aiPoints.toLocaleString()}
                      </span>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Refer & Earn */}
            {!user?.isGuest && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                className="relative overflow-hidden rounded-2xl cursor-pointer"
                onClick={() => navigate('/profile')}
                style={{
                  background: 'linear-gradient(135deg,rgba(6,22,14,0.98),rgba(4,14,10,0.97))',
                  border: '1px solid rgba(52,211,153,0.28)',
                  boxShadow: '0 4px 32px rgba(52,211,153,0.06)',
                }}>
                {/* Glow blobs */}
                <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(52,211,153,0.14),transparent 70%)', filter: 'blur(24px)' }} />
                <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(251,191,36,0.08),transparent 70%)', filter: 'blur(20px)' }} />
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(52,211,153,0.5),transparent)' }} />

                <div className="relative px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(16,185,129,0.1))', border: '1px solid rgba(52,211,153,0.35)' }}>
                      🎁
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-black text-white">Refer &amp; Earn</p>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                          ₹50 BONUS
                        </span>
                      </div>
                      <p className="text-xs text-dark-muted">Invite friends · Both of you win cash</p>
                    </div>
                  </div>
                </div>

                <div className="relative px-4 py-3 flex flex-col gap-2">
                  {/* Reward pills */}
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
                      style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <span className="text-base">🎁</span>
                      <div>
                        <p className="text-xs font-black" style={{ color: '#34d399' }}>You get ₹50</p>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>per friend who deposits</p>
                      </div>
                    </div>
                    <div className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <span className="text-base">🌟</span>
                      <div>
                        <p className="text-xs font-black" style={{ color: '#fbbf24' }}>Friend gets ₹30</p>
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>on their first deposit</p>
                      </div>
                    </div>
                  </div>

                  {/* Code row */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl px-3 py-2 flex items-center gap-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>Code:</span>
                      <span className="font-mono font-black text-base tracking-[0.2em]" style={{ color: '#34d399' }}>
                        {referralCode ?? '······'}
                      </span>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const text = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';
                        if (!text) return;
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(text).catch(() => {});
                        } else {
                          const el = document.createElement('textarea');
                          el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
                          document.body.appendChild(el); el.select();
                          document.execCommand('copy'); document.body.removeChild(el);
                        }
                        setReferralCopied(true);
                        setTimeout(() => setReferralCopied(false), 2000);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0"
                      style={{
                        background: referralCopied ? 'rgba(52,211,153,0.28)' : 'rgba(52,211,153,0.14)',
                        color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.35)',
                      }}>
                      {referralCopied ? '✓ Copied!' : '⎘ Copy Link'}
                    </button>
                  </div>

                  <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Tap card to see full details → Profile › Refer tab
                  </p>
                </div>
              </motion.div>
            )}

            {/* Multiplayer */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(135deg,rgba(8,5,28,0.98),rgba(4,2,18,0.97))',
                border: '1px solid rgba(99,102,241,0.28)',
                boxShadow: '0 4px 32px rgba(99,102,241,0.08)',
              }}>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.15),transparent 70%)', filter: 'blur(28px)' }} />

              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))', border: '1px solid rgba(99,102,241,0.3)' }}>
                  🌐
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black text-white">Multiplayer</p>
                    <div className="flex items-center gap-1">
                      <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                      <span className="text-[10px] text-emerald-400 font-semibold">Online</span>
                    </div>
                  </div>
                  <p className="text-xs text-dark-muted">Play with others · 2–{adminConfig.gameConfig.maxPlayers} players</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 px-4 py-3 relative">
                <motion.button
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowCreate(true)}
                  className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl font-black text-sm relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', boxShadow: '0 4px 20px rgba(16,185,129,0.35)' }}>
                  <Shimmer />
                  <span className="text-lg">➕</span>
                  <div className="text-left">
                    <div className="text-xs font-black leading-tight">Create Room</div>
                    <div className="text-[9px] opacity-75 leading-tight">Set your rules</div>
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowJoin(true)}
                  className="flex items-center justify-center gap-2 py-3.5 px-3 rounded-2xl font-black text-sm relative overflow-hidden"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Shimmer />
                  <span className="text-lg">🔑</span>
                  <div className="text-left">
                    <div className="text-xs font-black leading-tight">Join with Code</div>
                    <div className="text-[9px] opacity-60 leading-tight">Enter room code</div>
                  </div>
                </motion.button>
              </div>
            </motion.div>

            {/* Public Rooms */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-sm font-black text-white">Public Rooms</h2>
                {publicRooms.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.22)' }}>
                    {publicRooms.length}
                  </span>
                )}
              </div>

              {publicRooms.length === 0 ? (
                <div className="text-center py-10 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                  <p className="text-3xl mb-2">🃏</p>
                  <p className="text-sm font-semibold text-dark-muted">No public rooms yet</p>
                  <p className="text-xs text-dark-muted opacity-50 mt-1">Be the first to create one!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Waiting rooms */}
                  {waitingRooms.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5 px-1"
                        style={{ color: 'rgba(148,163,184,0.5)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        Open · Waiting
                      </p>
                      <div className="space-y-2">
                        {waitingRooms.map((r, i) => (
                          <motion.div key={r.code}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <p className="font-bold text-white text-sm truncate">{r.name}</p>
                                {r.entryFee > 0 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.22)' }}>
                                    ₹{r.entryFee}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                                {r.playerCount}/{r.maxPlayers} players · {r.roundCount}R
                                {r.entryFee > 0 && ` · Pot ₹${r.entryFee * r.playerCount}`}
                              </p>
                            </div>
                            <motion.button
                              whileHover={{ scale: joiningRoomCode ? 1 : 1.05 }} whileTap={{ scale: 0.96 }}
                              disabled={!!joiningRoomCode}
                              onClick={() => {
                                if (joiningRoomCode) return;
                                setJoiningRoomCode(r.code);
                                joinRoom(r.code);
                                setTimeout(() => setJoiningRoomCode(null), 4000);
                              }}
                              className="flex-shrink-0 text-xs font-black px-4 py-2 rounded-xl disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', boxShadow: '0 3px 12px rgba(16,185,129,0.28)' }}>
                              {joiningRoomCode === r.code ? '…' : 'Join'}
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live rooms */}
                  {liveRooms.length > 0 && spectatorModeEnabled && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-1.5 px-1"
                        style={{ color: 'rgba(148,163,184,0.5)' }}>
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"
                          animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
                        Live Matches
                      </p>
                      <div className="space-y-2">
                        <AnimatePresence>
                          {liveRooms.map((r, i) => (
                            <motion.div key={r.code}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.18)' }}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="font-bold text-white text-sm truncate">{r.name}</p>
                                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>LIVE</motion.span>
                                </div>
                                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                                  {r.playerCount} players{r.spectatorCount > 0 && ` · 👁 ${r.spectatorCount}`}
                                </p>
                              </div>
                              <motion.button
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(`/spectate/${r.code}`)}
                                className="flex-shrink-0 text-xs font-black px-3 py-2 rounded-xl"
                                style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
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
        aiPoints={aiPoints}
        adminMaxRounds={adminConfig.gameConfig.maxRounds ?? 20}
        adminMinRounds={adminConfig.gameConfig.minRounds ?? 1}
      />
      <CreateRoomModal isOpen={showCreate} onClose={() => setShowCreate(false)} adminConfig={adminConfig} />
      <JoinRoomModal isOpen={showJoin} onClose={() => setShowJoin(false)} />
      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />

      <AnimatePresence>
        {showGuide && <GameGuideModal onClose={() => setShowGuide(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSpin && (
          <SpinWheelModal
            onClose={() => setShowSpin(false)}
            onBalanceUpdate={(b) => { setWalletBalance(b); }}
          />
        )}
        {showPointsSpin && (
          <PointsSpinModal
            onClose={() => setShowPointsSpin(false)}
            onBalanceUpdate={(b, pts) => { setWalletBalance(b); setAiPoints(pts); }}
          />
        )}
        {showLaunchBonus && (
          <LaunchBonusModal
            onClaim={(pts, spins) => {
              setAiPoints(pts);
              setShowLaunchBonus(false);
            }}
            onClose={() => setShowLaunchBonus(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
