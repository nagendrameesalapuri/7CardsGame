import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { Card } from './Card';
import { useGameStore } from '../../store/gameStore';
import { DiscardPileModal } from './DiscardPileModal';

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
  const [showPileModal, setShowPileModal] = React.useState(false);

  const canDraw = isMyTurn && !hasDrawnThisTurn && !underAttack;
  const topDiscard = discardPile[discardPile.length - 1];
  const topDiscardIsSpecial = !!topDiscard && !topDiscard.isJoker &&
    (topDiscard.rank === '7' || topDiscard.rank === 'J');
  const canDrawFromDiscard = canDraw && !topDiscardIsSpecial;

  return (
    <>
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        {/* Joker card display */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-yellow-400 text-[10px] sm:text-xs uppercase tracking-wider font-bold">★ Joker</span>
            <div className="relative">
              <Card card={jokerCard} size="sm" />
              <div className="absolute inset-x-0 -bottom-1 flex justify-center pointer-events-none">
                <span className="bg-yellow-400 text-dark-bg text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap shadow-md">
                  all {jokerRank}s = 0 pts
                </span>
              </div>
            </div>
          </div>

          <div className="text-dark-muted/40 text-lg">│</div>

          {/* Closed Deck */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-dark-muted text-[10px] sm:text-xs uppercase tracking-wider">Deck</span>
            <motion.button
              whileHover={canDraw ? { scale: 1.06, y: -3 } : {}}
              whileTap={canDraw ? { scale: 0.95 } : {}}
              onClick={() => canDraw && drawCard('deck')}
              disabled={!canDraw}
              className={clsx(
                'w-10 h-14 sm:w-14 sm:h-20 rounded-lg shadow-card relative',
                'bg-gradient-to-br from-blue-800 to-blue-900 border-2',
                canDraw
                  ? 'border-neon-blue shadow-neon-blue cursor-pointer'
                  : 'border-blue-700 cursor-not-allowed opacity-80'
              )}
            >
              <div className="w-full h-full rounded-md flex items-center justify-center">
                <div className="text-blue-400/60 text-xl">🂠</div>
              </div>
              <div className="absolute -top-2 -right-2 bg-neon-blue text-dark-bg text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {deckCount > 99 ? '99+' : deckCount}
              </div>
            </motion.button>
            <span className="text-dark-muted text-[9px] sm:text-xs">{deckCount} left</span>
          </div>

          {/* Arrow */}
          <div className="text-dark-muted/60 text-xl sm:text-2xl">⇄</div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-dark-muted text-[10px] sm:text-xs uppercase tracking-wider">
                Discard ({discardPile.length})
              </span>
              {discardPile.length > 0 && (
                <button
                  onClick={() => setShowPileModal(true)}
                  className="text-dark-muted hover:text-dark-text text-[10px] sm:text-xs bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-full transition-colors leading-none"
                >
                  👁
                </button>
              )}
            </div>

            <div className="relative">
              <motion.div
                whileHover={canDrawFromDiscard ? { scale: 1.06, y: -3 } : {}}
                whileTap={canDrawFromDiscard ? { scale: 0.95 } : {}}
                onClick={() => canDrawFromDiscard && topDiscard && drawCard('discard')}
                className={clsx(canDrawFromDiscard && topDiscard ? 'cursor-pointer' : 'cursor-default')}
              >
                {topDiscard ? (
                  <Card card={topDiscard} size="sm"
                    className={clsx(
                      canDrawFromDiscard && 'ring-2 ring-neon-green shadow-neon-green',
                      topDiscardIsSpecial && 'opacity-60',
                    )}
                  />
                ) : (
                  <div className="w-10 h-14 sm:w-14 sm:h-20 rounded-lg border-2 border-dashed border-dark-border flex items-center justify-center text-dark-muted text-[9px]">
                    Empty
                  </div>
                )}
              </motion.div>

              {topDiscardIsSpecial && canDraw && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-lg pointer-events-none">
                  <span className="text-neon-red text-base font-bold">🚫</span>
                  <span className="text-white text-[9px] font-bold text-center leading-tight mt-0.5">
                    Deck<br />only
                  </span>
                </div>
              )}
            </div>

            {topDiscard && (
              <span className="text-dark-muted text-[9px] sm:text-xs text-center leading-tight">
                {topDiscard.rank === 'Joker' ? 'Printed Joker' : `${topDiscard.rank}${topDiscard.suit !== 'none' ? ' ' + topDiscard.suit[0].toUpperCase() : ''}`}
              </span>
            )}
          </div>
        </div>

        {/* Draw instruction */}
        {canDraw && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-neon-green text-xs sm:text-sm font-medium text-center"
          >
            {topDiscardIsSpecial
              ? `${topDiscard!.rank} on top — draw from deck only`
              : 'Tap deck or discard pile to draw'}
          </motion.p>
        )}
      </div>

      <DiscardPileModal
        isOpen={showPileModal}
        onClose={() => setShowPileModal(false)}
        discardPile={discardPile}
      />
    </>
  );
}
