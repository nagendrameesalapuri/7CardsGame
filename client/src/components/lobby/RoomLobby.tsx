import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

export function RoomLobby() {
  const { room, toggleReady, startGame, leaveRoom, subscribeToEvents, setBots } = useGameStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const unsub = subscribeToEvents();
    return unsub;
  }, [subscribeToEvents]);

  if (!room) return null;

  const isHost = !!user && (room.hostId === user.id || room.hostId === (user as any)._id);
  const myPlayer = room.players.find(p => p.userId === user?.id);
  const allReady = room.players.every(p => p.isReady || p.isHost);
  const botCount = room.config.botCount ?? 0;
  const totalSlots = room.players.length + botCount;
  const canStart = isHost && totalSlots >= 2 && allReady;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success('Room code copied!');
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-felt-dark to-felt p-6">
          <h1 className="text-2xl font-bold text-white">{room.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-dark-muted text-sm">Room Code:</span>
            <button
              onClick={copyCode}
              className="font-mono font-bold text-xl text-neon-green tracking-widest hover:text-white transition-colors flex items-center gap-2"
            >
              {room.code}
              <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Config chips */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="px-2 py-1 bg-white/10 rounded text-xs text-white">{room.config.maxPlayers}P max</span>
            <span className="px-2 py-1 bg-white/10 rounded text-xs text-white">{room.config.roundCount} rounds</span>
            <span className="px-2 py-1 bg-white/10 rounded text-xs text-white">{room.config.turnTimeLimit}s turns</span>
            {room.config.isPrivate && <span className="px-2 py-1 bg-neon-purple/30 rounded text-xs text-neon-purple">Private</span>}
          </div>
        </div>

        {/* Players */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-dark-text font-semibold">
              Players ({totalSlots}/{room.config.maxPlayers})
            </h2>
            {!allReady && !isHost && <span className="text-dark-muted text-xs">Waiting for all players to ready up...</span>}
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {/* Human players */}
              {room.players.map((p, i) => (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-dark-bg rounded-xl border border-dark-border"
                >
                  <Avatar avatar={p.avatar} size="md" isBot={p.isBot} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-text">{p.username}</span>
                      {p.isHost && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">HOST</span>}
                    </div>
                  </div>
                  <div className={clsx(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                    p.isReady || p.isHost
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                      : 'bg-dark-border text-dark-muted'
                  )}>
                    {p.isReady || p.isHost ? '✓ Ready' : '○ Not Ready'}
                  </div>
                </motion.div>
              ))}

              {/* AI Bot slots */}
              {Array.from({ length: botCount }, (_, i) => (
                <motion.div
                  key={`bot-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 bg-neon-blue/5 rounded-xl border border-neon-blue/20"
                >
                  <Avatar avatar={`bot_${i + 1}`} size="md" isBot />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-text">AI Bot {i + 1}</span>
                      <span className="text-xs bg-neon-blue/20 text-neon-blue px-2 py-0.5 rounded border border-neon-blue/30">AI</span>
                    </div>
                    <span className="text-xs text-dark-muted">Computer player</span>
                  </div>
                  {isHost && (
                    <button
                      onClick={() => setBots(botCount - 1)}
                      className="text-neon-red hover:text-red-400 text-lg font-bold w-7 h-7 flex items-center justify-center rounded-full hover:bg-neon-red/10 transition-colors"
                      title="Remove bot"
                    >
                      ×
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add AI Bot button (host only, when slots available) */}
            {isHost && totalSlots < room.config.maxPlayers && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setBots(botCount + 1)}
                className="w-full flex items-center gap-3 p-3 bg-dark-bg/50 rounded-xl border border-dashed border-neon-blue/40 hover:border-neon-blue hover:bg-neon-blue/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-neon-blue/10 flex items-center justify-center text-neon-blue group-hover:bg-neon-blue/20 transition-colors">
                  <span className="text-xl font-bold">+</span>
                </div>
                <span className="text-neon-blue text-sm font-medium">Add AI Bot</span>
              </motion.button>
            )}

            {/* Empty human slots */}
            {Array.from({ length: room.config.maxPlayers - totalSlots }, (_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-xl border border-dashed border-dark-border">
                <div className="w-10 h-10 rounded-full bg-dark-border/50 flex items-center justify-center text-dark-muted text-sm">?</div>
                <span className="text-dark-muted text-sm italic">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 flex gap-3">
          <Button variant="ghost" onClick={leaveRoom}>Leave</Button>

          {!isHost && (
            <Button
              variant={myPlayer?.isReady ? 'secondary' : 'primary'}
              onClick={toggleReady}
              fullWidth
            >
              {myPlayer?.isReady ? 'Cancel Ready' : 'Ready!'}
            </Button>
          )}

          {isHost && (
            <Button
              variant="primary"
              onClick={startGame}
              disabled={!canStart}
              fullWidth
            >
              {canStart ? '🎮 Start Game!' : `Waiting for players to ready up...`}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
