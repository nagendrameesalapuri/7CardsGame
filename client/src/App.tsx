import React, { useEffect } from 'react';
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

function MigrationNotice() {
  if (window.location.hostname !== '7cardsgames.netlify.app') return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.97)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm text-center rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0d1117, #111827)', border: '1px solid rgba(251,191,36,0.35)' }}>
        <div className="pt-10 pb-6 px-8"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.12) 0%, transparent 65%)' }}>
          <div className="text-6xl mb-4">🎴</div>
          <h2 className="text-2xl font-black text-white mb-2">We've Moved!</h2>
          <p className="text-sm" style={{ color: '#8b949e' }}>
            This URL is no longer active. Our game has a new home — please update your bookmarks.
          </p>
        </div>
        <div className="px-8 pb-2">
          <div className="rounded-2xl px-4 py-3 mb-4"
            style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8b949e' }}>New URL</p>
            <p className="font-black text-base" style={{ color: '#fbbf24' }}>arenaofsevens.netlify.app</p>
          </div>
          <a href="https://arenaofsevens.netlify.app"
            className="block w-full py-4 rounded-2xl font-black text-base mb-3"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0d1117' }}>
            Go to Arena of Sevens →
          </a>
          <p className="text-[11px] pb-6" style={{ color: '#4b5563' }}>
            This site is no longer supported and will not receive updates.
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
