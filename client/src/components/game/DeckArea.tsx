import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { Card } from './Card';
import { useGameStore } from '../../store/gameStore';

interface DeckAreaProps {
  deckCount: number;
  discardPile: CardType[];
  jokerRank: string;
  jokerCard: CardType;
  isMyTurn: boolean;
  hasDrawnThisTurn: boolean;
  underAttack: boolean;
}

export function DeckArea({
  deckCount, discardPile, jokerRank, jokerCard, isMyTurn, hasDrawnThisTurn, underAttack,
}: DeckAreaProps) {
  const { drawCard } = useGameStore();

  const canDraw = isMyTurn && !hasDrawnThisTurn && !underAttack;
  const topDiscard = discardPile[discardPile.length - 1];
  const topDiscardIsSpecial = !!topDiscard && !topDiscard.isJoker &&
    (topDiscard.rank === '7' || topDiscard.rank === 'J');
  const canDrawFromDiscard = canDraw && !topDiscardIsSpecial;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Joker indicator */}
      <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/40 rounded-xl px-4 py-2">
        <span className="text-yellow-400 text-sm font-bold">★ JOKER:</span>
        <span className="text-yellow-300 font-bold text-lg">{jokerRank}s</span>
        <span className="text-dark-muted text-xs">(all {jokerRank}s = 0 pts)</span>
      </div>

      <div className="flex items-center gap-8">
        {/* Closed Deck */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-dark-muted text-xs uppercase tracking-wide">Deck</span>
          <motion.button
            whileHover={canDraw ? { scale: 1.05, y: -4 } : {}}
            whileTap={canDraw ? { scale: 0.95 } : {}}
            onClick={() => canDraw && drawCard('deck')}
            disabled={!canDraw}
            className={clsx(
              'w-16 h-24 rounded-lg shadow-card relative',
              'bg-gradient-to-br from-blue-800 to-blue-900 border-2',
              canDraw
                ? 'border-neon-blue shadow-neon-blue cursor-pointer'
                : 'border-blue-700 cursor-not-allowed opacity-80'
            )}
          >
            <div className="w-full h-full rounded-md flex items-center justify-center">
              <div className="text-blue-400/60 text-2xl">🂠</div>
            </div>
            {/* Card count badge */}
            <div className="absolute -top-2 -right-2 bg-neon-blue text-dark-bg text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {deckCount > 99 ? '99+' : deckCount}
            </div>
          </motion.button>
          <span className="text-dark-muted text-xs">{deckCount} cards</span>
        </div>

        {/* Arrow */}
        <div className="text-dark-muted text-2xl">⇄</div>

        {/* Discard Pile */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-dark-muted text-xs uppercase tracking-wide">Discard</span>
          <div className="relative">
            <motion.div
              whileHover={canDrawFromDiscard ? { scale: 1.05, y: -4 } : {}}
              whileTap={canDrawFromDiscard ? { scale: 0.95 } : {}}
              onClick={() => canDrawFromDiscard && topDiscard && drawCard('discard')}
              className={clsx(canDrawFromDiscard && topDiscard ? 'cursor-pointer' : 'cursor-default')}
            >
              {topDiscard ? (
                <Card card={topDiscard} size="lg"
                  className={clsx(
                    canDrawFromDiscard && 'ring-2 ring-neon-green shadow-neon-green',
                    topDiscardIsSpecial && 'opacity-60',
                  )}
                />
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-dark-border flex items-center justify-center text-dark-muted text-xs">
                  Empty
                </div>
              )}
            </motion.div>
            {/* Blocked overlay when top card is 7 or J */}
            {topDiscardIsSpecial && canDraw && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
                <span className="text-neon-red text-lg font-bold">🚫</span>
                <span className="text-white text-xs font-bold text-center leading-tight mt-1">
                  Draw from<br />deck only
                </span>
              </div>
            )}
          </div>
          {topDiscard && (
            <span className="text-dark-muted text-xs">
              {topDiscard.rank} of {topDiscard.suit}
            </span>
          )}
        </div>
      </div>

      {/* Draw instruction */}
      {canDraw && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-neon-green text-sm font-medium text-center"
        >
          {topDiscardIsSpecial
            ? `${topDiscard!.rank} on discard — draw from deck`
            : 'Click deck or discard pile to draw'}
        </motion.p>
      )}
    </div>
  );
}
