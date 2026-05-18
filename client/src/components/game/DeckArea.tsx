import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType, ClientPlayerState } from '../../types';
import { Card } from './Card';
import { useGameStore } from '../../store/gameStore';
import { DiscardPileModal } from './DiscardPileModal';

interface DeckAreaProps {
  deckCount: number;
  discardPile: CardType[];
  players: ClientPlayerState[];
  jokerRank: string;
  jokerCard: CardType;
  isMyTurn: boolean;
  hasDrawnThisTurn: boolean;
  underAttack: boolean;
}

export function DeckArea({
  deckCount, discardPile, players, jokerRank, jokerCard, isMyTurn, hasDrawnThisTurn, underAttack,
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
      <div className="flex flex-col items-center gap-4 sm:gap-5">

        {/* ── Main deck row ── */}
        <div className="flex items-end gap-4 sm:gap-6">

          {/* Joker indicator */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#fbbf24' }}>★ Joker</span>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-xl"
                style={{ boxShadow: '0 0 16px rgba(251,191,36,0.35)', pointerEvents: 'none' }} />
              <Card card={jokerCard} size="sm" />
              <div className="absolute inset-x-0 -bottom-2 flex justify-center pointer-events-none">
                <span className="text-[7px] sm:text-[8px] font-black px-2 py-0.5 rounded-full leading-none whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', boxShadow: '0 2px 8px rgba(245,158,11,0.5)' }}>
                  all {jokerRank}s = 0 pts
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="self-center h-16 w-px" style={{ background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.12),transparent)' }} />

          {/* Closed Deck */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(148,163,184,0.6)' }}>Deck</span>

            <div className="relative">
              {/* Stacked shadow cards */}
              <div className="absolute top-1 left-1 w-10 h-14 sm:w-14 sm:h-20 rounded-xl opacity-30"
                style={{ background: 'linear-gradient(135deg,#1e3a6e,#1e40af)' }} />
              <div className="absolute top-0.5 left-0.5 w-10 h-14 sm:w-14 sm:h-20 rounded-xl opacity-50"
                style={{ background: 'linear-gradient(135deg,#1e3a6e,#1e40af)' }} />

              <motion.button
                whileHover={canDraw ? { scale: 1.07, y: -4 } : {}}
                whileTap={canDraw ? { scale: 0.94 } : {}}
                onClick={() => canDraw && drawCard('deck')}
                disabled={!canDraw}
                className="relative w-10 h-14 sm:w-14 sm:h-20 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)',
                  border: canDraw ? '2px solid rgba(59,130,246,0.8)' : '2px solid rgba(37,99,235,0.3)',
                  boxShadow: canDraw
                    ? '0 0 20px rgba(59,130,246,0.4), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.4)',
                  cursor: canDraw ? 'pointer' : 'not-allowed',
                  opacity: canDraw ? 1 : 0.7,
                  transition: 'all 0.25s ease',
                }}>
                <div className="text-blue-300/50 text-2xl select-none">🂠</div>
                {/* Inner shine */}
                <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 h-1/2 opacity-10"
                    style={{ background: 'linear-gradient(to bottom,rgba(255,255,255,0.3),transparent)' }} />
                </div>
              </motion.button>

              {/* Count badge */}
              <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black z-10"
                style={{
                  background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                  color: '#fff',
                  border: '2px solid rgba(0,0,0,0.5)',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.5)',
                }}>
                {deckCount > 99 ? '99+' : deckCount}
              </div>
            </div>

            <span className="text-[10px] sm:text-xs font-semibold" style={{ color: 'rgba(148,163,184,0.55)' }}>
              {deckCount} left
            </span>
          </div>

          {/* Animated arrows */}
          <div className="self-center flex flex-col items-center gap-1 pb-4">
            {[0, 1].map(i => (
              <motion.div key={i}
                animate={{ x: [0, 5, 0], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
                className="text-xs sm:text-sm font-black"
                style={{ color: 'rgba(99,102,241,0.7)' }}>
                ›
              </motion.div>
            ))}
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest"
                style={{ color: 'rgba(148,163,184,0.6)' }}>
                Discard ({discardPile.length})
              </span>
              {discardPile.length > 0 && (
                <button
                  onClick={() => setShowPileModal(true)}
                  className="text-[10px] leading-none px-1.5 py-0.5 rounded-full transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(148,163,184,0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                  👁
                </button>
              )}
            </div>

            <div className="relative">
              <motion.div
                whileHover={canDrawFromDiscard && topDiscard ? { scale: 1.07, y: -4 } : {}}
                whileTap={canDrawFromDiscard && topDiscard ? { scale: 0.94 } : {}}
                onClick={() => canDrawFromDiscard && topDiscard && drawCard('discard')}
                className={clsx(canDrawFromDiscard && topDiscard ? 'cursor-pointer' : 'cursor-default')}
                style={{
                  filter: canDrawFromDiscard && topDiscard
                    ? 'drop-shadow(0 0 10px rgba(34,197,94,0.4))'
                    : undefined,
                }}>
                {topDiscard ? (
                  <Card
                    card={topDiscard}
                    size="sm"
                    className={clsx(
                      canDrawFromDiscard && 'ring-2 ring-green-400/70',
                      topDiscardIsSpecial && 'opacity-55',
                    )}
                  />
                ) : (
                  <div className="w-10 h-14 sm:w-14 sm:h-20 rounded-xl flex items-center justify-center text-[9px] font-semibold"
                    style={{
                      border: '2px dashed rgba(255,255,255,0.1)',
                      color: 'rgba(148,163,184,0.4)',
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                    Empty
                  </div>
                )}
              </motion.div>

              {/* Special card block overlay */}
              {topDiscardIsSpecial && canDraw && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl pointer-events-none"
                  style={{ background: 'rgba(0,0,0,0.72)' }}>
                  <span className="text-lg">🚫</span>
                  <span className="text-white text-[8px] font-black text-center leading-tight mt-0.5">Deck<br />only</span>
                </div>
              )}
            </div>

            {topDiscard && (
              <span className="text-[9px] sm:text-[10px] font-semibold text-center leading-tight"
                style={{ color: 'rgba(148,163,184,0.55)' }}>
                {topDiscard.rank === 'Joker'
                  ? 'Printed Joker'
                  : `${topDiscard.rank}${topDiscard.suit !== 'none' ? ' ' + topDiscard.suit[0].toUpperCase() : ''}`}
              </span>
            )}
          </div>
        </div>

        {/* Draw instruction */}
        <AnimatePresence>
          {canDraw && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                backdropFilter: 'blur(12px)',
              }}>
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}>
                ↑
              </motion.span>
              <span className="text-xs sm:text-sm font-semibold" style={{ color: '#4ade80' }}>
                {topDiscardIsSpecial
                  ? `${topDiscard!.rank} on top — draw from deck only`
                  : 'Tap deck or discard pile to draw'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DiscardPileModal
        isOpen={showPileModal}
        onClose={() => setShowPileModal(false)}
        discardPile={discardPile}
        players={players}
      />
    </>
  );
}
