import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useTurnTimer } from '../../hooks/useTurnTimer';
import { useShortScreen } from '../../hooks/useShortScreen';

interface TurnTimerProps {
  turnStartTime: string;
  turnTimeLimit: number;
  isMyTurn: boolean;
  currentPlayerName: string;
}

export function TurnTimer({ turnStartTime, turnTimeLimit, isMyTurn, currentPlayerName }: TurnTimerProps) {
  const { secondsLeft, progress, isWarning, isCritical } = useTurnTimer(
    turnStartTime,
    turnTimeLimit,
    true
  );
  const isShort = useShortScreen();

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const svgSize = isShort ? 32 : 48;

  return (
    <div className={clsx(
      'flex items-center rounded-xl border transition-all',
      isShort ? 'gap-1.5 px-2 py-1' : 'gap-3 px-4 py-2',
      isCritical
        ? 'bg-neon-red/20 border-neon-red/60 shadow-neon-red'
        : isWarning
        ? 'bg-yellow-500/10 border-yellow-500/40'
        : 'bg-dark-surface border-dark-border',
    )}>
      {/* Circular progress */}
      <div className="relative flex-shrink-0" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} className="-rotate-90" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <motion.circle
            cx="25" cy="25" r={radius}
            fill="none"
            stroke={isCritical ? '#ff3b5c' : isWarning ? '#ffd700' : '#00ff88'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transition={{ duration: 0.25 }}
          />
        </svg>
        <div className={clsx(
          'absolute inset-0 flex items-center justify-center font-bold',
          isShort ? 'text-xs' : 'text-sm',
          isCritical ? 'text-neon-red' : isWarning ? 'text-yellow-400' : 'text-neon-green'
        )}>
          {secondsLeft}
        </div>
      </div>

      <div className="flex flex-col">
        <span className={clsx(
          'font-bold',
          isShort ? 'text-xs' : 'text-sm',
          isMyTurn ? 'text-neon-green' : 'text-dark-text'
        )}>
          {isMyTurn ? '🎯 Your Turn!' : `${currentPlayerName}'s Turn`}
        </span>
        {!isShort && isCritical && isMyTurn && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className="text-neon-red text-xs font-bold"
          >
            Hurry up!
          </motion.span>
        )}
      </div>
    </div>
  );
}
