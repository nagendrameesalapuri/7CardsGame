import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { AchievementBadge } from '../AchievementBadge';
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
import { useTournamentStore } from '../../store/tournamentStore';
import { useSurvivalStore } from '../../store/survivalStore';

// ── Premium game-mode badge ───────────────────────────────────────────────────
function GameModeBadge({ isTournament, tournamentFee, playerWins, botWins, gameNumber,
                         isSurvival, survivalStage, survivalTier, entryFee }: {
  isTournament: boolean; tournamentFee: number; playerWins: number; botWins: number; gameNumber: number;
  isSurvival: boolean; survivalStage: number; survivalTier: string | null; entryFee: number;
}) {
  if (isTournament) {
    return (
      <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.18),rgba(239,68,68,0.12))', border: '1px solid rgba(251,191,36,0.35)' }}>
        <span className="text-sm">⚔️</span>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] text-yellow-400/70 font-semibold uppercase tracking-widest">Tournament · ₹{tournamentFee}</span>
          <span className="text-[11px] font-black text-white">
            G{gameNumber} &nbsp;
            <span className="text-green-400">{playerWins}W</span>
            <span className="text-dark-muted mx-0.5">–</span>
            <span className="text-red-400">{botWins}W</span>
          </span>
        </div>
      </div>
    );
  }
  if (isSurvival) {
    const STAGE_COLORS = ['#22c55e','#f59e0b','#a855f7','#3b82f6','#ef4444'];
    const color = STAGE_COLORS[(survivalStage - 1) % 5];
    const tierLabel = survivalTier ? survivalTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
    return (
      <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 flex-shrink-0"
        style={{ background: `linear-gradient(135deg,${color}22,rgba(99,102,241,0.12))`, border: `1px solid ${color}55` }}>
        <span className="text-sm">🏆</span>
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: `${color}cc` }}>Survival · {tierLabel}</span>
          <span className="text-[11px] font-black text-white">Stage <span style={{ color }}>{survivalStage}</span>/5</span>
        </div>
      </div>
    );
  }
  if (entryFee > 0) {
    return (
      <span className="text-[10px] font-black px-2.5 py-1 rounded-xl flex-shrink-0"
        style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
        💰 Bet ₹{entryFee}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-black px-2.5 py-1 rounded-xl flex-shrink-0"
      style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
      🎮 Free
    </span>
  );
}

// ── Premium felt background ───────────────────────────────────────────────────
function PremiumTableBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Deep felt base */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 90% 70% at 50% 45%, rgba(0,72,36,0.85) 0%, rgba(0,48,22,0.92) 40%, rgba(0,24,10,0.98) 80%, rgba(0,12,6,1) 100%)',
      }} />
      {/* Spotlight center glow */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 42%, rgba(0,120,60,0.25) 0%, transparent 70%)',
      }} />
      {/* Edge vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)',
      }} />
      {/* Subtle felt texture lines */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)',
      }} />
      {/* Card suit watermarks at corners */}
      <div className="absolute top-6 left-6 text-6xl sm:text-8xl font-black select-none" style={{ color: 'rgba(0,100,40,0.18)', lineHeight: 1 }}>♠</div>
      <div className="absolute top-6 right-6 text-6xl sm:text-8xl font-black select-none" style={{ color: 'rgba(80,0,0,0.14)', lineHeight: 1 }}>♥</div>
      <div className="absolute bottom-28 left-6 text-6xl sm:text-8xl font-black select-none" style={{ color: 'rgba(80,0,0,0.14)', lineHeight: 1 }}>♦</div>
      <div className="absolute bottom-28 right-6 text-6xl sm:text-8xl font-black select-none" style={{ color: 'rgba(0,100,40,0.18)', lineHeight: 1 }}>♣</div>
      {/* Oval table rim */}
      <div className="absolute top-[18%] left-[5%] right-[5%] bottom-[20%] rounded-[40%] pointer-events-none"
        style={{ border: '2px solid rgba(0,180,80,0.08)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

export function GameBoard() {
  const { user } = useAuthStore();
  const {
    game, room, matchResult, isMyTurn, canShow, underAttack, handTotal,
    roundReadyUpdate, readyForNextRound,
    subscribeToEvents, leaveRoom,
  } = useGameStore();
  const entryFee: number = (room?.config as any)?.entryFee ?? 0;
  const { active: isTournament, entryFee: tournamentFee, playerWins, botWins, gameNumber } = useTournamentStore();
  const { active: isSurvival, currentStage: survivalStage, tier: survivalTier } = useSurvivalStore();
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
    <div className="flex items-center justify-center h-full min-h-screen"
      style={{ background: 'radial-gradient(ellipse at center, rgba(0,48,22,0.9), rgba(0,12,6,1))' }}>
      <div className="flex flex-col items-center gap-3">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-transparent"
          style={{ borderTopColor: '#22c55e', borderRightColor: 'rgba(34,197,94,0.3)' }} />
        <p className="text-sm font-semibold text-green-400/70 animate-pulse">Loading game…</p>
      </div>
    </div>
  );

  const currentPlayer = game.players[game.currentPlayerIndex];
  const myHand = game?.myHand ?? [];
  const allOpponents = game.players.filter(p => p.id !== game.myPlayerId && !p.isEliminated);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col">
      <PremiumTableBg />

      {/* ── Premium Top Bar ── */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,180,80,0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button onClick={leaveRoom}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 text-sm font-semibold px-2.5 py-1.5 rounded-xl transition-all"
            style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            ← Leave
          </motion.button>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-dark-muted text-[10px] uppercase tracking-wider font-semibold">ROUND</span>
            <span className="text-white font-black text-sm">{game.roundNumber}</span>
            <span className="text-dark-muted text-[10px]">/{game.roundCount}</span>
          </div>
          <GameModeBadge
            isTournament={isTournament} tournamentFee={tournamentFee} playerWins={playerWins} botWins={botWins} gameNumber={gameNumber}
            isSurvival={isSurvival} survivalStage={survivalStage} survivalTier={survivalTier} entryFee={entryFee}
          />
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

      {/* ── Mobile mini-scores bar ── */}
      <div className="relative z-10 sm:hidden flex items-center gap-2 px-3 py-1.5 overflow-x-auto flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {[...game.players]
          .sort((a, b) => a.totalScore - b.totalScore)
          .map((p, rank) => (
            <div key={p.id} className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0',
              p.id === game.myPlayerId
                ? 'text-green-300' : 'text-dark-muted',
            )}
              style={p.id === game.myPlayerId
                ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }
                : { background: 'rgba(255,255,255,0.05)' }}>
              <span>{rank === 0 ? '👑' : `#${rank + 1}`}</span>
              <span>{p.id === game.myPlayerId ? 'You' : p.username}</span>
              <span className="font-black">{p.totalScore}pt</span>
            </div>
          ))}
      </div>

      {/* ── Main game area ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-2 sm:p-4 gap-2 sm:gap-3 overflow-hidden">

        {/* Desktop live score — hidden on mobile */}
        <div className="hidden sm:block">
          <LiveScorePanel players={game.players} myPlayerId={game.myPlayerId} roundNumber={game.roundNumber} roundCount={game.roundCount} />
        </div>

        {/* ── Opponents ── */}
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

        {/* Action toast */}
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

        {/* Player hand area */}
        <div className="w-full flex flex-col gap-2">
          {/* Mobile action bar */}
          <div className="sm:hidden w-full px-1">
            <ActionButtons hand={myHand} isMyTurn={isMyTurn} hasDrawnThisTurn={game.hasDrawnThisTurn} underAttack={underAttack} />
          </div>

          {/* Hand container — premium glass panel */}
          <div className="w-full rounded-2xl p-2 sm:p-4 relative overflow-hidden"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: isMyTurn
                ? '0 0 0 1px rgba(34,197,94,0.3), 0 -4px 32px rgba(34,197,94,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 -4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              transition: 'box-shadow 0.4s ease',
            }}>
            {isMyTurn && (
              <div className="absolute inset-x-0 top-0 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.7), transparent)' }} />
            )}
            {/* Hand total badge */}
            <div className="absolute top-2 right-3">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{
                  background: handTotal > 80 ? 'rgba(239,68,68,0.2)' : handTotal > 50 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)',
                  color: handTotal > 80 ? '#f87171' : handTotal > 50 ? '#fbbf24' : '#4ade80',
                  border: `1px solid ${handTotal > 80 ? 'rgba(239,68,68,0.3)' : handTotal > 50 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.25)'}`,
                }}>
                Hand: {handTotal} pts
              </span>
            </div>
            <PlayerHand
              hand={myHand}
              isMyTurn={isMyTurn}
              hasDrawnThisTurn={game.hasDrawnThisTurn}
              underAttack={underAttack}
              handTotal={handTotal}
            />
          </div>

          {/* SHOW button */}
          <AnimatePresence>
            {canShow && <ShowButton key="show-btn" />}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Show declared overlay ── */}
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

      {/* ── Score board (round end) ── */}
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

      {/* ── Match winner ── */}
      <AnimatePresence>
        {matchResult && (
          <WinnerCelebration key="winner" result={matchResult} onClose={leaveRoom} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Action toast styles ───────────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { icon: string; iconBg: string; bg: string; border: string; glow: string }> = {
  draw:    { icon: '🃏', iconBg: '#1d4ed8', bg: 'rgba(5,10,30,0.97)',  border: 'rgba(37,99,235,0.5)',  glow: 'rgba(37,99,235,0.15)'  },
  discard: { icon: '♠️', iconBg: '#475569', bg: 'rgba(10,10,15,0.97)', border: 'rgba(71,85,105,0.5)',  glow: 'rgba(71,85,105,0.1)'   },
  skip:    { icon: '⏭️', iconBg: '#b45309', bg: 'rgba(25,18,5,0.97)',  border: 'rgba(217,119,6,0.5)',  glow: 'rgba(217,119,6,0.12)'  },
  attack:  { icon: '⚔️', iconBg: '#b91c1c', bg: 'rgba(30,5,5,0.97)',   border: 'rgba(220,38,38,0.55)', glow: 'rgba(220,38,38,0.18)'  },
  penalty: { icon: '💀', iconBg: '#991b1b', bg: 'rgba(30,5,5,0.97)',   border: 'rgba(220,38,38,0.55)', glow: 'rgba(220,38,38,0.15)'  },
  show:    { icon: '🎉', iconBg: '#15803d', bg: 'rgba(5,25,10,0.97)',  border: 'rgba(22,163,74,0.5)',  glow: 'rgba(22,163,74,0.18)'  },
  system:  { icon: 'ℹ️', iconBg: '#1d4ed8', bg: 'rgba(5,10,28,0.97)', border: 'rgba(29,78,216,0.5)',  glow: 'rgba(29,78,216,0.12)'  },
};

// ── Opponent chip color palette ───────────────────────────────────────────────
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

// ── Opponent chip ─────────────────────────────────────────────────────────────
function OpponentChip({
  player,
  isCurrentTurn,
  isAttackTarget,
}: {
  player: { id: string; username: string; avatar?: string; handCount: number; totalScore: number; isEliminated?: boolean; isBot?: boolean; badge?: import('../../types').PlayerBadge };
  isCurrentTurn: boolean;
  isAttackTarget: boolean;
}) {
  const color = getChipColor(player.username);
  const initials = player.username.slice(0, 2).toUpperCase();

  return (
    <motion.div
      animate={isCurrentTurn ? { y: [0, -3, 0] } : { y: 0 }}
      transition={isCurrentTurn ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : {}}
      className="flex flex-col items-center gap-1 px-2 sm:px-3 py-2 rounded-2xl flex-shrink-0 min-w-[72px] sm:min-w-[88px] relative overflow-hidden"
      style={{
        background: isCurrentTurn
          ? 'rgba(34,197,94,0.12)'
          : isAttackTarget
          ? 'rgba(239,68,68,0.1)'
          : 'rgba(0,0,0,0.4)',
        border: isCurrentTurn
          ? '1px solid rgba(34,197,94,0.55)'
          : isAttackTarget
          ? '1px solid rgba(239,68,68,0.55)'
          : '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        boxShadow: isCurrentTurn
          ? '0 0 20px rgba(34,197,94,0.2), inset 0 1px 0 rgba(34,197,94,0.15)'
          : isAttackTarget
          ? '0 0 20px rgba(239,68,68,0.18)'
          : '0 4px 16px rgba(0,0,0,0.3)',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}>
      {/* Top glow line for active turn */}
      {isCurrentTurn && (
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-full"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(34,197,94,0.8),transparent)' }} />
      )}

      {/* Turn / attack badge */}
      {isCurrentTurn && (
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}
          className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider leading-none"
          style={{ background: 'rgba(34,197,94,0.25)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.4)' }}>
          TURN
        </motion.div>
      )}
      {isAttackTarget && (
        <div className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider leading-none animate-pulse"
          style={{ background: 'rgba(239,68,68,0.25)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>
          ⚔️ ATK
        </div>
      )}

      {/* Avatar */}
      <div className={clsx(
        'w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center font-black text-white shadow-lg relative flex-shrink-0',
        (!player.avatar || (!player.avatar.startsWith('http') && !player.avatar.startsWith('data:'))) && `bg-gradient-to-br ${color}`,
        isCurrentTurn && 'ring-2 ring-green-400/70 ring-offset-1 ring-offset-black/50',
        isAttackTarget && 'ring-2 ring-red-400/70 ring-offset-1 ring-offset-black/50',
      )}>
        {player.avatar && (player.avatar.startsWith('http') || player.avatar.startsWith('data:')) ? (
          <img src={player.avatar} alt={player.username} className="w-full h-full object-cover" />
        ) : player.isBot ? (
          <span className="text-base">🤖</span>
        ) : (
          <span className="text-sm">{initials}</span>
        )}
        {player.isBot && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white leading-none"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 2px 6px rgba(99,102,241,0.5)' }}>
            AI
          </div>
        )}
      </div>

      {/* Name */}
      <span className="text-[10px] sm:text-xs font-semibold truncate w-full text-center text-white/80 leading-tight">
        {player.username.length > 8 ? player.username.slice(0, 7) + '…' : player.username}
      </span>

      {player.badge && <AchievementBadge badge={player.badge} size="xs" />}

      {/* Card count */}
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] sm:text-xs text-dark-muted">🃏 {player.handCount}</span>
        {player.handCount <= 3 && !player.isEliminated && (
          <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
            className="text-yellow-300 text-[10px]">⚠️</motion.span>
        )}
      </div>

      {/* Score */}
      {player.isEliminated ? (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>OUT</span>
      ) : (
        <span className={clsx(
          'text-[10px] sm:text-[11px] font-black',
          player.totalScore > 80 ? 'text-red-400' : player.totalScore > 50 ? 'text-yellow-300' : 'text-dark-muted',
        )}>
          {player.totalScore}pts
        </span>
      )}
    </motion.div>
  );
}

// ── Action toast ──────────────────────────────────────────────────────────────
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
          key="action-toast"
          initial={{ opacity: 0, y: -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="w-full flex-shrink-0 flex items-center gap-2.5"
          style={{
            background: style.bg,
            border: `1px solid ${style.border}`,
            borderRadius: 14,
            padding: '8px 14px 8px 10px',
            boxShadow: `0 0 20px ${style.glow}, 0 6px 24px rgba(0,0,0,0.5)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{
            background: style.iconBg,
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 14,
            boxShadow: `0 0 10px ${style.glow}`,
          }}>
            {style.icon}
          </div>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>
            {action.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
