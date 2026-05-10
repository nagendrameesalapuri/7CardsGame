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

export function GameBoard() {
  const { user } = useAuthStore();
  const {
    game, matchResult, isMyTurn, canShow, underAttack, handTotal,
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

  return (
    <div className="relative w-full h-full min-h-screen bg-felt bg-felt-pattern overflow-hidden flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 backdrop-blur-sm border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={leaveRoom}
            className="text-dark-muted hover:text-neon-red transition-colors text-sm flex items-center gap-1"
          >
            ← Leave
          </button>
          <span className="text-dark-muted text-sm">
            Round <span className="text-dark-text font-bold">{game.roundNumber}</span>
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

      {/* ── Main game area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between p-4 gap-4 relative">

        {/* Live score leaderboard */}
        <LiveScorePanel
          players={game.players}
          myPlayerId={game.myPlayerId}
          roundNumber={game.roundNumber}
          roundCount={game.roundCount}
        />

        {/* Top opponents */}
        <div className="flex gap-8 justify-center flex-wrap">
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
          {/* Left opponents */}
          <div className="flex flex-col gap-4">
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

          {/* Center: deck area */}
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

          {/* Right opponents */}
          <div className="flex flex-col gap-4">
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
        <div className="w-full flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {canShow && <ShowButton key="show-btn" />}
            </AnimatePresence>
          </div>

          <div className="w-full bg-black/30 backdrop-blur rounded-2xl p-4 pb-6 border border-white/10">
            <PlayerHand
              hand={game.myHand}
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
            onContinue={() => {}}
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

function ActionToast() {
  const { lastAction } = useGameStore();
  const [visible, setVisible] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    if (!lastAction?.message) return;
    setMsg(lastAction.message);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [lastAction]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-dark-surface/90 border border-dark-border rounded-full text-dark-text text-sm font-medium shadow-xl backdrop-blur"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
