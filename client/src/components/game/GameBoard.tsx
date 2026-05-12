import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { PlayerHand } from './PlayerHand';
import { DeckArea } from './DeckArea';
import { TurnTimer } from './TurnTimer';
import { ShowButton } from './ShowButton';
import { ScoreBoard } from './ScoreBoard';
import { WinnerCelebration } from './WinnerCelebration';
import { ChatPanel } from './ChatPanel';
import { LiveScorePanel } from './LiveScorePanel';
import { ShowDeclaredOverlay } from './ShowDeclaredOverlay';
import { ActionButtons } from './ActionButtons';
import { VoiceChat } from './VoiceChat';

export function GameBoard() {
  const { user } = useAuthStore();
  const {
    game, matchResult, isMyTurn, canShow, underAttack, handTotal,
    roundReadyUpdate, readyForNextRound,
    subscribeToEvents, leaveRoom,
  } = useGameStore();
  const [showAnnouncing, setShowAnnouncing] = React.useState(false);

  useEffect(() => {
    const unsub = subscribeToEvents();
    return unsub;
  }, [subscribeToEvents]);

  useEffect(() => {
    if (game?.showPlayerId && game.status === 'show_called') {
      setShowAnnouncing(true);
    }
  }, [game?.showPlayerId]);

  if (!game) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-dark-muted animate-pulse">Loading game...</div>
    </div>
  );

  const currentPlayer = game.players[game.currentPlayerIndex];
  const myHand = game?.myHand ?? [];
  const allOpponents = game.players.filter(p => p.id !== game.myPlayerId && !p.isEliminated);

  return (
    <div className="relative w-full h-[100dvh] bg-felt bg-felt-pattern overflow-hidden flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10 z-10">
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={leaveRoom}
            className="text-dark-muted hover:text-neon-red transition-colors text-sm flex items-center gap-1"
          >
            ← Leave
          </button>
          <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full">
            <span className="text-dark-muted text-[10px] uppercase tracking-wider">Round</span>
            <span className="text-dark-text font-black text-sm">{game.roundNumber}</span>
            <span className="text-dark-muted text-[10px]">/{game.roundCount}</span>
          </div>
        </div>

        <TurnTimer
          turnStartTime={game.turnStartTime}
          turnTimeLimit={game.turnTimeLimit}
          isMyTurn={isMyTurn}
          currentPlayerName={currentPlayer?.username ?? ''}
        />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <VoiceChat />
          <ChatPanel
            messages={game.chatMessages}
            playerCount={game.players.filter(p => !p.isEliminated && p.isConnected && !p.isBot).length || game.players.length}
          />
        </div>
      </div>

      {/* ── Mobile scores bar ───────────────────────────────────────────────── */}
      <div className="sm:hidden flex items-center gap-2 px-3 py-1.5 bg-black/50 border-b border-white/5 overflow-x-auto z-10">
        {[...game.players]
          .sort((a, b) => a.totalScore - b.totalScore)
          .map((p, rank) => (
            <div key={p.id} className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
              p.id === game.myPlayerId
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                : 'bg-white/5 text-dark-muted',
            )}>
              <span>{rank === 0 ? '👑' : `#${rank + 1}`}</span>
              <span>{p.id === game.myPlayerId ? 'You' : p.username}</span>
              <span className="font-bold">{p.totalScore}pt</span>
            </div>
          ))}
      </div>

      {/* ── Main game area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 gap-2 sm:gap-3 relative overflow-hidden">

        {/* Live score leaderboard — desktop only */}
        <div className="hidden sm:block">
          <LiveScorePanel
            players={game.players}
            myPlayerId={game.myPlayerId}
            roundNumber={game.roundNumber}
            roundCount={game.roundCount}
          />
        </div>

        {/* ── All opponents side by side ── */}
        <div className="flex gap-2 sm:gap-3 justify-center overflow-x-auto w-full px-1 flex-shrink-0 py-0.5">
          {allOpponents.map(opp => (
            <OpponentChip
              key={opp.id}
              player={opp}
              isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opp.id}
              isAttackTarget={!!(game.attackChain && game.players[game.attackChain.targetPlayerIndex]?.id === opp.id)}
            />
          ))}
        </div>

        {/* ── Action notification — sits between opponents and deck ── */}
        <ActionToast />

        {/* Deck area */}
        <div className="flex-1 flex items-center justify-center">
          <DeckArea
            deckCount={game.deckCount}
            discardPile={game.discardPile}
            jokerRank={game.jokerRank}
            jokerCard={game.jokerCard}
            isMyTurn={isMyTurn}
            hasDrawnThisTurn={game.hasDrawnThisTurn}
            underAttack={underAttack}
          />
        </div>

        {/* Player section: action bar + hand + SHOW button */}
        <div className="w-full flex flex-col gap-2">
          {/* Mobile action bar */}
          <div className="sm:hidden w-full px-1">
            <ActionButtons
              hand={myHand}
              isMyTurn={isMyTurn}
              hasDrawnThisTurn={game.hasDrawnThisTurn}
              underAttack={underAttack}
            />
          </div>

          <div className="w-full bg-black/30 backdrop-blur rounded-2xl p-2 sm:p-4 border border-white/10">
            <PlayerHand
              hand={myHand}
              isMyTurn={isMyTurn}
              hasDrawnThisTurn={game.hasDrawnThisTurn}
              underAttack={underAttack}
              handTotal={handTotal}
            />
          </div>

          {/* SHOW button — full width at bottom */}
          <AnimatePresence>
            {canShow && <ShowButton key="show-btn" />}
          </AnimatePresence>
        </div>
      </div>

      {/* ── SHOW declared announcement ───────────────────────────────────────── */}
      <AnimatePresence>
        {showAnnouncing && game.showPlayerId && (
          <ShowDeclaredOverlay
            key="show-announced"
            showPlayer={game.players.find(p => p.id === game.showPlayerId)}
            isMe={game.showPlayerId === game.myPlayerId}
            onDone={() => setShowAnnouncing(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Score board (round end) ──────────────────────────────────────────── */}
      <AnimatePresence>
        {!showAnnouncing && game.status === 'show_called' && game.roundResult && (
          <ScoreBoard
            key="scoreboard"
            roundResult={game.roundResult}
            players={game.players}
            roundNumber={game.roundNumber}
            roundCount={game.roundCount}
            myUserId={user?.id ?? ''}
            roundReadyUpdate={roundReadyUpdate}
            onReady={readyForNextRound}
          />
        )}
      </AnimatePresence>

      {/* ── Match winner ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {matchResult && (
          <WinnerCelebration
            key="winner"
            result={matchResult}
            onClose={leaveRoom}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

const ACTION_STYLE: Record<string, { icon: string; iconBg: string; bg: string; border: string }> = {
  draw:    { icon: '🃏', iconBg: '#2563eb', bg: 'rgba(5,10,30,0.97)',  border: 'rgba(37,99,235,0.5)' },
  discard: { icon: '♠️', iconBg: '#475569', bg: 'rgba(10,10,15,0.97)', border: 'rgba(71,85,105,0.5)' },
  skip:    { icon: '⏭️', iconBg: '#d97706', bg: 'rgba(25,18,5,0.97)',  border: 'rgba(217,119,6,0.5)' },
  attack:  { icon: '⚔️', iconBg: '#dc2626', bg: 'rgba(30,5,5,0.97)',   border: 'rgba(220,38,38,0.5)' },
  penalty: { icon: '💀', iconBg: '#b91c1c', bg: 'rgba(30,5,5,0.97)',   border: 'rgba(220,38,38,0.5)' },
  show:    { icon: '🎉', iconBg: '#16a34a', bg: 'rgba(5,25,10,0.97)',  border: 'rgba(22,163,74,0.5)' },
  system:  { icon: 'ℹ️', iconBg: '#1d4ed8', bg: 'rgba(5,10,28,0.97)', border: 'rgba(29,78,216,0.5)' },
};

const CHIP_COLORS = [
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-700',
];

function getChipColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
  return CHIP_COLORS[Math.abs(hash) % CHIP_COLORS.length];
}

function OpponentChip({
  player,
  isCurrentTurn,
  isAttackTarget,
}: {
  player: { id: string; username: string; avatar?: string; handCount: number; totalScore: number; isEliminated?: boolean; isBot?: boolean };
  isCurrentTurn: boolean;
  isAttackTarget: boolean;
}) {
  const color = getChipColor(player.username);
  const initials = player.username.slice(0, 2).toUpperCase();

  return (
    <div className={clsx(
      'flex flex-col items-center gap-1 px-2 sm:px-3 py-2 rounded-2xl border flex-shrink-0 min-w-[72px] sm:min-w-[92px] transition-all duration-200',
      isCurrentTurn
        ? 'border-neon-green/80 bg-neon-green/10 shadow-neon-green'
        : isAttackTarget
        ? 'border-neon-red/80 bg-neon-red/10'
        : 'border-white/10 bg-black/30',
    )}>
      {isCurrentTurn && (
        <motion.div
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.75 }}
          className="bg-neon-green text-dark-bg text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider leading-none"
        >
          TURN
        </motion.div>
      )}
      {isAttackTarget && (
        <div className="bg-neon-red text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider leading-none animate-pulse">
          ⚔️ ATK
        </div>
      )}

      {/* Colored initials circle */}
      <div className={clsx(
        'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-black text-white shadow-md',
        color,
        isCurrentTurn && 'ring-2 ring-neon-green ring-offset-1 ring-offset-black/50',
        isAttackTarget && 'ring-2 ring-neon-red ring-offset-1 ring-offset-black/50',
      )}>
        {player.isBot
          ? <span className="text-[10px] font-black">AI</span>
          : <span className="text-sm">{initials}</span>
        }
      </div>

      <span className="text-dark-text text-[10px] sm:text-xs font-semibold truncate w-full text-center leading-tight">
        {player.username.length > 8 ? player.username.slice(0, 7) + '…' : player.username}
      </span>

      <div className="flex items-center gap-0.5">
        <span className="text-dark-muted text-[10px] sm:text-xs">🃏 {player.handCount}</span>
        {player.handCount <= 3 && !player.isEliminated && (
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
            className="text-yellow-400 text-[10px]"
          >⚠️</motion.span>
        )}
      </div>

      {player.isEliminated ? (
        <span className="bg-neon-red/20 text-neon-red text-[9px] font-bold px-2 py-0.5 rounded-full">OUT</span>
      ) : (
        <span className={clsx(
          'text-[10px] sm:text-[11px] font-bold',
          player.totalScore > 80 ? 'text-neon-red' : player.totalScore > 50 ? 'text-yellow-400' : 'text-dark-muted',
        )}>
          {player.totalScore} pts
        </span>
      )}
    </div>
  );
}

function ActionToast() {
  const { lastAction } = useGameStore();
  const [visible, setVisible] = React.useState(false);
  const [action, setAction] = React.useState<typeof lastAction>(null);

  React.useEffect(() => {
    if (!lastAction?.message) return;
    setAction(lastAction);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [lastAction]);

  const style = ACTION_STYLE[action?.type ?? 'system'] ?? ACTION_STYLE.system;

  // Render as inline flex item — sits between opponent strip and deck area in the layout.
  // AnimatePresence removes it from the DOM when not visible, so it takes zero layout space.
  return (
    <AnimatePresence>
      {visible && action && (
        <motion.div
          key="action-toast"
          initial={{ opacity: 0, y: -6, scaleY: 0.85 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: -6, scaleY: 0.85 }}
          className="w-full flex-shrink-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: 12,
            padding: '7px 14px 7px 10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{
            background: style.iconBg,
            width: 26,
            height: 26,
            borderRadius: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 13,
          }}>
            {style.icon}
          </div>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
            {action.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
