import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuthStore } from './store/authStore';
import { soundService } from './services/sound';

import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

// Handle Google OAuth callback token
function AuthCallback() {
  const { setToken } = useAuthStore();
  const navigate = React.useRef(window.location.href);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token) {
      setToken(token);
      window.history.replaceState({}, '', '/lobby');
    }
    window.location.href = '/lobby';
  }, [setToken]);

  return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-dark-muted animate-pulse">Signing in...</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { loadMe, token } = useAuthStore();

  useEffect(() => {
    if (token) loadMe();
    // Preload common sounds
    soundService.preload(['card_deal', 'card_draw', 'card_discard', 'power_seven', 'power_jack', 'show_call', 'win', 'lose', 'chat']);
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
