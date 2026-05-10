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

  const startAiGame = (botCount: number) => {
    setAiLoading(true);
    createRoom({
      name: `${user?.username ?? 'My'}'s AI Game`,
      maxPlayers: botCount + 1,
      roundCount: 5,
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h1 className="text-4xl font-bold font-game text-dark-text mb-2">Game Lobby</h1>
          <p className="text-dark-muted">Create a room or join an existing game</p>
        </motion.div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 bg-dark-surface border border-dark-border rounded-xl p-1 w-fit mx-auto">
          {([
            { key: 'play', label: '🎮 Play', },
            { key: 'history', label: '📋 History', },
          ] as { key: Tab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
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
            className="mb-6 bg-yellow-500/10 border border-yellow-500/40 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎮</span>
              <div>
                <p className="font-bold text-yellow-400">Game in progress!</p>
                <p className="text-dark-muted text-sm">You have an active game — room {resumeRoomCode}</p>
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
          className="mb-8 bg-gradient-to-br from-neon-blue/10 to-neon-purple/10 border border-neon-blue/30 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🤖</span>
            <div>
              <h2 className="text-xl font-bold text-dark-text">Play vs AI</h2>
              <p className="text-dark-muted text-sm">Jump in instantly — no waiting for other players</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { bots: 1, label: '1 Bot', desc: '2 players total', icon: '🤖' },
              { bots: 2, label: '2 Bots', desc: '3 players total', icon: '🤖🤖' },
              { bots: 3, label: '3 Bots', desc: '4 players total', icon: '🤖🤖🤖' },
            ].map(({ bots, label, desc, icon }) => (
              <motion.button
                key={bots}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => startAiGame(bots)}
                disabled={aiLoading}
                className="flex flex-col items-center gap-2 p-4 bg-dark-surface border border-neon-blue/30 rounded-xl hover:border-neon-blue hover:bg-neon-blue/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-bold text-dark-text">{label}</span>
                <span className="text-xs text-dark-muted">{desc}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Multiplayer ─────────────────────────────────────────── */}
        <div className="flex gap-4 justify-center mb-8">
          <Button variant="primary" size="lg" onClick={() => setShowCreate(true)}>
            ➕ Create Room
          </Button>
          <Button variant="neon" size="lg" onClick={() => setShowJoin(true)}>
            🔑 Join with Code
          </Button>
        </div>

        {/* Public rooms */}
        <div>
          <h2 className="text-xl font-bold text-dark-text mb-4">Public Rooms</h2>
          {publicRooms.length === 0 ? (
            <div className="text-center py-16 text-dark-muted border border-dashed border-dark-border rounded-2xl">
              <p className="text-4xl mb-3">🃏</p>
              <p>No public rooms available — create one!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {publicRooms.map((r, i) => (
                <motion.div
                  key={r.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-dark-surface border border-dark-border rounded-xl p-4 flex items-center justify-between hover:border-neon-green/40 transition-colors"
                >
                  <div>
                    <p className="font-medium text-dark-text">{r.name}</p>
                    <p className="text-dark-muted text-sm">
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
        </div>

        </>}
      </div>

      <CreateRoomModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <JoinRoomModal isOpen={showJoin} onClose={() => setShowJoin(false)} />
    </Layout>
  );
}
