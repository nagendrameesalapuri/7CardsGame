import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
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
import { PublicAdminConfig } from '../types';

type Tab = 'play' | 'history';

export function LobbyPage() {
  const { room, game, subscribeToEvents, createRoom, resumeRoomCode, clearResume, joinRoom, resumeGame } = useGameStore();
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [aiRounds, setAiRounds] = useState(5);
  const [aiRoundsText, setAiRoundsText] = useState('5');
  const [spectatorModeEnabled, setSpectatorModeEnabled] = useState(true);
  const [adminConfig, setAdminConfig] = useState<PublicAdminConfig | null>(null);

  const clampedAiRounds = adminConfig
    ? Math.max(adminConfig.gameConfig.minRounds, Math.min(adminConfig.gameConfig.maxRounds, aiRounds))
    : aiRounds;

  const startAiGame = (botCount: number) => {
    setAiLoading(true);
    createRoom({
      name: `${user?.username ?? 'My'}'s AI Game`,
      maxPlayers: botCount + 1,
      roundCount: clampedAiRounds,
      isPrivate: true,
      botCount,
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

    // Load admin config for dynamic limits
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

    // Live config updates
    const unsubConfig = on('admin:config_updated', (cfg) => {
      setAdminConfig(cfg as PublicAdminConfig);
      setSpectatorModeEnabled(cfg.featureFlags.spectatorModeEnabled);
      if (!cfg.featureFlags.publicRoomsEnabled) setPublicRooms([]);
    });

    return () => { unsub(); unsubGame(); unsubLobby(); unsubConfig(); };
  }, [isAuthenticated, navigate, subscribeToEvents, fetchRooms]);

  // Show room lobby if in a room
  if (room) { if (aiLoading) setAiLoading(false); return <RoomLobby />; }
  if (game) { navigate('/game'); return null; }

  const maxBots = adminConfig?.gameConfig.maxBots ?? 4;
  const maxPlayersLimit = adminConfig?.gameConfig.maxPlayers ?? 6;
  // Double deck: 113 usable cards, 7 per player → max 10 players → 9 bots max
  const effectiveMaxBots = Math.min(maxBots, maxPlayersLimit - 1, 9);
  const botOptions = Array.from({ length: effectiveMaxBots }, (_, i) => ({
    bots: i + 1,
    label: `${i + 1} Bot${i + 1 > 1 ? 's' : ''}`,
    desc: `${i + 2} players`,
  }));

  const waitingRooms = publicRooms.filter(r => r.status === 'waiting');
  const liveRooms    = publicRooms.filter(r => r.status === 'playing');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold font-game text-dark-text mb-1">Game Lobby</h1>
          <p className="text-dark-muted text-xs sm:text-sm">Create a room or jump into a game</p>
        </motion.div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4 sm:mb-8 bg-dark-surface border border-dark-border rounded-xl p-1 w-fit mx-auto">
          {([
            { key: 'play', label: '🎮 Play' },
            { key: 'history', label: '📋 History' },
          ] as { key: Tab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-neon-green text-dark-bg shadow'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Resume game banner ─────────────────────────────────────── */}
        {resumeRoomCode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 sm:mb-6 bg-yellow-500/10 border border-yellow-500/40 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-xl sm:text-2xl flex-shrink-0">🎮</span>
              <div className="min-w-0">
                <p className="font-bold text-yellow-400 text-sm">Game in progress!</p>
                <p className="text-dark-muted text-xs truncate">Active game — room {resumeRoomCode}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="primary" size="sm" onClick={() => {
                resumeGame(resumeRoomCode);
                navigate('/game');
              }}>▶ Resume</Button>
              <button onClick={clearResume} className="text-dark-muted hover:text-dark-text text-sm px-2">✕</button>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && <HistoryTab />}

        {activeTab === 'play' && (
          <>
            {/* ── Play vs AI ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4 sm:mb-8 relative overflow-hidden bg-gradient-to-br from-blue-950/80 to-purple-950/80 border border-neon-blue/30 rounded-2xl p-3 sm:p-6 shadow-lg shadow-neon-blue/5"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-neon-blue/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-neon-blue/20 border border-neon-blue/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-base sm:text-xl">🤖</span>
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-xl font-bold text-dark-text leading-tight">Play vs AI</h2>
                    <p className="text-dark-muted text-xs hidden sm:block">Jump in instantly — no waiting</p>
                  </div>
                </div>

                {/* Rounds input — mobile */}
                <div className="flex items-center gap-1.5 sm:hidden">
                  <span className="text-xs text-dark-muted">Rounds</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={aiRoundsText}
                    onChange={e => setAiRoundsText(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const min = adminConfig?.gameConfig.minRounds ?? 1;
                      const max = adminConfig?.gameConfig.maxRounds ?? 20;
                      const clamped = Math.max(min, Math.min(max, parseInt(aiRoundsText) || min));
                      setAiRounds(clamped);
                      setAiRoundsText(String(clamped));
                    }}
                    className="w-12 bg-dark-bg border border-dark-border rounded-lg px-1 py-1 text-xs font-bold text-dark-text text-center focus:outline-none focus:border-neon-green"
                  />
                </div>
              </div>

              {/* Rounds input — desktop */}
              <div className="hidden sm:flex items-center gap-3 mb-4">
                <label className="text-sm text-dark-muted font-medium whitespace-nowrap">How many rounds?</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={aiRoundsText}
                  onChange={e => setAiRoundsText(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => {
                    const min = adminConfig?.gameConfig.minRounds ?? 1;
                    const max = adminConfig?.gameConfig.maxRounds ?? 20;
                    const clamped = Math.max(min, Math.min(max, parseInt(aiRoundsText) || min));
                    setAiRounds(clamped);
                    setAiRoundsText(String(clamped));
                  }}
                  className="w-20 bg-dark-surface border border-dark-border rounded-lg px-3 py-1 text-sm font-bold text-dark-text text-center focus:outline-none focus:border-neon-green"
                />
                <span className="text-xs text-dark-muted">
                  ({adminConfig?.gameConfig.minRounds ?? 1} – {adminConfig?.gameConfig.maxRounds ?? 20})
                </span>
              </div>

              {/* Bot buttons */}
              {botOptions.length === 0 ? (
                <p className="text-dark-muted text-xs text-center py-4">AI games are currently disabled by admin</p>
              ) : (
                <div className={`grid gap-2 ${botOptions.length <= 3 ? 'grid-cols-3' : botOptions.length <= 4 ? 'grid-cols-4' : botOptions.length <= 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'}`}>
                  {botOptions.map(({ bots, label, desc }) => (
                    <motion.button
                      key={bots}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => startAiGame(bots)}
                      disabled={aiLoading}
                      className="relative flex flex-col items-center gap-1 sm:gap-2 py-2 sm:py-4 px-2 sm:px-3 bg-dark-bg/60 border border-neon-blue/20 hover:border-neon-blue/70 hover:bg-neon-blue/10 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                    >
                      <div className="relative">
                        <span className="text-lg sm:text-2xl">🤖</span>
                        {bots > 1 && (
                          <span className="absolute -top-1 -right-2 w-4 h-4 sm:w-5 sm:h-5 bg-neon-blue text-dark-bg text-[9px] sm:text-xs font-bold rounded-full flex items-center justify-center">
                            {bots}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-dark-text text-xs sm:text-sm leading-none">{label}</span>
                      <span className="text-dark-muted text-[10px] sm:text-xs leading-none">{desc}</span>
                      <div className="absolute inset-0 rounded-xl bg-neon-blue/0 group-hover:bg-neon-blue/5 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              )}

              {aiLoading && (
                <p className="text-center text-neon-blue text-xs mt-2 animate-pulse">Setting up your game…</p>
              )}
            </motion.div>

            {/* ── Multiplayer ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-4 sm:mb-8 relative overflow-hidden bg-gradient-to-br from-emerald-950/80 to-teal-950/80 border border-neon-green/20 rounded-2xl p-3 sm:p-6 shadow-lg shadow-neon-green/5"
            >
              <div className="absolute -top-8 -left-8 w-32 h-32 bg-neon-green/8 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-neon-green/15 border border-neon-green/25 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-base sm:text-xl">👥</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-xl font-bold text-dark-text leading-tight">Multiplayer</h2>
                  <p className="text-dark-muted text-xs hidden sm:block">Play with friends in real time</p>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowCreate(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-4 sm:px-6 bg-neon-green text-dark-bg font-bold text-xs sm:text-base rounded-xl shadow-lg shadow-neon-green/20 hover:bg-neon-green/90 transition-all"
                >
                  ➕ Create Room
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setShowJoin(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-4 sm:px-6 bg-dark-bg border border-neon-green/40 text-neon-green font-bold text-xs sm:text-base rounded-xl hover:bg-neon-green/10 transition-all"
                >
                  🔑 Join with Code
                </motion.button>
              </div>
            </motion.div>

            {/* ── Public Rooms ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-sm sm:text-xl font-bold text-dark-text mb-2 sm:mb-4 flex items-center gap-2">
                <span>🌐</span> Public Rooms
              </h2>

              {publicRooms.length === 0 ? (
                <div className="text-center py-8 sm:py-16 text-dark-muted border border-dashed border-dark-border rounded-2xl">
                  <p className="text-3xl sm:text-4xl mb-2">🃏</p>
                  <p className="text-xs sm:text-sm">No public rooms — create one!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Waiting rooms */}
                  {waitingRooms.length > 0 && (
                    <div>
                      <p className="text-xs text-dark-muted mb-2 uppercase tracking-wide font-semibold">Waiting</p>
                      <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
                        {waitingRooms.map((r, i) => (
                          <motion.div
                            key={r.code}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-dark-surface border border-dark-border rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 hover:border-neon-green/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-dark-text text-sm truncate">{r.name}</p>
                              <p className="text-dark-muted text-xs">
                                {r.playerCount}/{r.maxPlayers} players · {r.roundCount} rounds
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => useGameStore.getState().joinRoom(r.code)}
                            >
                              Join
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live rooms (spectatable) */}
                  {liveRooms.length > 0 && spectatorModeEnabled && (
                    <div>
                      <p className="text-xs text-dark-muted mb-2 uppercase tracking-wide font-semibold flex items-center gap-1.5">
                        <motion.span
                          animate={{ opacity: [1, 0.4, 1] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                          className="inline-block w-1.5 h-1.5 rounded-full bg-neon-red"
                        />
                        Live Matches
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
                        <AnimatePresence>
                          {liveRooms.map((r, i) => (
                            <motion.div
                              key={r.code}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ delay: i * 0.05 }}
                              className="rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 transition-colors"
                              style={{
                                background: 'rgba(255,59,92,0.05)',
                                border: '1px solid rgba(255,59,92,0.2)',
                              }}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="font-medium text-dark-text text-sm truncate">{r.name}</p>
                                  <motion.span
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.2 }}
                                    className="text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(255,59,92,0.2)', color: '#ff3b5c' }}
                                  >
                                    LIVE
                                  </motion.span>
                                </div>
                                <p className="text-dark-muted text-xs">
                                  {r.playerCount} players
                                  {r.spectatorCount > 0 && ` · 👁 ${r.spectatorCount} watching`}
                                </p>
                              </div>
                              <button
                                onClick={() => navigate(`/spectate/${r.code}`)}
                                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all hover:opacity-90"
                                style={{ background: 'rgba(255,59,92,0.15)', color: '#ff3b5c', border: '1px solid rgba(255,59,92,0.3)' }}
                              >
                                👁 Spectate
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>

      <CreateRoomModal isOpen={showCreate} onClose={() => setShowCreate(false)} adminConfig={adminConfig} />
      <JoinRoomModal isOpen={showJoin} onClose={() => setShowJoin(false)} />
    </Layout>
  );
}
