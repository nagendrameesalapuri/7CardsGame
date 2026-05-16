import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';
import { Card } from './Card';
import { ActionButtons } from './ActionButtons';
import { useGameStore } from '../../store/gameStore';

interface PlayerHandProps {
  hand: CardType[];
  isMyTurn: boolean;
  hasDrawnThisTurn: boolean;
  underAttack: boolean;
  handTotal: number;
}

export function PlayerHand({ hand, isMyTurn, hasDrawnThisTurn, underAttack, handTotal }: PlayerHandProps) {
  const { selectedCardIds, toggleCardSelection, game } = useGameStore();

  const isRealSeven = (c: CardType) => c.rank === '7' && !c.isJoker;
  const topDiscard = game?.discardPile[game.discardPile.length - 1];

  const selectedCards = hand.filter(c => selectedCardIds.includes(c.id));

  const canDiscard = isMyTurn && hasDrawnThisTurn && !underAttack && selectedCardIds.length > 0;
  const canCut = isMyTurn && !hasDrawnThisTurn && !underAttack &&
    selectedCardIds.length > 0 && !!topDiscard && !isRealSeven(topDiscard) &&
    selectedCards.every(c => c.rank === topDiscard.rank && !isRealSeven(c));
  const hasCutOpportunity = isMyTurn && !hasDrawnThisTurn && !underAttack &&
    !!topDiscard && !isRealSeven(topDiscard) &&
    hand.some(c => c.rank === topDiscard.rank && !isRealSeven(c));

  return (
    <div className={clsx('flex flex-col items-center', underAttack ? 'gap-1.5 sm:gap-3' : 'gap-2')}>

      {/* Attack warning */}
      <AnimatePresence>
        {underAttack && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full px-3 py-1 sm:px-4 sm:py-2 bg-neon-red/20 border border-neon-red rounded-lg text-neon-red font-bold text-center animate-pulse"
          >
            <span className="sm:hidden text-xs">⚔️ 7 Attack! Select a 7 to counter, or take penalty</span>
            <span className="hidden sm:inline text-sm">⚔️ Under 7 Attack! Select a 7 to throw back, or take penalty cards</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards — fan layout, two rows when 9+ cards */}
      {(() => {
        const RANK_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        const sorted = [...hand].sort((a, b) => {
          if (a.isJoker && !b.isJoker) return -1;
          if (!a.isJoker && b.isJoker) return 1;
          return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
        });
        const isMobile = window.innerWidth < 640;
        const isMany = sorted.length >= 9;
        const cardSize = isMany ? 'sm' : (isMobile && underAttack) ? 'sm' : isMobile ? 'md' : 'lg';
        const row1 = isMany ? sorted.slice(0, Math.ceil(sorted.length / 2)) : sorted;
        const row2 = isMany ? sorted.slice(Math.ceil(sorted.length / 2)) : [];

        const overlapPx = isMany ? 14 : (isMobile && underAttack) ? 8 : isMobile && hand.length > 5 ? 18 : 8;
        const minH = isMany ? '180px' : (isMobile && underAttack) ? '64px' : isMobile ? '104px' : '120px';

        const renderRow = (cards: typeof sorted, rowOffset = 0) => (
          <div
            className="flex items-end justify-center"
            style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' as const }}
          >
            <AnimatePresence>
              {cards.map((card, i) => {
                const globalI = rowOffset + i;
                const isSelected = selectedCardIds.includes(card.id);
                const rot = (i - (cards.length - 1) / 2) * 2;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: -40 }}
                    animate={{ opacity: 1, y: isSelected ? -12 : 0, rotate: rot }}
                    exit={{ opacity: 0, y: 40, scale: 0.8 }}
                    transition={{ delay: globalI * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
                    style={{
                      transformOrigin: 'bottom center',
                      marginLeft: i === 0 ? 0 : -overlapPx,
                      opacity: isMyTurn ? 1 : 0.78,
                      cursor: isMyTurn ? 'pointer' : 'default',
                      zIndex: isSelected ? 20 : (cards.length - i),
                      flexShrink: 0,
                    }}
                    whileHover={isMyTurn ? { y: -10, zIndex: 30 } : {}}
                    onClick={() => isMyTurn && toggleCardSelection(card.id)}
                  >
                    <Card card={card} isSelected={isSelected} isPlayable={isMyTurn} size={cardSize} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        );

        return (
          <div className="flex flex-col gap-1 w-full" style={{ minHeight: minH, padding: '4px 8px 8px' }}>
            {renderRow(row1, 0)}
            {row2.length > 0 && renderRow(row2, row1.length)}
          </div>
        );
      })()}

      {/* Hint when not your turn */}
      {!isMyTurn && !underAttack && (
        <p className="text-dark-muted text-xs">Waiting for your turn…</p>
      )}

      {/* Context hints */}
      <div className="flex flex-col items-center gap-1">
        {isMyTurn && hasDrawnThisTurn && selectedCardIds.length === 0 && !underAttack && (
          <p className="text-dark-muted text-xs text-center">Tap a card to select, then discard · Same rank = discard multiple</p>
        )}
        {(canDiscard || canCut) && selectedCards.some(c => c.rank === 'J' && !c.isJoker) && (
          <p className="text-yellow-400 text-xs text-center font-medium">⚡ J skips the next player's turn</p>
        )}
        {(canDiscard || canCut) && selectedCards.some(c => c.rank === '7' && !c.isJoker) && (
          <p className="text-yellow-400 text-xs text-center font-medium">⚡ 7 attacks — they counter or take penalty</p>
        )}
        {isMyTurn && !hasDrawnThisTurn && !underAttack && !canCut && (
          hasCutOpportunity
            ? <p className="text-yellow-400 text-xs font-medium animate-pulse">✂️ You can cut! Select a {topDiscard?.rank}</p>
            : <p className="text-neon-green text-xs font-medium animate-pulse">↑ Draw from deck or discard pile</p>
        )}
      </div>

      {/* Desktop action buttons */}
      <ActionButtons
        hand={hand}
        isMyTurn={isMyTurn}
        hasDrawnThisTurn={hasDrawnThisTurn}
        underAttack={underAttack}
        className="hidden sm:flex"
      />
    </div>
  );
}
