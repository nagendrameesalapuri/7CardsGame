import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { notify } from '../../services/notify';

// ── Personality theming ───────────────────────────────────────────────────────
const PERSONALITY_THEME: Record<string, { color: string; glow: string; from: string; to: string; emoji: string; modeName: string }> = {
  safe:       { color: '#22c55e', glow: 'rgba(34,197,94,0.25)',   from: 'rgba(3,18,10,0.98)',  to: 'rgba(5,28,16,0.95)', emoji: '🛡',  modeName: 'Casual Duel'    },
  smart:      { color: '#60a5fa', glow: 'rgba(96,165,250,0.22)',  from: 'rgba(5,12,28,0.98)',  to: 'rgba(8,18,38,0.95)', emoji: '🧠',  modeName: 'Survival Clash' },
  aggressive: { color: '#f97316', glow: 'rgba(249,115,22,0.22)',  from: 'rgba(20,8,3,0.98)',   to: 'rgba(28,12,5,0.95)', emoji: '⚡',  modeName: 'Chaos Arena'    },
  bluff:      { color: '#a855f7', glow: 'rgba(168,85,247,0.22)',  from: 'rgba(14,5,22,0.98)',  to: 'rgba(20,8,30,0.95)', emoji: '🎭',  modeName: 'Bluff Mode'     },
  boss:       { color: '#ef4444', glow: 'rgba(239,68,68,0.25)',   from: 'rgba(20,4,4,0.98)',   to: 'rgba(28,6,6,0.95)',  emoji: '💀',  modeName: 'Boss Rush'      },
};

// ── Shimmer sweep ─────────────────────────────────────────────────────────────
function Shimmer({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <motion.div className="absolute inset-y-0 w-1/3"
        style={{ background: `linear-gradient(105deg, transparent, ${color}08, transparent)`, skewX: '-15deg' }}
        animate={{ x: ['-100%', '400%'] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'linear', repeatDelay: 3 }} />
    </div>
  );
}

// ── Small ambient orb ─────────────────────────────────────────────────────────
function Orb({ x, y, size, color, delay }: { x: string; y: string; size: number; color: string; delay: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: color, filter: `blur(${size * 0.5}px)` }}
      animate={{ y: [0, -12, 0], opacity: [0.4, 0.7, 0.4] }}
      transition={{ repeat: Infinity, duration: 4 + delay, delay, ease: 'easeInOut' }} />
  );
}

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
  const isCashGame = (room.config as any).entryFee > 0;
  const canStart = isHost && totalSlots >= 2 && allReady;
  const personality = (room.config as any).botPersonality ?? 'smart';
  const theme = PERSONALITY_THEME[personality] ?? PERSONALITY_THEME.smart;
  const entryFee = (room.config as any).entryFee ?? 0;

  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    notify.success('Room code copied!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,rgba(4,6,18,1),rgba(6,4,16,1))' }}>

      {/* Ambient background */}
      <Orb x="5%"  y="15%"  size={180} color={`${theme.color}18`} delay={0}   />
      <Orb x="75%" y="60%"  size={220} color={`${theme.color}12`} delay={1.5} />
      <Orb x="50%" y="80%"  size={160} color="rgba(99,102,241,0.1)" delay={0.8} />
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl flex flex-col"
        style={{
          background: `linear-gradient(160deg, ${theme.from}, ${theme.to})`,
          border: `1px solid ${theme.color}30`,
          boxShadow: `0 0 60px ${theme.glow}, 0 24px 64px rgba(0,0,0,0.6)`,
        }}
      >
        <Shimmer color={theme.color} />

        {/* ── Header ── */}
        <div className="relative px-6 pt-6 pb-5 overflow-hidden"
          style={{ borderBottom: `1px solid ${theme.color}18` }}>
          {/* Decorative top-right glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${theme.color}25, transparent 70%)`, filter: 'blur(24px)' }} />

          {/* Mode badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: `${theme.color}18`, border: `1px solid ${theme.color}30` }}>
              {theme.emoji}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: `${theme.color}bb` }}>{theme.modeName}</p>
              <p className="text-[9px] text-dark-muted">{room.config.isPrivate ? '🔒 Private Room' : '🌐 Public Room'}</p>
            </div>
            {isCashGame && (
              <span className="ml-auto text-[10px] font-black px-2 py-1 rounded-lg"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                💰 Cash Game
              </span>
            )}
          </div>

          <h1 className="text-xl font-black text-white leading-tight mb-3">{room.name}</h1>

          {/* Room Code */}
          <button onClick={copyCode}
            className="flex items-center gap-3 group"
          >
            <span className="text-xs text-dark-muted">Room Code</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all group-hover:scale-105"
              style={{ background: `${theme.color}12`, border: `1px solid ${theme.color}30` }}>
              <span className="font-mono font-black text-lg tracking-[0.2em]" style={{ color: theme.color }}>
                {room.code}
              </span>
              <svg className="w-3.5 h-3.5" style={{ color: `${theme.color}80` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </button>

          {/* Config chips */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              { label: `${room.config.maxPlayers}P max` },
              { label: `${room.config.roundCount} rounds` },
              { label: `${room.config.turnTimeLimit}s turns` },
            ].map(chip => (
              <span key={chip.label} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {chip.label}
              </span>
            ))}
            {entryFee > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                ₹{entryFee} entry
              </span>
            )}
            {room.config.isPrivate && (
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                Private
              </span>
            )}
          </div>
        </div>

        {/* ── Cash game prize pool ── */}
        {entryFee > 0 && (
          <div className="mx-5 mt-4 rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,191,36,0.04))', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-yellow-400/60">Entry Fee</p>
              <p className="text-sm text-yellow-200 font-bold mt-0.5">₹{entryFee} per player</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-yellow-400/60">Prize Pool</p>
              <p className="text-2xl font-black text-yellow-300">₹{entryFee * room.config.maxPlayers}</p>
              <p className="text-[9px] text-yellow-400/50">Winner takes all</p>
            </div>
          </div>
        )}

        {/* ── Players section ── */}
        <div className="px-5 py-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">Players</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${theme.color}15`, color: theme.color, border: `1px solid ${theme.color}25` }}>
                {totalSlots}/{room.config.maxPlayers}
              </span>
            </div>
            {!allReady && !isHost && (
              <p className="text-[10px] text-dark-muted animate-pulse">Waiting for players…</p>
            )}
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {/* Human players */}
              {room.players.map((p, i) => {
                const isMe = p.userId === user?.id;
                const isReady = p.isReady || p.isHost;
                return (
                  <motion.div key={p.userId}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative flex items-center gap-3 p-3 rounded-2xl overflow-hidden"
                    style={{
                      background: isMe
                        ? `${theme.color}0d`
                        : 'rgba(255,255,255,0.03)',
                      border: isMe
                        ? `1px solid ${theme.color}25`
                        : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {isMe && isReady && (
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at left, ${theme.color}08, transparent 60%)` }} />
                    )}
                    <Avatar avatar={p.avatar} size="md" isBot={p.isBot} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{p.username}</span>
                        {p.isHost && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg flex-shrink-0"
                            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                            👑 HOST
                          </span>
                        )}
                        {isMe && <span className="text-[10px] text-dark-muted">(you)</span>}
                      </div>
                    </div>
                    {isReady ? (
                      <motion.div
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-xl flex-shrink-0"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                        ✓ Ready
                      </motion.div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-xl flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        ○ Waiting
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Bot slots */}
              {Array.from({ length: botCount }, (_, i) => (
                <motion.div key={`bot-${i}`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 rounded-2xl relative overflow-hidden"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at left, rgba(99,102,241,0.06), transparent 60%)' }} />
                  <Avatar avatar={`bot_${i + 1}`} size="md" isBot />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-sm">AI Bot {i + 1}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                        {theme.emoji} {theme.modeName}
                      </span>
                    </div>
                    <span className="text-[11px] text-dark-muted">Computer player</span>
                  </div>
                  {isHost && !isCashGame && (
                    <button onClick={() => setBots(botCount - 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:scale-110 flex-shrink-0"
                      style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ×
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add AI Bot */}
            {isHost && !isCashGame && totalSlots < room.config.maxPlayers && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => setBots(botCount + 1)}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all group"
                style={{ background: 'rgba(99,102,241,0.04)', border: '1px dashed rgba(99,102,241,0.28)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  🤖
                </div>
                <span className="text-sm font-semibold" style={{ color: 'rgba(99,102,241,0.7)' }}>Add AI Bot</span>
                <span className="ml-auto text-lg" style={{ color: 'rgba(99,102,241,0.5)' }}>+</span>
              </motion.button>
            )}

            {/* Empty slots */}
            {Array.from({ length: room.config.maxPlayers - totalSlots }, (_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-dark-muted text-base flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>?</div>
                <span className="text-dark-muted text-xs italic">Waiting for player…</span>
                <motion.span className="ml-auto text-dark-muted text-sm"
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}>○</motion.span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="px-5 pb-5 flex gap-3">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={leaveRoom}
            className="px-4 py-3 rounded-2xl text-sm font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Leave
          </motion.button>

          {!isHost && (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={toggleReady}
              className="flex-1 py-3 rounded-2xl text-sm font-black transition-all"
              style={myPlayer?.isReady
                ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
                : { background: `${theme.color}22`, color: theme.color, border: `1px solid ${theme.color}45` }}>
              {myPlayer?.isReady ? '✓ Cancel Ready' : '🎮 Ready!'}
            </motion.button>
          )}

          {isHost && (
            <motion.button
              whileHover={canStart ? { scale: 1.02 } : {}}
              whileTap={canStart ? { scale: 0.97 } : {}}
              onClick={startGame}
              disabled={!canStart}
              className="flex-1 py-3 rounded-2xl text-sm font-black relative overflow-hidden transition-all disabled:opacity-40"
              style={canStart
                ? {
                    background: `linear-gradient(135deg, ${theme.color}dd, ${theme.color}aa)`,
                    color: '#fff',
                    boxShadow: `0 4px 24px ${theme.glow}`,
                    border: `1px solid ${theme.color}60`,
                  }
                : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {canStart ? (
                <>
                  <Shimmer color={theme.color} />
                  <span className="relative">🎮 Start Game!</span>
                </>
              ) : 'Waiting for players…'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
