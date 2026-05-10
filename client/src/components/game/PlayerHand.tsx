import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { Card } from './Card';
import { useGameStore } from '../../store/gameStore';

interface PlayerHandProps {
  hand: CardType[];
  isMyTurn: boolean;
  hasDrawnThisTurn: boolean;
  underAttack: boolean;
  handTotal: number;
}

export function PlayerHand({ hand, isMyTurn, hasDrawnThisTurn, underAttack, handTotal }: PlayerHandProps) {
  const { selectedCardIds, toggleCardSelection, discardCards, respondToAttack, game } = useGameStore();

  const isRealSeven = (c: CardType) => c.rank === '7' && !c.isJoker;
  const topDiscard = game?.discardPile[game.discardPile.length - 1];

  const selectedCards = hand.filter(c => selectedCardIds.includes(c.id));
  const selectedHasRealSevens = selectedCards.some(c => isRealSeven(c));

  const canDiscard = isMyTurn && hasDrawnThisTurn && !underAttack && selectedCardIds.length > 0;

  const canCut = isMyTurn && !hasDrawnThisTurn && !underAttack &&
    selectedCardIds.length > 0 &&
    !!topDiscard &&
    !isRealSeven(topDiscard) &&
    selectedCards.every(c => c.rank === topDiscard.rank && !isRealSeven(c));

  const hasCutOpportunity = isMyTurn && !hasDrawnThisTurn && !underAttack &&
    !!topDiscard &&
    !isRealSeven(topDiscard) &&
    hand.some(c => c.rank === topDiscard.rank && !isRealSeven(c));

  const canAttackThrow = underAttack && selectedHasRealSevens;
  const canAttackTake = underAttack;

  return (
    <div className="flex flex-col items-center gap-3">

      {/* Hand total badge */}
      <div className={clsx(
        'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold',
        handTotal <= 5
          ? 'bg-neon-green/20 text-neon-green border border-neon-green/40'
          : 'bg-dark-surface border border-dark-border text-dark-muted'
      )}>
        <span>Your Hand:</span>
        <span className="text-lg">{handTotal} pts</span>
        {handTotal <= 5 && isMyTurn && <span className="text-xs opacity-80 animate-pulse">✓ SHOW now!</span>}
        {handTotal <= 5 && !isMyTurn && <span className="text-xs opacity-80">✓ Ready to SHOW</span>}
      </div>

      {/* Attack warning */}
      <AnimatePresence>
        {underAttack && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="px-4 py-2 bg-neon-red/20 border border-neon-red rounded-lg text-neon-red text-sm font-bold text-center animate-pulse"
          >
            ⚔️ Under 7 Attack! Select a 7 to throw back, or take penalty cards
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards — single row, no wrap, overlap more on mobile */}
      <div
        className="flex items-end justify-center w-full"
        style={{ minHeight: '120px', overflowX: 'auto', padding: '8px 8px 0', scrollbarWidth: 'none' }}
      >
        <AnimatePresence>
          {[...hand]
            .sort((a, b) => {
              if (a.isJoker && !b.isJoker) return -1;
              if (!a.isJoker && b.isJoker) return 1;
              return a.value - b.value;
            })
            .map((card, i) => {
              const isSelected = selectedCardIds.includes(card.id);
              const rot = (i - (hand.length - 1) / 2) * 2;
              const isMobile = window.innerWidth < 640;
              const overlap = isMobile ? (hand.length > 5 ? '-22px' : '-14px') : '-10px';
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: -50 }}
                  animate={{ opacity: 1, y: isSelected ? -16 : 0, rotate: rot }}
                  exit={{ opacity: 0, y: 50, scale: 0.8 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 280, damping: 22 }}
                  style={{
                    transformOrigin: 'bottom center',
                    marginLeft: i === 0 ? 0 : overlap,
                    opacity: isMyTurn ? 1 : 0.78,
                    cursor: isMyTurn ? 'pointer' : 'default',
                    zIndex: isSelected ? 20 : (hand.length - i),
                    flexShrink: 0,
                  }}
                  whileHover={isMyTurn ? { y: -12, zIndex: 30 } : {}}
                  onClick={() => isMyTurn && toggleCardSelection(card.id)}
                >
                  <Card
                    card={card}
                    isSelected={isSelected}
                    isPlayable={isMyTurn}
                    size={window.innerWidth < 640 ? 'md' : 'lg'}
                  />
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Hint when not your turn */}
      {!isMyTurn && !underAttack && (
        <p className="text-dark-muted text-xs">Waiting for your turn…</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap justify-center">

        {canDiscard && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={discardCards}
            className="px-6 py-2.5 bg-neon-green text-dark-bg font-bold rounded-xl shadow-neon-green hover:bg-green-400 transition-all active:scale-95"
          >
            Discard {selectedCardIds.length > 1 ? `${selectedCardIds.length} Cards` : 'Card'}
          </motion.button>
        )}

        {canCut && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={discardCards}
            className="px-6 py-2.5 bg-yellow-500 text-dark-bg font-bold rounded-xl hover:bg-yellow-400 transition-all active:scale-95"
          >
            ✂️ Cut! ({selectedCardIds.length} Card{selectedCardIds.length > 1 ? 's' : ''})
          </motion.button>
        )}

        {canAttackThrow && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => respondToAttack('throw')}
            className="px-6 py-2.5 bg-yellow-500 text-dark-bg font-bold rounded-xl hover:bg-yellow-400 transition-all active:scale-95"
          >
            ⚔️ Throw {selectedCards.filter(c => c.rank === '7' && !c.isJoker).length} Seven{selectedCards.filter(c => c.rank === '7' && !c.isJoker).length > 1 ? 's' : ''}
          </motion.button>
        )}

        {canAttackTake && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => respondToAttack('take')}
            className="px-6 py-2.5 bg-neon-red/80 text-white font-bold rounded-xl hover:bg-neon-red transition-all active:scale-95"
          >
            🃏 Take Penalty Cards
          </motion.button>
        )}

        {isMyTurn && hasDrawnThisTurn && selectedCardIds.length === 0 && !underAttack && (
          <p className="text-dark-muted text-xs text-center">
            Tap a card to select it, then discard · Same rank = discard multiple
          </p>
        )}

        {(canDiscard || canCut) && selectedCards.some(c => c.rank === 'J' && !c.isJoker) && (
          <p className="text-yellow-400 text-xs text-center font-medium">
            ⚡ J skips the next player's turn
          </p>
        )}
        {(canDiscard || canCut) && selectedCards.some(c => c.rank === '7' && !c.isJoker) && (
          <p className="text-yellow-400 text-xs text-center font-medium">
            ⚡ 7 attacks the next player — they must counter or take penalty cards
          </p>
        )}

        {isMyTurn && !hasDrawnThisTurn && !underAttack && !canCut && (
          hasCutOpportunity
            ? <p className="text-yellow-400 text-xs font-medium animate-pulse">
                ✂️ You can cut! Select a {topDiscard?.rank} to discard without drawing
              </p>
            : <p className="text-neon-green text-xs font-medium animate-pulse">
                ↑ Draw a card from the deck or discard pile first
              </p>
        )}

        {underAttack && selectedCardIds.length > 0 && !selectedHasRealSevens && (
          <p className="text-neon-red text-xs text-center">
            Only a 7 can counter an attack — select a 7 or take the penalty
          </p>
        )}
      </div>
    </div>
  );
}
