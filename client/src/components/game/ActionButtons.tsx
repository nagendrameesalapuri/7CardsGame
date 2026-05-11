import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { useShortScreen } from '../../hooks/useShortScreen';

interface ActionButtonsProps {
  hand: CardType[];
  isMyTurn: boolean;
  hasDrawnThisTurn: boolean;
  underAttack: boolean;
  className?: string;
}

export function ActionButtons({ hand, isMyTurn, hasDrawnThisTurn, underAttack, className }: ActionButtonsProps) {
  const { selectedCardIds, discardCards, respondToAttack, game } = useGameStore();
  const isShort = useShortScreen();
  const btnCls = isShort
    ? 'px-4 py-1.5 font-bold rounded-xl active:scale-95 transition-all text-xs whitespace-nowrap'
    : 'px-5 py-2.5 font-bold rounded-xl shadow-lg active:scale-95 transition-all text-sm whitespace-nowrap';

  const isRealSeven = (c: CardType) => c.rank === '7' && !c.isJoker;
  const topDiscard = game?.discardPile[game.discardPile.length - 1];
  const selectedCards = hand.filter(c => selectedCardIds.includes(c.id));
  const selectedHasRealSevens = selectedCards.some(c => isRealSeven(c));

  const canDiscard = isMyTurn && hasDrawnThisTurn && !underAttack && selectedCardIds.length > 0;
  const canCut = isMyTurn && !hasDrawnThisTurn && !underAttack &&
    selectedCardIds.length > 0 && !!topDiscard && !isRealSeven(topDiscard) &&
    selectedCards.every(c => c.rank === topDiscard.rank && !isRealSeven(c));
  const canAttackThrow = underAttack && selectedHasRealSevens;
  const canAttackTake = underAttack;

  const sevensToThrow = selectedCards.filter(c => c.rank === '7' && !c.isJoker).length;

  const hasAnyAction = canDiscard || canCut || canAttackThrow || canAttackTake;

  if (!hasAnyAction) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        className={clsx('flex gap-2 flex-wrap justify-center items-center', className)}
      >
        {canDiscard && (
          <button onClick={discardCards} className={clsx(btnCls, 'bg-neon-green text-dark-bg')}>
            Discard {selectedCardIds.length > 1 ? `${selectedCardIds.length} Cards` : 'Card'}
          </button>
        )}

        {canCut && (
          <button onClick={discardCards} className={clsx(btnCls, 'bg-yellow-500 text-dark-bg')}>
            ✂️ Cut! ({selectedCardIds.length})
          </button>
        )}

        {canAttackThrow && (
          <button onClick={() => respondToAttack('throw')} className={clsx(btnCls, 'bg-yellow-500 text-dark-bg')}>
            ⚔️ Throw {sevensToThrow} Seven{sevensToThrow > 1 ? 's' : ''}
          </button>
        )}

        {canAttackTake && (
          <button onClick={() => respondToAttack('take')} className={clsx(btnCls, 'bg-neon-red/80 text-white')}>
            🃏 Take Penalty
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
