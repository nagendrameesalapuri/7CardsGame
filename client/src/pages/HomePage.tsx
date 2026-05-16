import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';

const FEATURES = [
  { icon: '🤖', label: 'AI Opponents',    desc: '5 unique personalities' },
  { icon: '⚔️', label: 'Arena Battles',   desc: 'Casual to Boss Rush' },
  { icon: '🏆', label: 'Survival Mode',   desc: 'Beat all 5 AI stages' },
  { icon: '⚡', label: 'Real-time PvP',   desc: 'Play with friends' },
  { icon: '🎯', label: 'Skill Ranking',   desc: 'Climb the leaderboard' },
  { icon: '🎁', label: 'Earn Rewards',    desc: 'Win tournament credits' },
];

const SUIT_POS = [
  { suit: '♠', left: '8%',  top: '18%', delay: 0 },
  { suit: '♥', left: '82%', top: '12%', delay: 0.6 },
  { suit: '♦', left: '75%', top: '65%', delay: 1.2 },
  { suit: '♣', left: '12%', top: '70%', delay: 0.9 },
];

export function HomePage() {
  const { isAuthenticated, guestLogin, googleLogin, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [mode, setMode] = useState<'home' | 'guest'>('home');

  const urlError = new URLSearchParams(window.location.search).get('error');
  const googleNotConfigured = urlError === 'google_not_configured';
  const tooManyRequests = urlError === 'too_many_requests';

  if (isAuthenticated) {
    navigate('/lobby');
    return null;
  }

  const handleGuestLogin = async () => {
    if (guestName.trim() === 'ADMIN') { navigate('/admin/login'); return; }
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
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 0%, rgba(30,20,60,1) 0%, rgba(6,6,18,1) 60%)' }}>

      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[15%] w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.18),transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute top-[50%] right-[10%] w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle,rgba(168,85,247,0.12),transparent 70%)', filter: 'blur(50px)' }} />
        <div className="absolute bottom-[10%] left-[30%] w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle,rgba(34,197,94,0.08),transparent 70%)', filter: 'blur(40px)' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Floating suit symbols */}
      {SUIT_POS.map(({ suit, left, top, delay }) => (
        <motion.div key={suit}
          className="absolute text-7xl sm:text-9xl select-none pointer-events-none font-black"
          style={{ left, top, color: suit === '♥' || suit === '♦' ? 'rgba(180,30,30,0.07)' : 'rgba(255,255,255,0.05)' }}
          animate={{ y: [0, -24, 0], rotate: [0, 4, -4, 0] }}
          transition={{ duration: 5 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}>
          {suit}
        </motion.div>
      ))}

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md">

        {/* Hero brand */}
        <div className="text-center mb-8">
          <motion.div animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-4">
            <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-4xl"
              style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.25))', border: '1px solid rgba(99,102,241,0.5)', boxShadow: '0 0 40px rgba(99,102,241,0.25)' }}>
              ⚔️
            </div>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-2"
            style={{ background: 'linear-gradient(135deg,#ffffff 0%,#c7d2fe 40%,#a78bfa 70%,#818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Arena of Sevens
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-px flex-1 max-w-16" style={{ background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.5))' }} />
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: '#818cf8' }}>Master the SHOW</p>
            <div className="h-px flex-1 max-w-16" style={{ background: 'linear-gradient(90deg,rgba(99,102,241,0.5),transparent)' }} />
          </div>
          <p className="text-dark-muted text-sm mt-3">
            Strategic AI card tournament · Skill-based competition
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-3xl p-6 sm:p-8 shadow-2xl"
          style={{ background: 'rgba(10,12,24,0.95)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
          {mode === 'home' ? (
            <div className="space-y-4">
              {googleNotConfigured && (
                <p className="text-yellow-400 text-xs text-center bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
                  Google login not available on this server. Use Guest login instead.
                </p>
              )}
              {tooManyRequests && (
                <p className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  Too many login attempts. Please wait a few minutes and try again.
                </p>
              )}

              <Button variant="primary" fullWidth size="lg" onClick={googleLogin}>
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
                  <span className="px-3 text-dark-muted text-sm" style={{ background: 'rgba(10,12,24,0.95)' }}>or</span>
                </div>
              </div>

              <Button variant="secondary" fullWidth size="lg" onClick={() => setMode('guest')}>
                👤 Play as Guest
              </Button>

              <p className="text-center text-dark-muted text-xs">
                Guest progress is not saved. Sign in to track your arena ranking.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={() => setMode('home')}
                className="flex items-center gap-1 text-dark-muted text-sm hover:text-white transition-colors mb-2">
                ← Back
              </button>
              <h2 className="text-xl font-black text-white">Choose your arena name</h2>
              <input
                value={guestName}
                onChange={e => { setGuestName(e.target.value); if (guestError) setGuestError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleGuestLogin()}
                placeholder="Your display name"
                maxLength={20}
                autoFocus
                className="w-full bg-dark-bg border-2 border-dark-border rounded-2xl px-4 py-3 text-white placeholder-dark-muted focus:outline-none focus:border-indigo-500 transition-colors text-lg"
              />
              {guestError && <p className="text-red-400 text-sm">{guestError}</p>}
              <Button variant="neon" fullWidth size="lg" onClick={handleGuestLogin}
                loading={isLoading} disabled={guestName.trim().length < 2}>
                Enter the Arena
              </Button>
            </div>
          )}
        </div>

        {/* Feature chips */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          {FEATURES.map(f => (
            <div key={f.label} className="flex flex-col items-center gap-1 p-2.5 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xl">{f.icon}</span>
              <span className="text-[10px] font-bold text-white leading-tight">{f.label}</span>
              <span className="text-[9px] text-dark-muted">{f.desc}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
