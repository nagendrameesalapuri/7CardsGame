import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Card as CardType } from '../../types';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isPlayable?: boolean;
  isHidden?: boolean;  // show card back
  isDealt?: boolean;   // animate in
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900 dark:text-gray-900',
  spades: 'text-gray-900 dark:text-gray-900',
  none: 'text-yellow-500',
};

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', none: '',
};

const SIZES = {
  sm: { card: 'w-10 h-14', rank: 'text-sm', suit: 'text-base' },
  md: { card: 'w-16 h-24', rank: 'text-base', suit: 'text-xl' },
  lg: { card: 'w-20 h-28', rank: 'text-lg', suit: 'text-2xl' },
};

export function Card({
  card,
  isSelected = false,
  isPlayable = false,
  isHidden = false,
  isDealt = false,
  onClick,
  className,
  size = 'md',
  style,
}: CardProps) {
  const sz = SIZES[size];
  const suitColor = SUIT_COLORS[card.suit];
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  if (isHidden) {
    return (
      <motion.div
        initial={isDealt ? { y: -150, rotate: -15, opacity: 0 } : false}
        animate={{ y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={clsx(
          sz.card,
          'rounded-lg shadow-card cursor-default select-none flex-shrink-0',
          'bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-700',
          className
        )}
        style={style}
      >
        {/* Card back pattern */}
        <div className="w-full h-full rounded-md bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_2px,transparent_2px,transparent_8px)] flex items-center justify-center">
          <span className="text-blue-400 opacity-60 text-xl">🂠</span>
        </div>
      </motion.div>
    );
  }

  const isPrintedJoker = card.rank === 'Joker';

  return (
    <motion.div
      initial={isDealt ? { y: -150, rotate: -15, opacity: 0 } : false}
      animate={{
        y: isSelected ? -16 : 0,
        rotate: 0,
        opacity: 1,
        scale: isSelected ? 1.05 : 1,
      }}
      whileHover={isPlayable ? { y: -8, scale: 1.05 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={clsx(
        sz.card,
        'rounded-lg shadow-card select-none flex-shrink-0 relative overflow-hidden',
        'bg-card-bg border-2',
        isSelected
          ? 'border-neon-green shadow-neon-green'
          : card.isJoker
          ? 'border-neon-gold shadow-neon-gold animate-pulse-neon'
          : 'border-card-border',
        isPlayable ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      style={style}
    >
      {/* Joker overlay */}
      {card.isJoker && (
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent pointer-events-none" />
      )}

      {isPrintedJoker ? (
        /* Printed joker — special display */
        <>
          <div className="absolute top-1 left-1.5 text-yellow-500 font-bold leading-none" style={{ fontSize: '0.6rem' }}>🃏</div>
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🃏</div>
          <div className="absolute bottom-1 left-0 right-0 text-center">
            <span className="text-[8px] font-bold text-yellow-600 bg-yellow-100 px-1 rounded">JOKER</span>
          </div>
        </>
      ) : (
        /* Regular card */
        <>
          {/* Top-left rank & suit */}
          <div className={clsx('absolute top-1 left-1.5 leading-tight', suitColor)}>
            <div className={clsx('font-bold leading-none', sz.rank)}>{card.rank}</div>
            <div className={clsx('leading-none', sz.suit === 'text-xl' ? 'text-sm' : 'text-xs')}>{suitSymbol}</div>
          </div>

          {/* Center suit */}
          <div className={clsx('absolute inset-0 flex items-center justify-center', suitColor, sz.suit)}>
            {card.isJoker ? '★' : suitSymbol}
          </div>

          {/* Bottom-right rank & suit (rotated) */}
          <div className={clsx('absolute bottom-1 right-1.5 leading-tight rotate-180', suitColor)}>
            <div className={clsx('font-bold leading-none', sz.rank)}>{card.rank}</div>
            <div className={clsx('leading-none', sz.suit === 'text-xl' ? 'text-sm' : 'text-xs')}>{suitSymbol}</div>
          </div>

          {/* Joker label for paper joker cards */}
          {card.isJoker && (
            <div className="absolute bottom-1 left-0 right-0 text-center">
              <span className="text-[8px] font-bold text-yellow-600 bg-yellow-100 px-1 rounded">JOKER</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
