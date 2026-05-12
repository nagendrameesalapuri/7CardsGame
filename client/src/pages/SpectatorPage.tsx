import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { connectSpectatorSocket, onSpectator, disconnectSpectatorSocket, socketSpectate } from '../services/socket';
import { SpectatorGameState, ClientPlayerState, ChatMessage } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', clubs: '♣', hearts: '♥', diamonds: '♦', none: '',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

function JokerBadge({ rank }: { rank: string }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
      style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}
    >
      <span className="text-yellow-300 font-bold">Joker: {rank}</span>
    </div>
  );
}

function DiscardTop({ card }: { card: any }) {
  if (!card) return (
    <div className="w-12 h-16 rounded-lg border-2 border-dashed border-dark-border flex items-center justify-center text-dark-muted text-xs">
      Empty
    </div>
  );
  const isPrintedJoker = card.rank === 'Joker';
  const isRed = RED_SUITS.has(card.suit);
  const suit = SUIT_SYMBOL[card.suit] ?? '';
  return (
    <div className={clsx(
      'w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-between p-1 text-center leading-none select-none',
      card.isJoker ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
        : isRed ? 'bg-white border-red-400 text-red-600'
        : 'bg-white border-slate-400 text-slate-800'
    )}>
      <span className="text-xs font-bold">{isPrintedJoker ? '🃏' : card.rank}</span>
      <span className="text-base">{card.isJoker && !isPrintedJoker ? '★' : suit}</span>
      <span className="text-xs font-bold opacity-60">{card.value}</span>
    </div>
  );
}

function PlayerCard({ player, isCurrent, isShowCaller }: { player: any; isCurrent: boolean; isShowCaller: boolean }) {
  return (
    <motion.div
      layout
      className={clsx(
        'flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all',
        player.isEliminated ? 'opacity-40' : '',
        isCurrent ? 'ring-2 ring-neon-green' : ''
      )}
      style={{
        background: isCurrent ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)',
        border: isCurrent ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.07)',
        minWidth: 72,
      }}
    >
      {/* Avatar placeholder */}
      <div className={clsx(
        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-black',
        player.isBot ? 'bg-neon-blue/30 text-neon-blue' : 'bg-neon-green/20 text-neon-green'
      )}>
        {player.isBot ? '🤖' : player.username.slice(0, 1).toUpperCase()}
      </div>

      <p className="text-[10px] font-semibold text-dark-text truncate max-w-[72px] text-center">{player.username}</p>

      {/* Hand count facedown cards */}
      <div className="flex gap-0.5 justify-center">
        {Array.from({ length: Math.min(player.handCount, 7) }).map((_, i) => (
          <div key={i} className="w-3.5 h-5 rounded bg-gradient-to-b from-blue-700 to-blue-900 border border-blue-600" />
        ))}
      </div>
      <p className="text-[10px] text-dark-muted">{player.handCount} cards</p>

      {/* Hand total */}
      {(player as any).handTotal !== undefined && (
        <div className="px-2 py-0.5 rounded-lg text-center"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-[11px] font-black text-white">{(player as any).handTotal}</span>
          <span className="text-[9px] text-dark-muted ml-0.5">pts</span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-dark-muted">Total: <span className="font-bold text-neon-green">{player.totalScore}</span></span>
        {isCurrent && !player.isEliminated && (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="text-[9px] font-black text-neon-green"
          >▶</motion.span>
        )}
        {isShowCaller && (
          <span className="text-[9px] font-black text-yellow-400">📢</span>
        )}
        {player.isEliminated && <span className="text-[9px] text-neon-red">OUT</span>}
      </div>
    </motion.div>
  );
}

// ── Main Spectator Page ───────────────────────────────────────────────────────

export function SpectatorPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<SpectatorGameState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [gameEnded, setGameEnded] = useState<{ winner: string } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code) { navigate('/lobby'); return; }

    const s = connectSpectatorSocket();

    s.on('connect', () => {
      setConnected(true);
      socketSpectate.join(code.toUpperCase());
    });

    const unsubState   = onSpectator('spectate:state',  (state) => setGameState(state as SpectatorGameState));
    const unsubJoined  = onSpectator('spectate:joined', (data: any) => setSpectatorCount(data.spectatorCount));
    const unsubCount   = onSpectator('spectate:count',  (data: any) => setSpectatorCount(data.count));
    const unsubError   = onSpectator('spectate:error',  (msg: any) => setError(String(msg)));
    const unsubEnded   = onSpectator('spectate:game_ended', (data: any) => {
      setGameEnded({ winner: data.winner });
      // Auto-redirect to lobby after 4 seconds
      setTimeout(() => navigate('/lobby'), 4000);
    });

    return () => {
      unsubState(); unsubJoined(); unsubCount(); unsubError(); unsubEnded();
      socketSpectate.leave();
      disconnectSpectatorSocket();
    };
  }, [code, navigate]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [gameState?.chatMessages?.length]);

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-4xl">😔</p>
          <p className="text-dark-text font-bold">{error}</p>
          <button onClick={() => navigate('/lobby')} className="text-neon-green text-sm hover:underline">← Back to Lobby</button>
        </div>
      </div>
    );
  }

  if (!connected || !gameState) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-8 h-8 rounded-full border-2 border-neon-green border-t-transparent mx-auto"
          />
          <p className="text-dark-muted text-sm">Connecting to live match…</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
  const chatMessages: ChatMessage[] = gameState.chatMessages ?? [];

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col" style={{ background: 'linear-gradient(135deg, #071a0e 0%, #05090f 100%)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/lobby')} className="text-dark-muted hover:text-dark-text text-xs">← Lobby</button>

          {/* LIVE badge */}
          <motion.div
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{ background: 'rgba(255,59,92,0.2)', border: '1px solid rgba(255,59,92,0.5)', color: '#ff3b5c' }}
          >
            ● LIVE
          </motion.div>

          <div className="flex items-center gap-1 text-[10px] text-dark-muted">
            <span>👁</span>
            <span>{spectatorCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-dark-muted">
          <span>Round</span>
          <span className="font-bold text-dark-text">{gameState.roundNumber}/{gameState.roundCount}</span>
        </div>

        <div className="flex items-center gap-2">
          <JokerBadge rank={gameState.jokerRank} />
          <button
            onClick={() => setShowChat(v => !v)}
            className="relative p-1.5 rounded-lg text-dark-muted hover:text-dark-text transition-colors"
          >
            💬
            {chatMessages.length > 0 && !showChat && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-red text-[8px] flex items-center justify-center text-white font-bold">
                {Math.min(chatMessages.length, 9)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Spectating badge ────────────────────────────────────────── */}
      <div className="px-3 py-1.5 flex items-center justify-center gap-2"
        style={{ background: 'rgba(147,51,234,0.1)', borderBottom: '1px solid rgba(147,51,234,0.2)' }}
      >
        <span className="text-purple-400 text-xs">👁 Spectating Live Match</span>
        <span className="text-purple-400/50 text-xs">·</span>
        <span className="text-purple-400/70 text-xs">{gameState.players.filter((p: ClientPlayerState) => !p.isEliminated).length} players</span>
      </div>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-3 overflow-auto">

        {/* Game area */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Turn info */}
          {currentPlayer && (
            <motion.div
              key={currentPlayer.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl"
              style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)' }}
            >
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="text-neon-green text-xs font-bold"
              >▶</motion.span>
              <span className="text-neon-green text-xs font-semibold">{currentPlayer.username}'s turn</span>
              <span className="text-dark-muted text-xs">· {gameState.deckCount} cards in deck</span>
            </motion.div>
          )}

          {/* Discard + Deck info */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-dark-muted uppercase tracking-wide">Discard</p>
              <DiscardTop card={discardTop} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-dark-muted uppercase tracking-wide">Deck</p>
              <div className="w-12 h-16 rounded-lg bg-gradient-to-b from-blue-700 to-blue-900 border-2 border-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">{gameState.deckCount}</span>
              </div>
            </div>
          </div>

          {/* Players grid */}
          <div className="flex flex-wrap justify-center gap-3">
            {gameState.players.map((p: ClientPlayerState, i: number) => (
              <PlayerCard
                key={p.id}
                player={p}
                isCurrent={i === gameState.currentPlayerIndex && gameState.status === 'playing'}
                isShowCaller={p.id === gameState.showPlayerId}
              />
            ))}
          </div>

          {/* Attack / Show status */}
          {gameState.attackChain && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl"
              style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)' }}
            >
              <span className="text-neon-red text-sm">⚡ Attack chain!</span>
              <span className="text-dark-muted text-xs">
                {gameState.attackChain.sevensCount}× 7 · {gameState.attackChain.penaltyCards} penalty cards
              </span>
            </motion.div>
          )}

          {gameState.showPlayerId && gameState.status === 'show_called' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 py-2 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              <span className="text-yellow-400 text-sm">📢 SHOW declared!</span>
              <span className="text-dark-muted text-xs">
                by {gameState.players.find((p: ClientPlayerState) => p.id === gameState.showPlayerId)?.username}
              </span>
            </motion.div>
          )}
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full md:w-72 flex flex-col rounded-2xl overflow-hidden"
              style={{ background: 'rgba(12,14,18,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <span className="text-xs font-semibold text-dark-muted">Live Chat</span>
                <button onClick={() => setShowChat(false)} className="text-dark-muted text-sm hover:text-dark-text">✕</button>
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '60vh' }}>
                {chatMessages.length === 0 ? (
                  <p className="text-dark-muted text-xs text-center py-4">No messages yet</p>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={clsx('text-xs rounded-xl px-3 py-2 leading-relaxed',
                      msg.type === 'system'
                        ? 'text-dark-muted text-center'
                        : msg.type === 'reaction'
                        ? 'text-center text-xl'
                        : 'bg-white/5 text-dark-text'
                    )}>
                      {msg.type === 'chat' && (
                        <span className="font-semibold text-neon-green">{msg.username}: </span>
                      )}
                      {msg.message}
                    </div>
                  ))
                )}
              </div>

              <div className="px-3 py-2 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] text-dark-muted">Read-only · Spectators cannot chat</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
