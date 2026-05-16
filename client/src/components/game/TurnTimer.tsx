import React from 'react';
import { motion } from 'framer-motion';
import { useTurnTimer } from '../../hooks/useTurnTimer';

interface TurnTimerProps {
  turnStartTime: string;
  turnTimeLimit: number;
  isMyTurn: boolean;
  currentPlayerName: string;
}

export function TurnTimer({ turnStartTime, turnTimeLimit, isMyTurn, currentPlayerName }: TurnTimerProps) {
  const { secondsLeft, progress, isWarning, isCritical } = useTurnTimer(turnStartTime, turnTimeLimit, true);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const ringColor  = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
  const glowColor  = isCritical ? 'rgba(239,68,68,0.35)' : isWarning ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)';
  const borderColor= isCritical ? 'rgba(239,68,68,0.5)' : isWarning ? 'rgba(245,158,11,0.4)' : isMyTurn ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)';
  const bg         = isCritical ? 'rgba(30,5,5,0.9)' : isWarning ? 'rgba(25,18,5,0.9)' : isMyTurn ? 'rgba(5,18,10,0.9)' : 'rgba(5,5,15,0.85)';

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl transition-all"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(20px)',
        boxShadow: isMyTurn || isCritical ? `0 0 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'all 0.3s ease',
      }}>

      {/* Ring timer */}
      <div className="relative w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0">
        {/* Glow behind ring */}
        {(isMyTurn || isCritical) && (
          <div className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${glowColor}, transparent 70%)`, filter: 'blur(4px)' }} />
        )}
        <svg className="w-9 h-9 sm:w-11 sm:h-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
          <motion.circle
            cx="22" cy="22" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
            transition={{ duration: 0.25 }}
          />
        </svg>
        {/* Number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={secondsLeft}
            initial={{ scale: 1.2, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-black text-xs sm:text-sm leading-none"
            style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}` }}>
            {secondsLeft}
          </motion.span>
        </div>
      </div>

      {/* Labels — hidden on mobile */}
      <div className="hidden sm:flex flex-col gap-0.5">
        {isMyTurn ? (
          <>
            <motion.span
              animate={{ opacity: isCritical ? [1, 0.4, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="font-black text-sm leading-none"
              style={{ color: isCritical ? '#ef4444' : '#4ade80', textShadow: `0 0 10px ${ringColor}40` }}>
              {isCritical ? '⚡ Hurry!' : '🎯 Your Turn!'}
            </motion.span>
            {isWarning && !isCritical && (
              <span className="text-[10px] font-semibold" style={{ color: 'rgba(245,158,11,0.8)' }}>
                Running low…
              </span>
            )}
          </>
        ) : (
          <span className="font-semibold text-sm leading-none" style={{ color: 'rgba(226,232,240,0.75)' }}>
            {currentPlayerName.length > 12 ? currentPlayerName.slice(0, 11) + '…' : currentPlayerName}'s Turn
          </span>
        )}
      </div>

      {/* Mobile "YOU" pulse */}
      {isMyTurn && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 0.7 }}
          className="sm:hidden text-[10px] font-black leading-none"
          style={{ color: ringColor }}>
          YOU
        </motion.span>
      )}
    </div>
  );
}
