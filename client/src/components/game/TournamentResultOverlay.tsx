import React from 'react';
import { motion } from 'framer-motion';
import { useTournamentStore } from '../../store/tournamentStore';
import { useGameStore } from '../../store/gameStore';

export function TournamentResultOverlay() {
  const { gameResult, playerWins, botWins, entryFee, prizeAmount, continueToNextGame, reset } = useTournamentStore();
  const { reset: resetGame } = useGameStore();

  if (!gameResult) return null;

  const { isDraw, playerWon, playerScore, botScore, botScores, tournamentOver, won, overallDraw, totalReturn, nextGameNumber } = gameResult;

  const handleContinue = () => {
    if (tournamentOver) {
      resetGame();
      reset();
    } else {
      continueToNextGame();
    }
  };

  // Determine hero content for this game result
  const gameIsDraw  = isDraw;
  const heroEmoji   = tournamentOver
    ? overallDraw ? '🤝' : won ? '🏆' : '😔'
    : gameIsDraw ? '🤝' : playerWon ? '✅' : '❌';

  const heroTitle   = tournamentOver
    ? overallDraw ? 'Tournament Draw!' : won ? 'Tournament Won!' : 'Tournament Over'
    : gameIsDraw ? `Game ${gameResult.gameNumber} Draw` : playerWon ? `Game ${gameResult.gameNumber} Won!` : `Game ${gameResult.gameNumber} Lost`;

  const heroSub     = tournamentOver
    ? overallDraw
      ? `Series tied ${playerWins}–${botWins} — entry fee refunded`
      : won
      ? `You won ${playerWins}–${botWins}!`
      : `Bots won ${botWins}–${playerWins}`
    : gameIsDraw
    ? `Equal scores — no winner for this game`
    : `Game ${nextGameNumber} coming up…`;

  // Gradient glow behind hero
  const glowColor = tournamentOver
    ? overallDraw ? 'rgba(251,191,36,0.12)' : won ? 'rgba(255,215,0,0.15)' : 'rgba(255,60,60,0.1)'
    : gameIsDraw ? 'rgba(251,191,36,0.10)' : playerWon ? 'rgba(0,255,136,0.12)' : 'rgba(255,60,60,0.1)';

  const borderColor = tournamentOver && won
    ? 'rgba(255,215,0,0.4)'
    : tournamentOver && overallDraw
    ? 'rgba(251,191,36,0.3)'
    : 'rgba(255,255,255,0.08)';

  const btnStyle = tournamentOver && won
    ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }
    : tournamentOver && overallDraw
    ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }
    : !tournamentOver
    ? { background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#0d1117' }
    : { background: 'rgba(255,255,255,0.08)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.1)' };

  const btnLabel = tournamentOver
    ? overallDraw ? '🤝 Claim Refund & Exit' : won ? '💰 Claim Prize & Exit' : '🏠 Back to Lobby'
    : gameIsDraw ? `⚔️ Start Game ${nextGameNumber}` : `⚔️ Start Game ${nextGameNumber}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0d1117 0%, #111827 100%)', border: `1px solid ${borderColor}` }}
      >
        {/* Hero */}
        <div className="pt-8 pb-5 px-6 text-center relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowColor} 0%, transparent 70%)` }}
          />
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: 2, duration: 0.5, delay: 0.3 }}
            className="text-6xl mb-3 relative z-10"
          >
            {heroEmoji}
          </motion.div>
          <h2 className="text-2xl font-black text-white relative z-10">{heroTitle}</h2>
          <p className="text-sm text-dark-muted mt-1 relative z-10">{heroSub}</p>
        </div>

        {/* Series score */}
        <div className="mx-5 mb-4 rounded-2xl py-3 px-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] text-dark-muted uppercase tracking-widest text-center mb-2">Series Score</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-xs text-dark-muted">You</p>
              <p className="text-3xl font-black" style={{ color: '#00ff88' }}>{playerWins}</p>
            </div>
            <div className="text-dark-muted text-xl font-light">—</div>
            <div className="text-center">
              <p className="text-xs text-dark-muted">Bots</p>
              <p className="text-3xl font-black" style={{ color: '#ff6b6b' }}>{botWins}</p>
            </div>
          </div>
        </div>

        {/* Game score */}
        <div className="mx-5 mb-4 rounded-2xl py-3 px-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between items-center">
            <div className="text-center">
              <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1">Your Score</p>
              <p className={`text-lg font-bold ${gameIsDraw ? 'text-yellow-400' : playerWon ? 'text-neon-green' : 'text-red-400'}`}>
                {playerScore} pts
              </p>
            </div>
            <div className="text-dark-muted text-sm">{gameIsDraw ? '=' : 'vs'}</div>
            {botScores && botScores.length > 0 ? (
              <div className="flex gap-3">
                {botScores.map((b, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1">{b.username}</p>
                    <p className={`text-lg font-bold ${gameIsDraw ? 'text-yellow-400' : b.score === botScore && !playerWon ? 'text-neon-green' : 'text-red-400'}`}>
                      {b.score} pts
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[10px] text-dark-muted uppercase tracking-wide mb-1">Bot Score</p>
                <p className={`text-lg font-bold ${gameIsDraw ? 'text-yellow-400' : !playerWon ? 'text-neon-green' : 'text-red-400'}`}>
                  {botScore} pts
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Draw notice for single game */}
        {gameIsDraw && !tournamentOver && (
          <div className="mx-5 mb-4 rounded-xl py-2 px-4 text-center text-xs text-yellow-400/80"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            Equal scores — this game doesn't count for either side
          </div>
        )}

        {/* Prize / refund banner (tournament over) */}
        {tournamentOver && (won || overallDraw) && totalReturn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
            className="mx-5 mb-4 rounded-2xl py-4 text-center"
            style={won
              ? { background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)' }
              : { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
          >
            {won ? (
              <>
                <p className="text-xs text-yellow-400/70 uppercase tracking-widest mb-1">Prize Won</p>
                <p className="text-4xl font-black text-yellow-400">₹{prizeAmount}</p>
                <p className="text-xs text-yellow-400/60 mt-1">+₹{entryFee} entry back = ₹{totalReturn} total added to wallet ✓</p>
              </>
            ) : (
              <>
                <p className="text-xs text-yellow-400/70 uppercase tracking-widest mb-1">Entry Refunded</p>
                <p className="text-4xl font-black text-yellow-400">₹{totalReturn}</p>
                <p className="text-xs text-yellow-400/60 mt-1">Draw — your entry fee has been returned to wallet ✓</p>
              </>
            )}
          </motion.div>
        )}

        {/* Action button */}
        <div className="px-5 pb-6 pt-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleContinue}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={btnStyle}
          >
            {btnLabel}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
