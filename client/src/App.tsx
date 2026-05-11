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

// Handle Google OAuth callback token — runs inside BrowserRouter so useNavigate works
function AuthCallback() {
  const { setToken, loadMe } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      if (token) {
        setToken(token);       // persist token to store + localStorage
        await loadMe();        // fetch user and set isAuthenticated: true
        navigate('/lobby', { replace: true });  // no full-page reload
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  // Only block with spinner when loading AND we have no user data yet (initial auth check)
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

    // Warm up AudioContext on every touch/click so iOS keeps it running after background.
    // `once: true` was wrong — iOS suspends AudioContext on background and needs re-warm.
    const warmup = () => soundService.warmup();
    document.addEventListener('touchstart', warmup, { passive: true });
    document.addEventListener('click', warmup);
    // Also re-warm when app returns to foreground (iOS 14.5+ allows resume from visibilitychange)
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#161b22',
              color: '#e6edf3',
              border: '1px solid #30363d',
              borderRadius: '12px',
            },
            success: { iconTheme: { primary: '#00ff88', secondary: '#0d1117' } },
            error: { iconTheme: { primary: '#ff3b5c', secondary: '#0d1117' } },
          }}
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}
