import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { notificationsApi, type AppNotificationRecord, type NotificationPrefs } from '../services/api';

export type { AppNotificationRecord };

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  category?: string;
  actionUrl?: string;
  sentAt: string;
  read: boolean;
}

interface NotificationState {
  // In-memory (Socket.IO / real-time) notifications
  notifications: AppNotification[];
  unreadCount: number;

  // Persisted history from DB
  history: AppNotificationRecord[];
  historyUnread: number;
  historyLoaded: boolean;

  // Preferences
  prefs: NotificationPrefs | null;
  prefsLoaded: boolean;

  // Permission
  permissionState: NotificationPermission | 'unsupported' | null;

  // Actions
  addNotification: (n: Omit<AppNotification, 'read'>) => void;
  markAllRead: () => void;
  clearAll: () => void;

  // DB history
  loadHistory: () => Promise<void>;
  markHistoryRead: () => Promise<void>;
  clearHistory: () => Promise<void>;

  // Preferences
  loadPrefs: () => Promise<void>;
  savePrefs: (prefs: Partial<NotificationPrefs>) => Promise<void>;

  // Permission
  setPermissionState: (s: NotificationPermission | 'unsupported') => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications:    [],
      unreadCount:      0,
      history:          [],
      historyUnread:    0,
      historyLoaded:    false,
      prefs:            null,
      prefsLoaded:      false,
      permissionState:  null,

      addNotification: (n) =>
        set((s) => {
          if (s.notifications.some((x) => x.id === n.id)) return s;
          const updated = [{ ...n, read: false }, ...s.notifications].slice(0, 50);
          return { notifications: updated, unreadCount: s.unreadCount + 1 };
        }),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),

      // ── DB history ──────────────────────────────────────────────────────────
      loadHistory: async () => {
        try {
          const res = await notificationsApi.list();
          set({
            history:       res.data.notifications,
            historyUnread: res.data.unread,
            historyLoaded: true,
          });
        } catch { /* silent — user may not be logged in yet */ }
      },

      markHistoryRead: async () => {
        try {
          await notificationsApi.markAllRead();
          set((s) => ({
            history:      s.history.map((n) => ({ ...n, read: true })),
            historyUnread: 0,
          }));
        } catch { /* silent */ }
      },

      clearHistory: async () => {
        try {
          await notificationsApi.clear();
          set({ history: [], historyUnread: 0 });
        } catch { /* silent */ }
      },

      // ── Preferences ─────────────────────────────────────────────────────────
      loadPrefs: async () => {
        try {
          const res = await notificationsApi.getPrefs();
          set({ prefs: res.data.preferences, prefsLoaded: true });
        } catch { /* silent */ }
      },

      savePrefs: async (updates) => {
        try {
          const res = await notificationsApi.savePrefs(updates);
          set({ prefs: res.data.preferences });
        } catch { /* silent */ }
      },

      // ── Permission ──────────────────────────────────────────────────────────
      setPermissionState: (s) => set({ permissionState: s }),
    }),
    {
      name: 'arena-notifications',
      partialize: (s) => ({
        // Only persist lightweight fields; history and prefs come from the server
        notifications: s.notifications.slice(0, 20),
        unreadCount:   s.unreadCount,
        permissionState: s.permissionState,
      }),
    }
  )
);
