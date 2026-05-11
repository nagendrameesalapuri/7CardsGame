import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { RoundResult, ClientPlayerState, Card as CardType } from '../../types';
import { Avatar } from '../ui/Avatar';

interface ScoreBoardProps {
  roundResult: RoundResult;
  players: ClientPlayerState[];
  roundNumber: number;
  roundCount: number;
  myUserId: string;
  roundReadyUpdate: { readyUserIds: string[]; total: number } | null;
  onReady: () => void;
}

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', clubs: '♣', hearts: '♥', diamonds: '♦', none: '',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

function CardBadge({ card }: { card: CardType }) {
  const isPrintedJoker = card.rank === 'Joker';
  const isRed = RED_SUITS.has(card.suit);
  const suit = SUIT_SYMBOL[card.suit] ?? '';
  return (
    <div className={clsx(
      'flex flex-col items-center justify-between rounded-lg border px-1.5 py-1 min-w-[36px] h-12 text-center leading-none select-none',
      card.isJoker
        ? 'bg-yellow-400/20 border-yellow-400 text-yellow-300'
        : isRed
          ? 'bg-white border-red-400 text-red-600'
          : 'bg-white border-slate-400 text-slate-800',
    )}>
      <span className="text-xs font-bold leading-none">{isPrintedJoker ? '🃏' : card.rank}</span>
      <span className="text-base leading-none">{card.isJoker && !isPrintedJoker ? '★' : suit}</span>
      <span className="text-xs font-bold leading-none opacity-60">{card.value}</span>
    </div>
  );
}

export function ScoreBoard({
  roundResult, players, roundNumber, roundCount,
  myUserId, roundReadyUpdate, onReady,
}: ScoreBoardProps) {
  const winner = players.find(p => p.id === roundResult.winnerId);
  const isFinalRound = roundNumber >= roundCount;

  const myPlayer = players.find(p => p.userId === myUserId);
  const iHaveClicked = !!(myPlayer && roundReadyUpdate?.readyUserIds.includes(myUserId));

  const readyCount = roundReadyUpdate?.readyUserIds.length ?? 0;
  const totalHumans = roundReadyUpdate?.total ?? 0;
  const allReady = totalHumans > 0 && readyCount >= totalHumans;

  // Sort: winner first, then by roundPoints ascending
  const sorted = [...roundResult.playerResults].sort((a, b) => {
    if (a.playerId === roundResult.winnerId) return -1;
    if (b.playerId === roundResult.winnerId) return 1;
    return a.roundPoints - b.roundPoints;
  });

  // Show player's declared hand total
  const showPlayerResult = roundResult.playerResults.find(r => r.playerId === roundResult.showPlayerId);
  const showHandTotal = showPlayerResult
    ? showPlayerResult.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0)
    : 0;
  const showPlayerName = players.find(p => p.id === roundResult.showPlayerId)?.username ?? '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-3"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 px-6 py-5 text-center">
          <motion.div
            animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl mb-2"
          >
            {roundResult.showPlayerWon ? '🏆' : '💥'}
          </motion.div>
          <h2 className="text-2xl font-bold text-white">
            {roundResult.showPlayerWon
              ? `${winner?.username} wins the round!`
              : 'SHOW failed!'}
          </h2>
          {/* Show caller's declared points — prominent */}
          <div className="mt-2 inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5">
            <span className="text-yellow-300 font-bold text-sm">📢 {showPlayerName}</span>
            <span className="text-white text-sm">called SHOW with</span>
            <span className="text-yellow-300 font-bold text-lg">{showHandTotal} pts</span>
          </div>
          {!roundResult.showPlayerWon && (
            <p className="text-red-300 text-xs mt-2">
              {showPlayerName} declared SHOW but wasn't lowest — gets penalty!
            </p>
          )}
        </div>

        {/* Player results */}
        <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {sorted.map((result, i) => {
            const player = players.find(p => p.id === result.playerId);
            const isWinner = result.playerId === roundResult.winnerId;
            const isShowPlayer = result.playerId === roundResult.showPlayerId;
            const handTotal = result.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0);

            return (
              <motion.div
                key={result.playerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
                className={clsx(
                  'rounded-xl border p-3',
                  isWinner
                    ? 'bg-neon-green/10 border-neon-green/50'
                    : isShowPlayer && !roundResult.showPlayerWon
                      ? 'bg-neon-red/10 border-neon-red/50'
                      : 'bg-dark-bg border-dark-border',
                )}
              >
                {/* Top row: avatar + name + score */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-dark-border flex items-center justify-center text-xs font-bold text-dark-muted flex-shrink-0">
                    {i + 1}
                  </div>
                  <Avatar avatar={player?.avatar ?? 'avatar_1'} size="sm" isBot={player?.isBot} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-dark-text text-sm">{result.username}</span>
                      {isWinner && <span className="text-xs bg-neon-green text-dark-bg px-2 py-0.5 rounded-full font-bold">WIN</span>}
                      {isShowPlayer && (
                        <span className="text-xs bg-yellow-500 text-dark-bg px-2 py-0.5 rounded-full font-bold">
                          SHOW · {handTotal} pts
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-dark-muted">
                      {isShowPlayer
                        ? `Called SHOW with ${handTotal} pts in hand`
                        : `Hand total: ${handTotal} pts`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={clsx(
                      'font-bold text-xl',
                      result.roundPoints === 0 ? 'text-neon-green' : 'text-neon-red',
                    )}>
                      {result.roundPoints === 0 ? '+0' : `+${result.roundPoints}`}
                    </div>
                    <div className="text-xs text-dark-muted">
                      Total: <span className="font-bold text-dark-text text-sm">{result.totalScore}</span>
                    </div>
                  </div>
                </div>

                {/* Cards row */}
                <div className="flex gap-1.5 flex-wrap">
                  {[...result.hand]
                    .sort((a, b) => {
                      if (a.isJoker && !b.isJoker) return -1;
                      if (!a.isJoker && b.isJoker) return 1;
                      return a.value - b.value;
                    })
                    .map(c => <CardBadge key={c.id} card={c} />)
                  }
                  {result.hand.length === 0 && (
                    <span className="text-dark-muted text-xs italic">No cards</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer: round info + Play Next Round button */}
        <div className="px-4 py-4 border-t border-dark-border space-y-3">
          <p className="text-dark-muted text-sm text-center">
            Round <span className="font-bold text-dark-text">{roundNumber}</span> of{' '}
            <span className="font-bold text-dark-text">{roundCount}</span>
            {isFinalRound
              ? <span className="text-neon-green font-bold"> — Final round!</span>
              : <span className="text-dark-muted"> — {roundCount - roundNumber} remaining</span>}
          </p>

          {!isFinalRound && (
            <div className="flex flex-col items-center gap-2">
              <motion.button
                whileHover={!iHaveClicked ? { scale: 1.03 } : {}}
                whileTap={!iHaveClicked ? { scale: 0.97 } : {}}
                onClick={() => !iHaveClicked && onReady()}
                disabled={iHaveClicked}
                className={clsx(
                  'w-full max-w-xs py-3 rounded-xl font-bold text-base transition-all',
                  iHaveClicked
                    ? 'bg-dark-border text-dark-muted cursor-default'
                    : 'bg-neon-green text-dark-bg hover:bg-neon-green/90 shadow-lg shadow-neon-green/20',
                )}
              >
                {iHaveClicked ? '✓ Ready — waiting for others...' : '▶ Play Next Round'}
              </motion.button>

              {/* Ready status */}
              {roundReadyUpdate && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: totalHumans }).map((_, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          'w-2.5 h-2.5 rounded-full transition-colors',
                          idx < readyCount ? 'bg-neon-green' : 'bg-dark-border',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-dark-muted">
                    {allReady ? 'All ready! Starting...' : `${readyCount}/${totalHumans} ready`}
                  </span>
                </div>
              )}
            </div>
          )}

          {isFinalRound && (
            <p className="text-xs text-dark-muted text-center">Match results coming up...</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
