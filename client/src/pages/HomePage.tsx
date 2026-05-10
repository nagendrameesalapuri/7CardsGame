import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';

export function HomePage() {
  const { isAuthenticated, guestLogin, googleLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [mode, setMode] = useState<'home' | 'guest'>('home');

  if (isAuthenticated) {
    navigate('/lobby');
    return null;
  }

  const handleGuestLogin = async () => {
    if (!guestName.trim() || guestName.trim().length < 2) {
      setGuestError('Name must be at least 2 characters');
      return;
    }
    setGuestError('');
    try {
      await guestLogin(guestName.trim());
      navigate('/lobby');
    } catch (e: any) {
      setGuestError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 overflow-hidden">
      {/* Background felt texture */}
      <div className="absolute inset-0 bg-felt-dark opacity-30 bg-felt-pattern" />

      {/* Floating cards decoration */}
      {['♥', '♦', '♣', '♠'].map((suit, i) => (
        <motion.div
          key={suit}
          className="absolute text-6xl opacity-5 select-none pointer-events-none text-white"
          animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
          style={{ left: `${15 + i * 20}%`, top: `${20 + (i % 2) * 40}%` }}
        >
          {suit}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-8xl mb-4 inline-block"
          >
            🃏
          </motion.div>
          <h1 className="text-5xl font-bold font-game text-white mb-2">7 Cards Show</h1>
          <p className="text-dark-muted">The ultimate Indian multiplayer card game</p>
        </div>

        {/* Auth card */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl">
          {mode === 'home' ? (
            <div className="space-y-4">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={googleLogin}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dark-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-dark-surface text-dark-muted text-sm">or</span>
                </div>
              </div>

              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={() => setMode('guest')}
              >
                👤 Play as Guest
              </Button>

              <p className="text-center text-dark-muted text-xs mt-4">
                Guest progress is not saved. Sign in with Google to track your stats.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setMode('home')}
                className="flex items-center gap-1 text-dark-muted text-sm hover:text-dark-text transition-colors mb-2"
              >
                ← Back
              </button>

              <h2 className="text-xl font-bold text-dark-text">Choose a username</h2>

              <input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGuestLogin()}
                placeholder="Your display name"
                maxLength={20}
                autoFocus
                className="w-full bg-dark-bg border-2 border-dark-border rounded-xl px-4 py-3 text-dark-text placeholder-dark-muted focus:outline-none focus:border-neon-green transition-colors text-lg"
              />

              {guestError && (
                <p className="text-neon-red text-sm">{guestError}</p>
              )}

              <Button
                variant="neon"
                fullWidth
                size="lg"
                onClick={handleGuestLogin}
                loading={isLoading}
                disabled={guestName.trim().length < 2}
              >
                Start Playing
              </Button>
            </div>
          )}
        </div>

        {/* Feature chips */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {['🎮 2-5 Players', '🤖 AI Bots', '⚡ Real-time', '🏆 Leaderboard', '🎨 Premium UI'].map(f => (
            <span key={f} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-dark-muted">
              {f}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
