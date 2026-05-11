import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
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

/** Maps toast type + message to visual config. */
function getToastConfig(type: string, message: string) {
  const isWarning = message.startsWith('⚠️') || message.startsWith('🚨');
  if (type === 'error') {
    return { iconBg: '#dc2626', bg: 'rgba(30,5,5,0.96)', border: '1px solid rgba(220,38,38,0.35)', icon: '✕' };
  }
  if (type === 'success') {
    return { iconBg: '#16a34a', bg: 'rgba(5,25,10,0.96)', border: '1px solid rgba(22,163,74,0.35)', icon: '✓' };
  }
  if (isWarning) {
    return { iconBg: '#d97706', bg: 'rgba(25,18,5,0.96)', border: '1px solid rgba(217,119,6,0.35)', icon: '!' };
  }
  return { iconBg: '#2563eb', bg: 'rgba(5,10,28,0.96)', border: '1px solid rgba(37,99,235,0.35)', icon: 'i' };
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

        <Toaster position="top-center" containerStyle={{ zIndex: 9999 }}>
          {(t) => {
            const rawMsg = typeof t.message === 'string' ? t.message : '';
            const cfg = getToastConfig(t.type, rawMsg);
            return (
              <ToastBar toast={t} style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                {({ message }) => (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: cfg.bg,
                      border: cfg.border,
                      borderRadius: '14px',
                      padding: '10px 14px 10px 10px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
                      backdropFilter: 'blur(14px)',
                      minWidth: '240px',
                      maxWidth: '340px',
                    }}
                  >
                    {/* Colored icon square */}
                    <div style={{
                      background: cfg.iconBg,
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 15,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Message */}
                    <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
                      {message}
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                    >
                      ×
                    </button>
                  </div>
                )}
              </ToastBar>
            );
          }}
        </Toaster>
      </BrowserRouter>
    </ThemeProvider>
  );
}
