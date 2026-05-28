import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authApi } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  guestToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  comebackBonus: number;

  guestLogin: (username: string) => Promise<void>;
  googleLogin: () => void;
  loadMe: () => Promise<void>;
  logout: () => void;
  setToken: (token: string, guestToken?: string) => void;
  clearComebackBonus: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      guestToken: null,
      isLoading: !!localStorage.getItem('token'),
      isAuthenticated: false,
      comebackBonus: 0,

      setToken: (token, guestToken) => {
        localStorage.setItem('token', token);
        if (guestToken) localStorage.setItem('guestToken', guestToken);
        set({ token, guestToken: guestToken ?? null });
        connectSocket(token, guestToken);
      },

      guestLogin: async (username) => {
        set({ isLoading: true });
        try {
          const res = await authApi.guestLogin(username);
          const { token, guestToken, user } = res.data;
          localStorage.setItem('token', token);
          localStorage.setItem('guestToken', guestToken);
          connectSocket(token, guestToken);
          set({ token, guestToken, user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          set({ isLoading: false });
          if (err.response?.status === 429) {
            throw new Error('Too many attempts — please wait a few minutes and try again.');
          }
          throw new Error(err.response?.data?.error ?? 'Login failed. Please try again.');
        }
      },

      googleLogin: () => authApi.googleLogin(),

      loadMe: async () => {
        const { token } = get();
        if (!token) return;
        set({ isLoading: true });
        try {
          const res = await authApi.getMe();
          const me = res.data.user;
          const bonus = (res.data as any).comebackBonus ?? 0;
          if (me.isAdmin) {
            localStorage.setItem('adminToken', token);
          } else {
            localStorage.removeItem('adminToken');
          }
          set({ user: me, isAuthenticated: true, isLoading: false, comebackBonus: bonus });
          connectSocket(token, get().guestToken ?? undefined);
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false, token: null });
          localStorage.removeItem('token');
          localStorage.removeItem('guestToken');
        }
      },

      clearComebackBonus: () => set({ comebackBonus: 0 }),

      logout: () => {
        authApi.logout().catch(() => {});
        disconnectSocket();
        localStorage.removeItem('token');
        localStorage.removeItem('guestToken');
        set({ user: null, token: null, guestToken: null, isAuthenticated: false, comebackBonus: 0 });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ token: state.token, guestToken: state.guestToken }),
    }
  )
);
