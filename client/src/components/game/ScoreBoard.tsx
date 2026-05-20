import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { RoundResult, ClientPlayerState, Card as CardType } from '../../types';
import { Avatar } from '../ui/Avatar';

interface ScoreBoardProps {
  roundResult: RoundResult;
  players: ClientPlayerState[];
  roundNumber: number;
  roundCount: number;
  myUserId: string;
  roundReadyUpdate: { readyUserIds: string[]; total: number } | null;
  onReady: () => void;
}

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', clubs: '♣', hearts: '♥', diamonds: '♦', none: '',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

function CardBadge({ card }: { card: CardType }) {
  const isPrintedJoker = card.rank === 'Joker';
  const isRed = RED_SUITS.has(card.suit);
  const suit = SUIT_SYMBOL[card.suit] ?? '';
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 400 }}
      className={clsx(
        'flex flex-col items-center justify-between rounded-lg border px-1.5 py-1 min-w-[36px] h-12 text-center leading-none select-none',
        card.isJoker
          ? 'border-yellow-400 text-yellow-300'
          : isRed
            ? 'bg-white border-red-300 text-red-600'
            : 'bg-white border-slate-300 text-slate-800',
      )}
      style={card.isJoker ? {
        background: 'linear-gradient(135deg, rgba(255,215,0,0.22) 0%, rgba(251,191,36,0.1) 100%)',
        boxShadow: '0 2px 10px rgba(255,215,0,0.35)',
      } : {
        boxShadow: isRed
          ? '0 2px 8px rgba(239,68,68,0.2), 0 1px 2px rgba(0,0,0,0.12)'
          : '0 2px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)',
      }}
    >
      <span className="text-xs font-bold leading-none">{isPrintedJoker ? '🃏' : card.rank}</span>
      <span className="text-base leading-none">{card.isJoker && !isPrintedJoker ? '★' : suit}</span>
      <span className="text-xs font-bold leading-none opacity-60">{card.value}</span>
    </motion.div>
  );
}

function TrophyRays({ color = '#ffd700' }: { color?: string }) {
  return (
    <div className="absolute inset-0 flex items-start justify-center pointer-events-none" style={{ top: 0 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.25, 0.6, 0.25], scaleY: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.6 + (i % 3) * 0.3, delay: i * 0.1, repeat: Infinity }}
          style={{
            position: 'absolute',
            width: 2,
            height: 45 + (i % 3) * 14,
            background: `linear-gradient(to top, transparent, ${color}77)`,
            transformOrigin: 'bottom center',
            transform: `rotate(${i * 30}deg) translateY(-55px)`,
            borderRadius: '2px',
          }}
        />
      ))}
    </div>
  );
}

const MATCH_END_DELAY_S = 15;
const NEXT_ROUND_DELAY_S = 10;

export function ScoreBoard({
  roundResult, players, roundNumber, roundCount,
  myUserId, roundReadyUpdate, onReady,
}: ScoreBoardProps) {
  const winner = players.find(p => p.id === roundResult.winnerId);
  const winnerIds = roundResult.winnerIds ?? [roundResult.winnerId];
  const isTie = winnerIds.length > 1;
  const isFinalRound = roundNumber >= roundCount;
  const isWin = roundResult.showPlayerWon;

  // Match-end countdown (existing)
  const [countdown, setCountdown] = useState(MATCH_END_DELAY_S);
  useEffect(() => {
    if (!isFinalRound) return;
    setCountdown(MATCH_END_DELAY_S);
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [isFinalRound]);

  // Auto next-round countdown — replaces the ready button
  const [nextRoundSec, setNextRoundSec] = useState(NEXT_ROUND_DELAY_S);
  const readyFired = React.useRef(false);
  useEffect(() => {
    if (isFinalRound) return;
    readyFired.current = false;
    setNextRoundSec(NEXT_ROUND_DELAY_S);
    const t = setInterval(() => {
      setNextRoundSec(s => {
        if (s <= 1) {
          clearInterval(t);
          if (!readyFired.current) { readyFired.current = true; onReady(); }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isFinalRound, roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const myPlayer = players.find(p => p.userId === myUserId); // eslint-disable-line @typescript-eslint/no-unused-vars
  const readyCount = roundReadyUpdate?.readyUserIds.length ?? 0;

  const sorted = [...roundResult.playerResults].sort((a, b) => {
    const aWins = winnerIds.includes(a.playerId);
    const bWins = winnerIds.includes(b.playerId);
    if (aWins && !bWins) return -1;
    if (!aWins && bWins) return 1;
    return a.roundPoints - b.roundPoints;
  });

  const showPlayerResult = roundResult.playerResults.find(r => r.playerId === roundResult.showPlayerId);
  const showHandTotal = showPlayerResult
    ? showPlayerResult.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0)
    : 0;
  const showPlayerName = players.find(p => p.id === roundResult.showPlayerId)?.username ?? '';

  const penaltyBreakdown = !isWin
    ? roundResult.playerResults
        .filter(r => r.hand.length > 0)
        .map(r => ({
          username: r.username,
          pts: r.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0),
        }))
    : [];

  const trophyColor = isWin ? (isTie ? '#a78bfa' : '#ffd700') : '#f87171';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(18px)' }}
    >
      <motion.div
        initial={{ scale: 0.78, y: 55, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 290, damping: 26 }}
        className="w-full max-w-2xl overflow-hidden shadow-2xl"
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(170deg, #0f1520 0%, #0d1117 60%, #111827 100%)',
          border: isWin
            ? '1px solid rgba(139,92,246,0.38)'
            : '1px solid rgba(239,68,68,0.32)',
          boxShadow: isWin
            ? '0 0 70px rgba(139,92,246,0.18), 0 30px 70px rgba(0,0,0,0.75)'
            : '0 0 70px rgba(239,68,68,0.14), 0 30px 70px rgba(0,0,0,0.75)',
        }}
      >
        {/* Shimmer line */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, delay: 0.3, repeat: Infinity, repeatDelay: 4 }}
          style={{
            height: '2px',
            background: isWin
              ? 'linear-gradient(90deg, transparent, #a78bfa, #ffd700, #a78bfa, transparent)'
              : 'linear-gradient(90deg, transparent, #f87171, transparent)',
          }}
        />

        {/* Header */}
        <div
          className="px-6 py-7 text-center relative overflow-hidden"
          style={{
            background: isWin
              ? 'linear-gradient(160deg, rgba(88,28,220,0.48) 0%, rgba(59,7,100,0.35) 45%, rgba(15,23,42,0.25) 100%)'
              : 'linear-gradient(160deg, rgba(185,28,28,0.48) 0%, rgba(127,7,7,0.35) 45%, rgba(15,23,42,0.25) 100%)',
          }}
        >
          {/* Glow blob */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-40px', left: '50%', transform: 'translateX(-50%)',
              width: '220px', height: '130px',
              background: isWin
                ? 'radial-gradient(ellipse, rgba(167,139,250,0.32) 0%, transparent 70%)'
                : 'radial-gradient(ellipse, rgba(248,113,113,0.22) 0%, transparent 70%)',
              filter: 'blur(22px)',
            }}
          />

          {/* Trophy */}
          <div className="relative inline-block mb-4">
            {isWin && <TrophyRays color={trophyColor} />}
            <motion.div
              animate={{
                rotate: isWin ? [0, -10, 10, -5, 0] : [0, -5, 5, 0],
                scale: [1, 1.18, 1],
              }}
              transition={{ duration: 0.65, delay: 0.25 }}
              style={{
                fontSize: 68,
                lineHeight: 1,
                filter: `drop-shadow(0 0 24px ${trophyColor}aa)`,
                position: 'relative',
                zIndex: 10,
              }}
            >
              {isWin ? (isTie ? '🤝' : '🏆') : '💥'}
            </motion.div>
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, type: 'spring', stiffness: 250 }}
            className="text-2xl font-black text-white relative z-10 leading-tight"
          >
            {isWin
              ? isTie
                ? `Tie — ${winnerIds.length} players win!`
                : `${winner?.username} wins the round!`
              : 'SHOW failed!'}
          </motion.h2>

          {/* Show caller badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.48 }}
            className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.11)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="text-sm">📢</span>
            <span className="text-yellow-300 font-bold text-sm">{showPlayerName}</span>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>called SHOW with</span>
            <span
              className="font-black text-lg px-2 py-0.5 rounded-lg"
              style={{
                background: 'rgba(255,215,0,0.14)',
                color: '#ffd700',
                border: '1px solid rgba(255,215,0,0.3)',
              }}
            >
              {showHandTotal} pts
            </span>
          </motion.div>

          {/* Failed SHOW penalty */}
          {!isWin && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52 }}
              className="mt-4 space-y-2"
            >
              <p className="text-red-300 text-sm font-semibold">
                {showPlayerName} wasn't the lowest — {winner?.username} had{' '}
                {showPlayerResult?.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0) ?? 0} pts less!
              </p>
              <div
                className="inline-flex flex-wrap justify-center gap-1 text-xs px-3 py-2 rounded-xl"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.38)' }}>Penalty =</span>
                {penaltyBreakdown.map((b, i) => (
                  <span key={b.username}>
                    <span className="text-white font-bold">{b.pts}</span>
                    <span style={{ color: 'rgba(255,255,255,0.38)' }}> ({b.username})</span>
                    {i < penaltyBreakdown.length - 1 && (
                      <span style={{ color: 'rgba(255,255,255,0.28)' }}> + </span>
                    )}
                  </span>
                ))}
                {showPlayerResult && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.38)' }}> = </span>
                    <span className="font-black" style={{ color: '#f87171' }}>
                      {showPlayerResult.roundPoints} pts
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {isTie && isWin && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,230,100,0.6)' }}>
              All tied winners score 0 points this round
            </p>
          )}
        </div>

        {/* Player results */}
        <div className="p-4 space-y-2.5 max-h-[48vh] overflow-y-auto">
          {sorted.map((result, i) => {
            const player = players.find(p => p.id === result.playerId);
            const isWinner = winnerIds.includes(result.playerId);
            const isShowPlayer = result.playerId === roundResult.showPlayerId;
            const handTotal = result.hand.reduce((s, c) => s + (c.isJoker ? 0 : c.value), 0);

            return (
              <motion.div
                key={result.playerId}
                initial={{ opacity: 0, x: -26 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 290 }}
                className="rounded-2xl p-3.5 relative overflow-hidden"
                style={{
                  background: isWinner
                    ? 'linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,204,106,0.05) 100%)'
                    : isShowPlayer && !isWin
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.05) 100%)'
                      : 'rgba(255,255,255,0.03)',
                  border: isWinner
                    ? '1px solid rgba(0,255,136,0.32)'
                    : isShowPlayer && !isWin
                      ? '1px solid rgba(239,68,68,0.32)'
                      : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isWinner
                    ? '0 4px 20px rgba(0,255,136,0.07)'
                    : 'none',
                }}
              >
                {isWinner && (
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, delay: 0.9 + i * 0.1, repeat: Infinity, repeatDelay: 3.5 }}
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.07), transparent)',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Top row */}
                <div className="flex items-center gap-3 mb-3 relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={isWinner
                      ? {
                          background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
                          color: '#0d1117',
                          boxShadow: '0 0 12px rgba(0,255,136,0.55)',
                        }
                      : isShowPlayer && !isWin
                        ? {
                            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                            color: '#fff',
                          }
                        : {
                            background: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.45)',
                          }
                    }
                  >
                    {isWinner ? (isTie ? '🤝' : '👑') : `${i + 1}`}
                  </div>

                  <Avatar avatar={player?.avatar ?? 'avatar_1'} size="sm" isBot={player?.isBot} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="font-bold text-sm"
                        style={{ color: isWinner ? '#00ff88' : 'rgba(255,255,255,0.88)' }}
                      >
                        {result.username}
                      </span>
                      {isWinner && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-black"
                          style={{
                            background: 'linear-gradient(135deg, rgba(0,255,136,0.18), rgba(0,204,106,0.1))',
                            color: '#00ff88',
                            border: '1px solid rgba(0,255,136,0.38)',
                          }}
                        >
                          {isTie ? 'TIE WIN' : 'WIN'}
                        </span>
                      )}
                      {isShowPlayer && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-black"
                          style={{
                            background: 'rgba(255,215,0,0.14)',
                            color: '#ffd700',
                            border: '1px solid rgba(255,215,0,0.3)',
                          }}
                        >
                          SHOW · {handTotal} pts
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      {isShowPlayer && !isWin
                        ? `Called SHOW with ${handTotal} pts — penalty: ${result.roundPoints} pts`
                        : isShowPlayer
                          ? `Called SHOW with ${handTotal} pts in hand`
                          : `Hand total: ${handTotal} pts`}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className="font-black text-xl"
                      style={{ color: result.roundPoints === 0 ? '#00ff88' : '#f87171' }}
                    >
                      {result.roundPoints === 0 ? '+0' : `+${result.roundPoints}`}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>
                      Total:{' '}
                      <span className="font-bold" style={{ color: 'rgba(255,255,255,0.78)' }}>
                        {result.totalScore}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex gap-1.5 flex-wrap">
                  {[...result.hand]
                    .sort((a, b) => {
                      if (a.isJoker && !b.isJoker) return -1;
                      if (!a.isJoker && b.isJoker) return 1;
                      return a.value - b.value;
                    })
                    .map(c => <CardBadge key={c.id} card={c} />)
                  }
                  {result.hand.length === 0 && (
                    <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      No cards
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-4 space-y-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Round progress pills */}
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: roundCount }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: idx < roundNumber ? 22 : 8,
                    background: idx < roundNumber
                      ? idx === roundNumber - 1
                        ? isWin ? '#00ff88' : '#f87171'
                        : 'rgba(255,255,255,0.22)'
                      : 'rgba(255,255,255,0.09)',
                  }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Round{' '}
              <strong style={{ color: 'rgba(255,255,255,0.72)' }}>{roundNumber}</strong>{' '}
              of{' '}
              <strong style={{ color: 'rgba(255,255,255,0.72)' }}>{roundCount}</strong>
              {isFinalRound
                ? <span className="ml-1 font-bold" style={{ color: '#00ff88' }}>— Final round!</span>
                : <span className="ml-1" style={{ color: 'rgba(255,255,255,0.32)' }}>— {roundCount - roundNumber} remaining</span>}
            </p>
          </div>

          {!isFinalRound && (
            <div className="flex flex-col items-center gap-2">
              {/* Circular countdown ring */}
              <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
                <svg width="72" height="72" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <motion.circle
                    cx="36" cy="36" r="30" fill="none"
                    stroke="#00ff88" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 30}`}
                    strokeDashoffset={`${2 * Math.PI * 30 * (1 - nextRoundSec / NEXT_ROUND_DELAY_S)}`}
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                  />
                </svg>
                <div className="flex flex-col items-center z-10">
                  <span className="text-xl font-black" style={{ color: nextRoundSec <= 3 ? '#ff6b6b' : '#00ff88', lineHeight: 1 }}>
                    {nextRoundSec}
                  </span>
                  <span className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>sec</span>
                </div>
              </div>
              <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Next round starting…
              </p>
              {readyCount > 0 && (
                <p className="text-[10px]" style={{ color: '#00ff88' }}>
                  {readyCount} player{readyCount > 1 ? 's' : ''} ready
                </p>
              )}
            </div>
          )}

          {isFinalRound && (
            <div className="flex flex-col items-center gap-2.5">
              <div className="flex items-center gap-3">
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.45, opacity: 0.55 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-black w-12 text-center"
                  style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.65)' }}
                >
                  {countdown}
                </motion.div>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {countdown > 0 ? 'seconds until match results…' : 'Showing results…'}
                </p>
              </div>
              <div
                className="w-full max-w-xs h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(countdown / MATCH_END_DELAY_S) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                  style={{ background: 'linear-gradient(90deg, #ffd700, #f59e0b)' }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
