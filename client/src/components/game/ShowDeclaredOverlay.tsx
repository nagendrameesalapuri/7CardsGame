import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClientPlayerState } from '../../types';
import { Avatar } from '../ui/Avatar';

interface ShowDeclaredOverlayProps {
  showPlayer: ClientPlayerState | undefined;
  isMe: boolean;
  onDone: () => void;
}

export function ShowDeclaredOverlay({ showPlayer, isMe, onDone }: ShowDeclaredOverlayProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(interval); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.7, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className="flex flex-col items-center gap-6 text-center px-8"
      >
        {/* Animated trophy */}
        <motion.div
          animate={{ rotate: [-8, 8, -8], scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="text-7xl"
        >
          🎴
        </motion.div>

        {/* Avatar */}
        {showPlayer && (
          <div className="flex flex-col items-center gap-2">
            <Avatar avatar={showPlayer.avatar} size="xl" isBot={showPlayer.isBot} />
            <span className="text-white text-3xl font-bold">
              {isMe ? 'You' : showPlayer.username}
            </span>
          </div>
        )}

        {/* Message */}
        <div>
          <p className="text-yellow-400 text-2xl font-bold">
            {isMe ? 'You declared SHOW!' : 'declared SHOW!'}
          </p>
          <p className="text-dark-muted text-base mt-1">
            Revealing all cards in…
          </p>
        </div>

        {/* Countdown */}
        <motion.div
          key={count}
          initial={{ scale: 1.5, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full border-4 border-yellow-400 flex items-center justify-center"
        >
          <span className="text-yellow-400 text-4xl font-bold">{count}</span>
        </motion.div>

        <p className="text-dark-muted text-sm animate-pulse">
          All cards will be shown after the countdown
        </p>
      </motion.div>
    </motion.div>
  );
}
