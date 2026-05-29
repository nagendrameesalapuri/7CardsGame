import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../services/socket', () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  authApi: {
    guestLogin: vi.fn(),
    googleLogin: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn().mockResolvedValue({}),
  },
}));

import { useAuthStore } from '../../store/authStore';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { authApi } from '../../services/api';

const resetState = {
  user: null,
  token: null,
  guestToken: null,
  isLoading: false,
  isAuthenticated: false,
  comebackBonus: 0,
};

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(resetState);
  });

  // ── guestLogin ──────────────────────────────────────────────────────────────

  describe('guestLogin', () => {
    it('sets user, token, and isAuthenticated on success', async () => {
      const mockUser = { id: '1', username: 'TestUser', avatar: 'avatar_1', isGuest: true };
      (authApi.guestLogin as any).mockResolvedValue({
        data: { token: 'jwt-abc', guestToken: 'guest-xyz', user: mockUser },
      });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.guestLogin('TestUser'); });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe('jwt-abc');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(localStorage.getItem('token')).toBe('jwt-abc');
      expect(connectSocket).toHaveBeenCalledWith('jwt-abc', 'guest-xyz');
    });

    it('throws rate-limit message on HTTP 429', async () => {
      (authApi.guestLogin as any).mockRejectedValue({
        response: { status: 429, data: { error: 'Too many requests' } },
      });

      const { result } = renderHook(() => useAuthStore());
      await expect(
        act(async () => { await result.current.guestLogin('Player'); })
      ).rejects.toThrow('Too many attempts');

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('throws server error message on other failures', async () => {
      (authApi.guestLogin as any).mockRejectedValue({
        response: { status: 400, data: { error: 'Username too short' } },
      });

      const { result } = renderHook(() => useAuthStore());
      await expect(
        act(async () => { await result.current.guestLogin('X'); })
      ).rejects.toThrow('Username too short');
    });

    it('throws generic message when no response body', async () => {
      (authApi.guestLogin as any).mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useAuthStore());
      await expect(
        act(async () => { await result.current.guestLogin('Player'); })
      ).rejects.toThrow('Login failed');
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('clears all auth state and localStorage', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'Test' } as any,
        token: 'old-token',
        guestToken: 'old-guest',
        isAuthenticated: true,
        comebackBonus: 100,
      });
      localStorage.setItem('token', 'old-token');
      localStorage.setItem('guestToken', 'old-guest');

      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.logout(); });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.comebackBonus).toBe(0);
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('guestToken')).toBeNull();
      expect(disconnectSocket).toHaveBeenCalled();
    });
  });

  // ── setToken ────────────────────────────────────────────────────────────────

  describe('setToken', () => {
    it('saves token to localStorage and connects socket', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.setToken('new-jwt', 'guest-id'); });

      expect(result.current.token).toBe('new-jwt');
      expect(localStorage.getItem('token')).toBe('new-jwt');
      expect(localStorage.getItem('guestToken')).toBe('guest-id');
      expect(connectSocket).toHaveBeenCalledWith('new-jwt', 'guest-id');
    });

    it('works without a guestToken argument', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.setToken('jwt-only'); });

      expect(result.current.token).toBe('jwt-only');
      expect(connectSocket).toHaveBeenCalledWith('jwt-only', undefined);
    });
  });

  // ── loadMe ──────────────────────────────────────────────────────────────────

  describe('loadMe', () => {
    it('sets user and isAuthenticated on success', async () => {
      const mockUser = { id: '1', username: 'Test', isAdmin: false };
      (authApi.getMe as any).mockResolvedValue({
        data: { user: mockUser, comebackBonus: 50 },
      });
      useAuthStore.setState({ token: 'valid-jwt' });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.loadMe(); });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.comebackBonus).toBe(50);
      expect(result.current.isLoading).toBe(false);
    });

    it('stores adminToken in localStorage for admin users', async () => {
      const adminUser = { id: '2', username: 'Admin', isAdmin: true };
      (authApi.getMe as any).mockResolvedValue({ data: { user: adminUser } });
      useAuthStore.setState({ token: 'admin-jwt' });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.loadMe(); });

      expect(localStorage.getItem('adminToken')).toBe('admin-jwt');
    });

    it('clears auth state on API failure', async () => {
      (authApi.getMe as any).mockRejectedValue(new Error('401 Unauthorized'));
      useAuthStore.setState({ token: 'bad-token' });
      localStorage.setItem('token', 'bad-token');

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.loadMe(); });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('does nothing when there is no token', async () => {
      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.loadMe(); });

      expect(authApi.getMe).not.toHaveBeenCalled();
    });
  });

  // ── clearComebackBonus ──────────────────────────────────────────────────────

  describe('clearComebackBonus', () => {
    it('resets comebackBonus to 0', () => {
      useAuthStore.setState({ comebackBonus: 75 });
      const { result } = renderHook(() => useAuthStore());
      act(() => { result.current.clearComebackBonus(); });
      expect(result.current.comebackBonus).toBe(0);
    });
  });
});
