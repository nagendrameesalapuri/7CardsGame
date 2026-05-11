import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { DeckArea } from './DeckArea';
import { TurnTimer } from './TurnTimer';
import { ShowButton } from './ShowButton';
import { ScoreBoard } from './ScoreBoard';
import { WinnerCelebration } from './WinnerCelebration';
import { ChatPanel } from './ChatPanel';
import { LiveScorePanel } from './LiveScorePanel';
import { ShowDeclaredOverlay } from './ShowDeclaredOverlay';
import { ActionButtons } from './ActionButtons';
import { Avatar } from '../ui/Avatar';

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

  // When SHOW is declared, show the announcement overlay before revealing cards
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

  const myPlayerIndex = game.players.findIndex(p => p.id === game.myPlayerId);
  const currentPlayer = game.players[game.currentPlayerIndex];

  // Arrange opponents: top (opposite), left, right
  const opponents = game.players.filter(p => p.id !== game.myPlayerId && !p.isEliminated);
  const topOpponents = opponents.length === 1 ? [opponents[0]] :
    opponents.length === 2 ? [opponents[0], opponents[1]] :
    [opponents[1]]; // center top
  const leftOpponents = opponents.length >= 3 ? [opponents[0]] : [];
  const rightOpponents = opponents.length >= 4 ? [opponents[2]] :
    opponents.length >= 3 ? [opponents[2] ?? opponents[opponents.length - 1]] : [];

  const myHand = game?.myHand ?? [];
  const allOpponents = game.players.filter(p => p.id !== game.myPlayerId && !p.isEliminated);

  return (
    <div className="relative w-full h-[100dvh] bg-felt bg-felt-pattern overflow-hidden flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={leaveRoom}
            className="text-dark-muted hover:text-neon-red transition-colors text-sm flex items-center gap-1"
          >
            ← Leave
          </button>
          <span className="text-dark-muted text-xs sm:text-sm">
            R<span className="text-dark-text font-bold">{game.roundNumber}</span>
            <span className="text-dark-muted">/{game.roundCount}</span>
          </span>
        </div>

        <TurnTimer
          turnStartTime={game.turnStartTime}
          turnTimeLimit={game.turnTimeLimit}
          isMyTurn={isMyTurn}
          currentPlayerName={currentPlayer?.username ?? ''}
        />

        <ChatPanel messages={game.chatMessages} />
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
      <div className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 gap-2 sm:gap-4 relative overflow-hidden">

        {/* Live score leaderboard — desktop only */}
        <div className="hidden sm:block">
          <LiveScorePanel
            players={game.players}
            myPlayerId={game.myPlayerId}
            roundNumber={game.roundNumber}
            roundCount={game.roundCount}
          />
        </div>

        {/* ── MOBILE: compact opponent strip (all opponents in one row) ── */}
        <div className="sm:hidden flex gap-2 justify-center overflow-x-auto w-full px-1 flex-shrink-0">
          {allOpponents.map(opp => (
            <MiniOpponent
              key={opp.id}
              player={opp}
              isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opp.id}
              isAttackTarget={!!(game.attackChain && game.players[game.attackChain.targetPlayerIndex]?.id === opp.id)}
            />
          ))}
        </div>

        {/* ── DESKTOP: top opponents ── */}
        <div className="hidden sm:flex gap-8 justify-center flex-wrap">
          {topOpponents.map(opp => (
            <OpponentHand
              key={opp.id}
              player={opp}
              isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opp.id}
              isAttackTarget={game.attackChain?.targetPlayerIndex === game.players.indexOf(opp)}
              jokerRank={game.jokerRank}
              position="top"
            />
          ))}
        </div>

        {/* Middle row: left, center, right */}
        <div className="flex-1 w-full flex items-center justify-between gap-4 max-w-4xl mx-auto">
          {/* Left opponents — desktop only */}
          <div className="hidden sm:flex flex-col gap-4">
            {leftOpponents.map(opp => (
              <OpponentHand
                key={opp.id}
                player={opp}
                isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opp.id}
                isAttackTarget={game.attackChain?.targetPlayerIndex === game.players.indexOf(opp)}
                jokerRank={game.jokerRank}
                position="left"
              />
            ))}
          </div>

          {/* Center: deck area — full width on mobile */}
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

          {/* Right opponents — desktop only */}
          <div className="hidden sm:flex flex-col gap-4">
            {rightOpponents.map(opp => (
              <OpponentHand
                key={opp.id}
                player={opp}
                isCurrentTurn={game.players[game.currentPlayerIndex]?.id === opp.id}
                isAttackTarget={game.attackChain?.targetPlayerIndex === game.players.indexOf(opp)}
                jokerRank={game.jokerRank}
                position="right"
              />
            ))}
          </div>
        </div>

        {/* Player section: SHOW button + hand */}
        <div className="w-full flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {canShow && <ShowButton key="show-btn" />}
            </AnimatePresence>
          </div>

          {/* Mobile action bar — always visible above cards, hidden on desktop */}
          <div className="sm:hidden w-full px-3">
            <ActionButtons
              hand={myHand}
              isMyTurn={isMyTurn}
              hasDrawnThisTurn={game.hasDrawnThisTurn}
              underAttack={underAttack}
            />
          </div>

          <div className="w-full bg-black/30 backdrop-blur rounded-2xl p-3 sm:p-4 border border-white/10">
            <PlayerHand
              hand={myHand}
              isMyTurn={isMyTurn}
              hasDrawnThisTurn={game.hasDrawnThisTurn}
              underAttack={underAttack}
              handTotal={handTotal}
            />
          </div>
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

      {/* ── Last action toast ────────────────────────────────────────────────── */}
      <ActionToast />
    </div>
  );
}

const ACTION_STYLE: Record<string, { icon: string; iconBg: string; bg: string; border: string }> = {
  draw:    { icon: '🃏', iconBg: '#2563eb', bg: 'rgba(5,10,30,0.95)',  border: 'rgba(37,99,235,0.35)' },
  discard: { icon: '♠️', iconBg: '#475569', bg: 'rgba(10,10,15,0.95)', border: 'rgba(71,85,105,0.35)' },
  skip:    { icon: '⏭️', iconBg: '#d97706', bg: 'rgba(25,18,5,0.95)',  border: 'rgba(217,119,6,0.35)' },
  attack:  { icon: '⚔️', iconBg: '#dc2626', bg: 'rgba(30,5,5,0.95)',   border: 'rgba(220,38,38,0.35)' },
  penalty: { icon: '💀', iconBg: '#b91c1c', bg: 'rgba(30,5,5,0.95)',   border: 'rgba(220,38,38,0.35)' },
  show:    { icon: '🎉', iconBg: '#16a34a', bg: 'rgba(5,25,10,0.95)',  border: 'rgba(22,163,74,0.35)' },
  system:  { icon: 'ℹ️', iconBg: '#1d4ed8', bg: 'rgba(5,10,28,0.95)', border: 'rgba(29,78,216,0.35)' },
};

function MiniOpponent({
  player,
  isCurrentTurn,
  isAttackTarget,
}: {
  player: { id: string; username: string; avatar?: string; handCount: number; totalScore: number; isEliminated?: boolean };
  isCurrentTurn: boolean;
  isAttackTarget: boolean;
}) {
  return (
    <div className={clsx(
      'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border flex-shrink-0 min-w-[64px] max-w-[80px]',
      isCurrentTurn ? 'border-neon-green/60 bg-neon-green/10' :
      isAttackTarget ? 'border-neon-red/60 bg-neon-red/10' :
      'border-white/10 bg-black/30',
    )}>
      <div className="relative">
        <Avatar avatar={player.avatar ?? 'avatar_1'} size="sm" username={player.username} />
        {isCurrentTurn && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-neon-green border border-black" />
        )}
      </div>
      <span className="text-dark-text text-[10px] font-medium truncate w-full text-center leading-tight">
        {player.username.length > 7 ? player.username.slice(0, 6) + '…' : player.username}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-dark-muted text-[10px]">🃏{player.handCount}</span>
        {player.handCount <= 3 && !player.isEliminated && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
            className="text-yellow-400 text-[10px]"
          >⚠️</motion.span>
        )}
      </div>
      <span className="text-dark-muted text-[9px]">{player.totalScore}pt</span>
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

  return (
    <AnimatePresence>
      {visible && action && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="fixed left-1/2 -translate-x-1/2 z-30 top-[155px] sm:top-auto sm:bottom-[280px]"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: 14,
            padding: '9px 14px 9px 9px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(14px)',
            maxWidth: '88vw',
            minWidth: 220,
          }}
        >
          {/* Colored icon square */}
          <div style={{
            background: style.iconBg,
            width: 32,
            height: 32,
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 16,
          }}>
            {style.icon}
          </div>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
            {action.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
