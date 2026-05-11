import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { roomsApi } from '../services/api';
import { on } from '../services/socket';
import { Layout } from '../components/layout/Layout';
import { RoomLobby } from '../components/lobby/RoomLobby';
import { CreateRoomModal } from '../components/lobby/CreateRoomModal';
import { JoinRoomModal } from '../components/lobby/JoinRoomModal';
import { Button } from '../components/ui/Button';
import { HistoryTab } from '../components/lobby/HistoryTab';

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

  const startAiGame = (botCount: number) => {
    setAiLoading(true);
    createRoom({
      name: `${user?.username ?? 'My'}'s AI Game`,
      maxPlayers: botCount + 1,
      roundCount: aiRounds,
      isPrivate: true,
      botCount,
    });
  };

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    const unsub = subscribeToEvents();

    // Navigate to game once it starts
    const unsubGame = on('game:state', () => navigate('/game'));

    roomsApi.list().then(r => setPublicRooms(r.data.rooms)).catch(() => {});

    return () => { unsub(); unsubGame(); };
  }, [isAuthenticated, navigate, subscribeToEvents]);

  // Show room lobby if in a room
  if (room) { if (aiLoading) setAiLoading(false); return <RoomLobby />; }

  // Show game if started
  if (game) { navigate('/game'); return null; }

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
            { key: 'play', label: '🎮 Play', },
            { key: 'history', label: '📋 History', },
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

        {/* ── Resume game banner ───────────────────────────────────────── */}
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
              }}>
                ▶ Resume
              </Button>
              <button onClick={clearResume} className="text-dark-muted hover:text-dark-text text-sm px-2">✕</button>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && <HistoryTab />}

        {activeTab === 'play' && <>

        {/* ── Play vs AI ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4 sm:mb-8 relative overflow-hidden bg-gradient-to-br from-blue-950/80 to-purple-950/80 border border-neon-blue/30 rounded-2xl p-3 sm:p-6 shadow-lg shadow-neon-blue/5"
        >
          {/* Decorative glow */}
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-neon-blue/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header row: icon+title on left, rounds input on right (mobile) */}
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

            {/* Rounds input — inline on mobile */}
            <div className="flex items-center gap-1.5 sm:hidden">
              <span className="text-xs text-dark-muted">Rounds</span>
              <input
                type="number"
                min={1}
                max={20}
                value={aiRounds}
                onChange={e => {
                  const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                  setAiRounds(v);
                }}
                className="w-12 bg-dark-bg border border-dark-border rounded-lg px-1 py-1 text-xs font-bold text-dark-text text-center focus:outline-none focus:border-neon-green"
              />
            </div>
          </div>

          {/* Rounds input — full row on desktop */}
          <div className="hidden sm:flex items-center gap-3 mb-4">
            <label className="text-sm text-dark-muted font-medium whitespace-nowrap">How many rounds?</label>
            <input
              type="number"
              min={1}
              max={20}
              value={aiRounds}
              onChange={e => {
                const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                setAiRounds(v);
              }}
              className="w-20 bg-dark-surface border border-dark-border rounded-lg px-3 py-1 text-sm font-bold text-dark-text text-center focus:outline-none focus:border-neon-green"
            />
            <span className="text-xs text-dark-muted">(1 – 20)</span>
          </div>

          {/* Bot buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { bots: 1, label: '1 Bot',  desc: '2 players', players: '2P' },
              { bots: 2, label: '2 Bots', desc: '3 players', players: '3P' },
              { bots: 3, label: '3 Bots', desc: '4 players', players: '4P' },
            ].map(({ bots, label, desc, players }) => (
              <motion.button
                key={bots}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => startAiGame(bots)}
                disabled={aiLoading}
                className="relative flex flex-col items-center gap-1 sm:gap-2 py-2 sm:py-4 px-2 sm:px-3 bg-dark-bg/60 border border-neon-blue/20 hover:border-neon-blue/70 hover:bg-neon-blue/10 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                {/* Bot icons — single icon with count badge on mobile, stacked on desktop */}
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
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-xl bg-neon-blue/0 group-hover:bg-neon-blue/5 transition-colors" />
              </motion.button>
            ))}
          </div>

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
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreate(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-4 sm:px-6 bg-neon-green text-dark-bg font-bold text-xs sm:text-base rounded-xl shadow-lg shadow-neon-green/20 hover:bg-neon-green/90 transition-all"
            >
              ➕ Create Room
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowJoin(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-4 sm:px-6 bg-dark-bg border border-neon-green/40 text-neon-green font-bold text-xs sm:text-base rounded-xl hover:bg-neon-green/10 transition-all"
            >
              🔑 Join with Code
            </motion.button>
          </div>
        </motion.div>

        {/* Public rooms */}
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
            <div className="grid sm:grid-cols-2 gap-2 sm:gap-3">
              {publicRooms.map((r, i) => (
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
                      {r.playerCount}/{r.maxPlayers} players · {r.roundCount ?? r.matchPointLimit} rounds
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowJoin(false); useGameStore.getState().joinRoom(r.code); }}
                  >
                    Join
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        </>}
      </div>

      <CreateRoomModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <JoinRoomModal isOpen={showJoin} onClose={() => setShowJoin(false)} />
    </Layout>
  );
}
