import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuthStore } from './store/authStore';
import { soundService } from './services/sound';
import { useNotificationStore } from './store/notificationStore';
import { initFCM, getPermissionState, pingFCMToken, requestPermission, isConfigured } from './services/fcm';

import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { WalletPage } from './pages/WalletPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { SpectatorPage } from './pages/SpectatorPage';
import { SurvivalTournamentPage } from './pages/SurvivalTournamentPage';
import { ProgressionPage } from './pages/ProgressionPage';
import { NotificationsPage } from './pages/NotificationsPage';

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function isIOS() {
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}
function isInstalledPWA() {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// ── Notification permission / install prompt ──────────────────────────────────
function NotificationPrompt({ onDone }: { onDone: () => void }) {
  const [hiding, setHiding] = useState(false);
  const ios          = isIOS();
  const installedPWA = isInstalledPWA();
  const denied       = getPermissionState() === 'denied';
  // On iOS, push only works from an installed PWA (Add to Home Screen)
  const needsInstall = ios && !installedPWA && !denied;

  const dismiss = () => {
    setHiding(true);
    setTimeout(onDone, 300);
  };

  const allow = async () => {
    // requestPermission MUST be called directly from a tap handler on iOS
    const result = await requestPermission();
    setHiding(true);
    setTimeout(onDone, 300);
    return result;
  };

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: hiding ? 'translateX(-50%) translateY(120%)' : 'translateX(-50%) translateY(0)',
    transition: 'transform 0.3s ease',
    zIndex: 9999,
    width: 'min(92vw, 420px)',
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    border: `1px solid ${needsInstall ? 'rgba(251,191,36,0.4)' : 'rgba(99,102,241,0.35)'}`,
    borderRadius: 16,
    padding: '16px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  };

  if (denied) {
    // Browser has blocked notifications — guide user to unblock in settings
    return (
      <div style={{ ...bannerStyle, borderColor: 'rgba(251,191,36,0.4)' }}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🔕</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            Notifications are blocked
          </p>
          <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            You've blocked notifications for this site. To enable them:
          </p>
          <ol style={{ margin: '0 0 12px 0', paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
            <li>Click the <strong style={{ color: '#60a5fa' }}>🔒 lock icon</strong> in your browser's address bar</li>
            <li>Find <strong style={{ color: '#60a5fa' }}>Notifications</strong> and set it to <strong style={{ color: '#60a5fa' }}>Allow</strong></li>
            <li>Refresh the page</li>
          </ol>
          <button
            onClick={dismiss}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
              color: '#64748b', fontSize: 13, cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  if (needsInstall) {
    // iOS not installed — show step-by-step install guide
    return (
      <div style={bannerStyle}>
        <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>📲</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
            Add to Home Screen for Notifications
          </p>
          <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            iOS requires the app to be installed before push notifications can be enabled.
          </p>
          <ol style={{ margin: '0 0 12px 0', paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
            <li>Tap the <strong style={{ color: '#60a5fa' }}>Share</strong> button in Safari</li>
            <li>Tap <strong style={{ color: '#60a5fa' }}>Add to Home Screen</strong></li>
            <li>Open the app from your Home Screen</li>
          </ol>
          <button
            onClick={dismiss}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#64748b',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={bannerStyle}>
      <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
          Stay ahead of the game
        </p>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          Get alerts for tournament results, win streaks, rewards, and multiplayer invites — even when the app is closed.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={allow}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Allow Notifications
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: '#64748b',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FCM initialiser + permission prompt ───────────────────────────────────────
function FCMInit() {
  const { isAuthenticated, user } = useAuthStore();
  const { addNotification, loadHistory, loadPrefs, setPermissionState } = useNotificationStore();
  const [showPrompt, setShowPrompt] = useState(false);

  const startFCM = React.useCallback(() => {
    initFCM((payload) => {
      addNotification({
        id: `fcm-${Date.now()}`,
        title: payload.title,
        message: payload.message,
        type: 'info',
        category: payload.category,
        actionUrl: payload.actionUrl,
        sentAt: new Date().toISOString(),
      });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show prompt on page load regardless of auth — permission can be requested any time
  useEffect(() => {
    const state = getPermissionState();
    if (state === 'granted' || state === 'unsupported') return;
    // Show for both 'default' (not asked yet) and 'denied' (need to guide user)
    const t = setTimeout(() => setShowPrompt(true), 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once authenticated, load notification data and init FCM if already granted
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    loadHistory();
    loadPrefs();

    const state = getPermissionState();
    setPermissionState(state);
    pingFCMToken().catch(() => {});

    if (state === 'granted') startFCM();
  }, [isAuthenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptDone = () => {
    setShowPrompt(false);
    const state = getPermissionState();
    setPermissionState(state);
    if (state === 'granted') startFCM();
  };

  return showPrompt ? <NotificationPrompt onDone={handlePromptDone} /> : null;
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
        <FCMInit />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/spectate/:code" element={<ProtectedRoute><SpectatorPage /></ProtectedRoute>} />
          <Route path="/survival" element={<ProtectedRoute><SurvivalTournamentPage /></ProtectedRoute>} />
          <Route path="/progression" element={<ProtectedRoute><ProgressionPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster position="top-center" containerStyle={{ zIndex: 9999 }} toastOptions={{ style: { background: 'transparent', boxShadow: 'none', padding: 0 } }} />
      </BrowserRouter>
    </ThemeProvider>
  );
}
