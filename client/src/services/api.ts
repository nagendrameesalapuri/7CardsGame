import axios from 'axios';

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? '';

const api = axios.create({
  baseURL: `${BACKEND}/api`,
  withCredentials: true,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('guestToken');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// ── Admin API (uses separate admin token) ────────────────────────────────────

const adminApi = axios.create({
  baseURL: `${BACKEND}/api/admin`,
  withCredentials: true,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  googleLogin: () => { window.location.href = `${BACKEND}/api/auth/google`; },
  guestLogin: (username: string) =>
    api.post<{ token: string; guestToken: string; user: any }>('/auth/guest', { username }),
  getMe: () => api.get<{ user: any }>('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const roomsApi = {
  list: () => api.get<{ rooms: any[]; spectatorModeEnabled: boolean }>('/rooms'),
  get: (code: string) => api.get<{ room: any }>(`/rooms/${code}`),
};

export const usersApi = {
  leaderboard: () => api.get<{ leaderboard: any[] }>('/users/leaderboard'),
  profile: (id: string) => api.get<{ user: any; recentGames: any[] }>(`/users/${id}/profile`),
  updateMe: (data: { username?: string; avatar?: string }) => api.patch('/users/me', data),
};

export const gamesApi = {
  history: () => api.get<{ games: any[] }>('/games/history'),
};

export const configApi = {
  getPublic: () => api.get<{ featureFlags: any; gameConfig: any }>('/admin/config/public'),
};

export const walletApi = {
  get:           () => api.get<{ balance: number; isGuest: boolean; transactions: any[]; withdrawalRequests: any[] }>('/wallet'),
  createOrder:   (amount: number) => api.post<{ orderId: string; amount: number; currency: string; keyId: string }>('/wallet/deposit/order', { amount }),
  verifyDeposit: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; amount: number }) =>
    api.post<{ balance: number; message: string }>('/wallet/deposit/verify', data),
  withdraw:      (data: { amount: number; upiId?: string; bankDetails?: { accountNumber: string; ifsc: string; accountName: string } }) =>
    api.post<{ balance: number; message: string }>('/wallet/withdraw', data),
  devAdd:        (amount: number) => api.post<{ balance: number; message: string }>('/wallet/dev/add', { amount }),
};

export const admin = {
  getWithdrawals: () => adminApi.get<{ withdrawals: any[] }>('/withdrawals'),
  processWithdrawal: (id: string, status: 'approved' | 'rejected', adminNote?: string) =>
    adminApi.patch(`/withdrawals/${id}`, { status, adminNote }),
  getWallets: () => adminApi.get<{ wallets: any[] }>('/wallets'),
  creditWallet: (userId: string, amount: number, note?: string) =>
    adminApi.post<{ balance: number; username: string }>(`/wallets/${userId}/credit`, { amount, note }),

  // existing admin methods below

  login: (password: string) =>
    adminApi.post<{ token: string }>('/login', { password }),

  getConfig: () => adminApi.get<any>('/config'),
  updateConfig: (data: any) => adminApi.patch('/config', data),

  getStats: () => adminApi.get<any>('/stats'),

  getRooms: () => adminApi.get<{ rooms: any[] }>('/rooms'),
  endRoom: (code: string) => adminApi.delete(`/rooms/${code}`),
  kickFromRoom: (code: string, userId: string) =>
    adminApi.post(`/rooms/${code}/kick/${userId}`),

  getUsers: (params?: { page?: number; search?: string }) =>
    adminApi.get<{ users: any[]; total: number; page: number; pages: number }>('/users', { params }),
  banUser: (id: string) => adminApi.post(`/users/${id}/ban`),
  unbanUser: (id: string) => adminApi.post(`/users/${id}/unban`),
  kickUser: (id: string) => adminApi.post(`/users/${id}/kick`),
  resetUserStats: (id: string) => adminApi.post(`/users/${id}/reset-stats`),

  getLeaderboard: () => adminApi.get<{ leaderboard: any[] }>('/leaderboard'),
  resetLeaderboard: () => adminApi.post('/leaderboard/reset'),
};

export default api;
