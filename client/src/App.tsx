import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuthStore } from './store/authStore';
import { soundService } from './services/sound';

import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { WalletPage } from './pages/WalletPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { SpectatorPage } from './pages/SpectatorPage';
import { TournamentPage } from './pages/TournamentPage';

// Handle Google OAuth callback token — runs inside BrowserRouter so useNavigate works
function AuthCallback() {
  const { setToken, loadMe } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      if (token) {
        setToken(token);
        await loadMe();
        navigate('/lobby', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-dark-muted animate-pulse text-sm">Signing in…</div>
    </div>
  );
}

const NEW_URL = 'https://arenaofsevens.netlify.app';

function MigrationNotice() {
  const [copied, setCopied] = useState(false);

  if (window.location.hostname !== '7cardsgames.netlify.app') return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(NEW_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const steps = [
    {
      icon: '🗑️',
      title: 'Delete this app',
      desc: 'Uninstall or remove this bookmark / home screen shortcut from your device.',
    },
    {
      icon: '🌐',
      title: 'Open Chrome & go to the new URL',
      desc: 'Paste the URL below in Chrome\'s address bar and open it.',
    },
    {
      icon: '⭐',
      title: 'Bookmark the new site',
      desc: 'Tap the Chrome menu → "Add to Home Screen" or star it to bookmark.',
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl my-auto"
        style={{ background: 'linear-gradient(160deg, #0d1117, #111827)', border: '1px solid rgba(251,191,36,0.35)' }}>

        {/* Header */}
        <div className="pt-10 pb-5 px-7 text-center"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.13) 0%, transparent 65%)' }}>
          <div className="text-5xl mb-3">🎴</div>
          <h2 className="text-2xl font-black text-white mb-2">We've Moved!</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#8b949e' }}>
            This site is no longer active. Please switch to our new URL to continue playing.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-4">

          {/* New URL + copy */}
          <div className="rounded-2xl px-4 py-3"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-2 text-center" style={{ color: '#8b949e' }}>New URL</p>
            <div className="flex items-center gap-2">
              <p className="font-black text-sm flex-1 truncate" style={{ color: '#fbbf24' }}>
                arenaofsevens.netlify.app
              </p>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={copied
                  ? { background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }
                  : { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Step-by-step instructions */}
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white mb-0.5">
                    <span className="mr-1.5" style={{ color: '#fbbf24' }}>Step {i + 1}.</span>{s.title}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: '#6b7280' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a href={NEW_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-base"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }}>
            Open Arena of Sevens
            <span style={{ fontSize: 18 }}>→</span>
          </a>

          <p className="text-[11px] text-center" style={{ color: '#374151' }}>
            This site will not receive any further updates.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-muted animate-pulse text-sm">Loading…</div>
      </div>
    );
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}


export function App() {
  const { loadMe, token } = useAuthStore();

  useEffect(() => {
    if (token) loadMe();
    soundService.preload(['card_deal', 'card_draw', 'card_discard', 'power_seven', 'power_jack', 'show_call', 'win', 'lose', 'chat']);

    const warmup = () => soundService.warmup();
    document.addEventListener('touchstart', warmup, { passive: true });
    document.addEventListener('click', warmup);
    const onVisible = () => { if (document.visibilityState === 'visible') soundService.warmup(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('touchstart', warmup);
      document.removeEventListener('click', warmup);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadMe, token]);

  return (
    <ThemeProvider>
      <MigrationNotice />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/spectate/:code" element={<ProtectedRoute><SpectatorPage /></ProtectedRoute>} />
          <Route path="/tournament" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster position="top-center" containerStyle={{ zIndex: 9999 }} toastOptions={{ style: { background: 'transparent', boxShadow: 'none', padding: 0 } }} />
      </BrowserRouter>
    </ThemeProvider>
  );
}
