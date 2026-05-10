import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ClientPlayerState } from '../../types';
import { Card } from './Card';
import { Avatar } from '../ui/Avatar';

interface OpponentHandProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  isAttackTarget: boolean;
  jokerRank?: string;
  position: 'top' | 'left' | 'right';
}

export function OpponentHand({ player, isCurrentTurn, isAttackTarget, position }: OpponentHandProps) {
  const isHorizontal = position === 'top';

  const dummyCards = Array.from({ length: Math.min(player.handCount, 7) }, (_, i) => i);

  return (
    <div className={clsx(
      'flex flex-col items-center gap-2',
      position === 'left' && 'flex-col-reverse',
      position === 'right' && 'flex-col',
    )}>
      {/* Player info */}
      <div className={clsx(
        'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
        isCurrentTurn && 'bg-neon-green/10 border border-neon-green/40 shadow-neon-green',
        isAttackTarget && 'bg-neon-red/10 border border-neon-red/40',
        !isCurrentTurn && !isAttackTarget && 'bg-dark-surface/60 border border-dark-border',
      )}>
        {/* Turn indicator */}
        {isCurrentTurn && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-neon-green text-xs font-bold"
          >
            🎯 TURN
          </motion.div>
        )}
        {isAttackTarget && (
          <div className="text-neon-red text-xs font-bold animate-pulse">⚔️ ATTACK!</div>
        )}

        <Avatar
          avatar={player.avatar}
          username={player.username}
          size="sm"
          isBot={player.isBot}
          isConnected={player.isConnected}
        />
        <span className="text-xs text-dark-text font-medium max-w-[80px] truncate">{player.username}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-dark-muted">{player.handCount} cards</span>
          <span className={clsx(
            'font-bold',
            player.totalScore > 80 ? 'text-neon-red' : player.totalScore > 50 ? 'text-yellow-400' : 'text-dark-text'
          )}>
            {player.totalScore}pts
          </span>
        </div>

        {player.isEliminated && (
          <span className="text-xs text-neon-red font-bold">ELIMINATED</span>
        )}
      </div>

      {/* Hidden cards */}
      <div className={clsx(
        'flex',
        isHorizontal ? 'flex-row' : 'flex-col',
        'gap-0.5'
      )}>
        {dummyCards.map((i) => (
          <Card
            key={i}
            card={{ id: `hidden-${i}`, suit: 'spades', rank: 'A', value: 0, isJoker: false }}
            isHidden
            size="sm"
            className={clsx(!isHorizontal && 'rotate-90')}
            style={isHorizontal
              ? { marginLeft: i === 0 ? 0 : '-24px', zIndex: i }
              : { marginTop: i === 0 ? 0 : '-32px', zIndex: i }
            }
          />
        ))}
      </div>
    </div>
  );
}
