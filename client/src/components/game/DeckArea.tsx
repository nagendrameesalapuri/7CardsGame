import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { Card } from './Card';
import { useGameStore } from '../../store/gameStore';
import { useShortScreen } from '../../hooks/useShortScreen';

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
  const isShort = useShortScreen();

  const canDraw = isMyTurn && !hasDrawnThisTurn && !underAttack;
  const topDiscard = discardPile[discardPile.length - 1];
  const topDiscardIsSpecial = !!topDiscard && !topDiscard.isJoker &&
    (topDiscard.rank === '7' || topDiscard.rank === 'J');
  const canDrawFromDiscard = canDraw && !topDiscardIsSpecial;

  return (
    <div className={clsx('flex flex-col items-center', isShort ? 'gap-1' : 'gap-4')}>
      {/* Joker indicator */}
      <div className={clsx(
        'flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/40 rounded-xl',
        isShort ? 'px-2 py-0.5' : 'px-4 py-2'
      )}>
        <span className="text-yellow-400 text-xs font-bold">★ JOKER:</span>
        <span className={clsx('text-yellow-300 font-bold', isShort ? 'text-sm' : 'text-lg')}>{jokerRank}s</span>
        {!isShort && <span className="text-dark-muted text-xs">(all {jokerRank}s = 0 pts)</span>}
      </div>

      <div className={clsx('flex items-center', isShort ? 'gap-3' : 'gap-8')}>
        {/* Closed Deck */}
        <div className={clsx('flex flex-col items-center', isShort ? 'gap-0.5' : 'gap-2')}>
          {!isShort && <span className="text-dark-muted text-xs uppercase tracking-wide">Deck</span>}
          <motion.button
            whileHover={canDraw ? { scale: 1.05, y: -4 } : {}}
            whileTap={canDraw ? { scale: 0.95 } : {}}
            onClick={() => canDraw && drawCard('deck')}
            disabled={!canDraw}
            className={clsx(
              isShort ? 'w-10 h-14' : 'w-16 h-24',
              'rounded-lg shadow-card relative',
              'bg-gradient-to-br from-blue-800 to-blue-900 border-2',
              canDraw
                ? 'border-neon-blue shadow-neon-blue cursor-pointer'
                : 'border-blue-700 cursor-not-allowed opacity-80'
            )}
          >
            <div className="w-full h-full rounded-md flex items-center justify-center">
              <div className="text-blue-400/60 text-xl">🂠</div>
            </div>
            <div className="absolute -top-2 -right-2 bg-neon-blue text-dark-bg text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {deckCount > 99 ? '99+' : deckCount}
            </div>
          </motion.button>
          {!isShort && <span className="text-dark-muted text-xs">{deckCount} cards</span>}
          {isShort && <span className="text-dark-muted text-[10px]">Deck</span>}
        </div>

        {/* Arrow — hidden on short */}
        {!isShort && <div className="text-dark-muted text-2xl">⇄</div>}

        {/* Discard Pile */}
        <div className={clsx('flex flex-col items-center', isShort ? 'gap-0.5' : 'gap-2')}>
          {!isShort && <span className="text-dark-muted text-xs uppercase tracking-wide">Discard</span>}
          <div className="relative">
            <motion.div
              whileHover={canDrawFromDiscard ? { scale: 1.05, y: -4 } : {}}
              whileTap={canDrawFromDiscard ? { scale: 0.95 } : {}}
              onClick={() => canDrawFromDiscard && topDiscard && drawCard('discard')}
              className={clsx(canDrawFromDiscard && topDiscard ? 'cursor-pointer' : 'cursor-default')}
            >
              {topDiscard ? (
                <Card
                  card={topDiscard}
                  size={isShort ? 'sm' : 'lg'}
                  className={clsx(
                    canDrawFromDiscard && 'ring-2 ring-neon-green shadow-neon-green',
                    topDiscardIsSpecial && 'opacity-60',
                  )}
                />
              ) : (
                <div className={clsx(
                  isShort ? 'w-10 h-14' : 'w-20 h-28',
                  'rounded-lg border-2 border-dashed border-dark-border flex items-center justify-center text-dark-muted text-xs'
                )}>
                  Empty
                </div>
              )}
            </motion.div>
            {topDiscardIsSpecial && canDraw && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
                <span className="text-neon-red text-lg font-bold">🚫</span>
                {!isShort && (
                  <span className="text-white text-xs font-bold text-center leading-tight mt-1">
                    Draw from<br />deck only
                  </span>
                )}
              </div>
            )}
          </div>
          {topDiscard && !isShort && (
            <span className="text-dark-muted text-xs">
              {topDiscard.rank === 'Joker' ? 'Printed Joker' : `${topDiscard.rank} of ${topDiscard.suit}`}
            </span>
          )}
          {isShort && <span className="text-dark-muted text-[10px]">Discard</span>}
        </div>
      </div>

      {/* Draw instruction — hidden on short */}
      {canDraw && !isShort && (
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
