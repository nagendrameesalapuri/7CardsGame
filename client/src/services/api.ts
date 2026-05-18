import axios from "axios";

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

const api = axios.create({
  baseURL: `${BACKEND}/api`,
  withCredentials: true,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("guestToken");
      window.location.href = "/";
    }
    return Promise.reject(err);
  },
);

// ── Admin API (uses separate admin token) ────────────────────────────────────

const adminApi = axios.create({
  baseURL: `${BACKEND}/api/admin`,
  withCredentials: true,
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only redirect on 401 for non-login endpoints (login itself returns 401 on wrong password)
    if (err.response?.status === 401 && !err.config?.url?.includes("/login")) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  },
);

export const authApi = {
  googleLogin: () => {
    window.location.href = `${BACKEND}/api/auth/google`;
  },
  guestLogin: (username: string) =>
    api.post<{ token: string; guestToken: string; user: any }>("/auth/guest", {
      username,
    }),
  getMe: () => api.get<{ user: any }>("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

export const roomsApi = {
  list: () =>
    api.get<{ rooms: any[]; spectatorModeEnabled: boolean }>("/rooms"),
  get: (code: string) => api.get<{ room: any }>(`/rooms/${code}`),
};

export const usersApi = {
  leaderboard: () => api.get<{ leaderboard: any[] }>("/users/leaderboard"),
  profile: (id: string) =>
    api.get<{ user: any; recentGames: any[] }>(`/users/${id}/profile`),
  updateMe: (data: { username?: string; avatar?: string; selectedBadgeId?: string | null }) =>
    api.patch("/users/me", data),
  search: (q: string) =>
    api.get<{ users: Array<{ id: string; username: string; avatar: string }> }>(
      `/users/search?q=${encodeURIComponent(q)}&limit=30`
    ),
};

export const gamesApi = {
  history: () => api.get<{ games: any[] }>("/games/history"),
};

export type NotificationCategory =
  | 'tournament' | 'boss_arena' | 'rewards' | 'daily_missions'
  | 'multiplayer' | 'survival_streak' | 'events' | 'system';

export interface AppNotificationRecord {
  _id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  type: 'info' | 'warning' | 'success';
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  tournament: boolean;
  boss_arena: boolean;
  rewards: boolean;
  daily_missions: boolean;
  survival_streak: boolean;
  multiplayer: boolean;
  events: boolean;
  system: boolean;
}

export const notificationsApi = {
  list: (page = 1) =>
    api.get<{ notifications: AppNotificationRecord[]; total: number; unread: number; pages: number }>(
      `/notifications?page=${page}`
    ),
  markAllRead: () => api.patch('/notifications/read', {}),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`, {}),
  clear:       () => api.delete('/notifications'),
  getPrefs:    () => api.get<{ preferences: NotificationPrefs }>('/notifications/preferences'),
  savePrefs:   (prefs: Partial<NotificationPrefs>) => api.patch('/notifications/preferences', prefs),
};

export const configApi = {
  getPublic: () =>
    api.get<{ featureFlags: any; gameConfig: any; walletConfig: any; survivalConfig: any }>(
      "/admin/config/public",
    ),
};

export const supportApi = {
  submit: (data: { category: string; subject: string; message: string }) =>
    api.post<{ ticket: any }>("/support", data),
  mine: () => api.get<{ tickets: any[] }>("/support/mine"),
};

export const walletApi = {
  get: () =>
    api.get<{
      balance: number;
      isGuest: boolean;
      lockedRewards: number;
      transactions: any[];
      withdrawalRequests: any[];
      depositRequests: any[];
    }>("/wallet"),
  requestDeposit: (amount: number, utrNumber: string) =>
    api.post<{ message: string }>("/wallet/deposit/request", {
      amount,
      utrNumber,
    }),
  voucherExtract: (imageBase64: string, brand: string) =>
    api.post<{ voucherNumber: string; voucherPin: string; voucherExpiry: string }>('/wallet/voucher/extract', { imageBase64, brand }),
  voucherSubmit: (data: {
    voucherBrand: string;
    voucherNumber: string;
    voucherPin: string;
    voucherExpiry: string;
    amount: number;
    screenshotUrl?: string;
  }) => api.post<{ message: string }>("/wallet/voucher/submit", data),
  redeem: (data: { amount: number; voucherBrand: string }) =>
    api.post<{ balance: number; message: string }>("/wallet/redeem", data),
  withdraw: (data: {
    amount: number;
    upiId?: string;
    bankDetails?: { accountNumber: string; ifsc: string; accountName: string };
  }) =>
    api.post<{ balance: number; message: string }>("/wallet/withdraw", data),
  devAdd: (amount: number) =>
    api.post<{ balance: number; message: string }>("/wallet/dev/add", {
      amount,
    }),
};

export const admin = {
  getDeposits: () => adminApi.get<{ deposits: any[] }>("/deposits"),
  processDeposit: (
    id: string,
    status: "approved" | "rejected",
    adminNote?: string,
  ) => adminApi.patch(`/deposits/${id}`, { status, adminNote }),
  getWithdrawals: () => adminApi.get<{ withdrawals: any[] }>("/withdrawals"),
  processWithdrawal: (
    id: string,
    status: "approved" | "rejected",
    adminNote?: string,
  ) => adminApi.patch(`/withdrawals/${id}`, { status, adminNote }),
  deliverVoucher: (
    id: string,
    data: {
      deliveredVoucherNumber: string;
      deliveredVoucherPin: string;
      deliveredVoucherExpiry: string;
      adminMessage?: string;
    },
  ) => adminApi.patch(`/withdrawals/${id}/deliver`, data),
  getWallets: () => adminApi.get<{ wallets: any[] }>("/wallets"),
  getAdminCredits: () => adminApi.get<{ credits: any[] }>("/wallets/credits"),
  creditWallet: (userId: string, amount: number, note?: string) =>
    adminApi.post<{ balance: number; username: string }>(
      `/wallets/${userId}/credit`,
      { amount, note },
    ),
  debitWallet: (userId: string, amount: number, note?: string) =>
    adminApi.post<{ balance: number; username: string }>(
      `/wallets/${userId}/debit`,
      { amount, note },
    ),

  // existing admin methods below

  login: (password: string) =>
    adminApi.post<{ token: string }>("/login", { password }),

  getConfig: () => adminApi.get<any>("/config"),
  updateConfig: (data: any) => adminApi.patch("/config", data),

  getStats: () => adminApi.get<any>("/stats"),

  getRooms: () => adminApi.get<{ rooms: any[] }>("/rooms"),
  endRoom: (code: string) => adminApi.delete(`/rooms/${code}`),
  kickFromRoom: (code: string, userId: string) =>
    adminApi.post(`/rooms/${code}/kick/${userId}`),

  getSurvivalChampionship: (params?: { page?: number; tier?: string }) =>
    adminApi.get<{
      records: any[];
      total: number;
      page: number;
      pages: number;
      summary: any;
    }>("/tournaments", { params }),

  getUsers: (params?: { page?: number; search?: string }) =>
    adminApi.get<{ users: any[]; total: number; page: number; pages: number }>(
      "/users",
      { params },
    ),
  banUser: (id: string) => adminApi.post(`/users/${id}/ban`),
  unbanUser: (id: string) => adminApi.post(`/users/${id}/unban`),
  kickUser: (id: string) => adminApi.post(`/users/${id}/kick`),
  resetUserStats: (id: string) => adminApi.post(`/users/${id}/reset-stats`),
  deleteUser: (id: string) => adminApi.delete(`/users/${id}`),
  deleteAllGuests: () => adminApi.delete<{ deleted: number }>("/users/guests"),

  getLeaderboard: () => adminApi.get<{ leaderboard: any[] }>("/leaderboard"),
  resetLeaderboard: () => adminApi.post("/leaderboard/reset"),
  getProgressionLeaderboard: (category: 'xp' | 'achievements') =>
    adminApi.get<{ leaderboard: any[]; category: string }>(`/progression/leaderboard?category=${category}`),

  getSupport: (status?: string) =>
    adminApi.get<{ tickets: any[]; summary: any }>("/support", {
      params: { status },
    }),
  updateSupport: (
    id: string,
    data: { status?: string; adminNote?: string; adminReply?: string },
  ) => adminApi.patch(`/support/${id}`, data),

  sendNotification: (title: string, message: string, type: "info" | "warning" | "success") =>
    adminApi.post<{ success: boolean; recipients: number }>("/notify", { title, message, type }),

  sendPushNotification: (opts: {
    title: string;
    message: string;
    category?: string;
    type?: "info" | "warning" | "success";
    actionUrl?: string;
    global?: boolean;
    userIds?: string[];
    inactiveHours?: number;
  }) => adminApi.post<{ ok: boolean; mode: string; count?: number }>("/push/send", opts),

  getPushUsers: () => adminApi.get<{ users: Record<string, { deviceCount: number; lastActiveAt: string; devices: string[] }>; total: number }>("/push/users"),
  getPushHealth: () => adminApi.get<{ envVarsSet: boolean; projectId: string | null; tokenCount: number; hint: string }>("/push/health"),
  getPushBroadcasts: (page = 1) => adminApi.get<{
    broadcasts: Array<{
      _id: string;
      title: string;
      message: string;
      category: string;
      type: string;
      targetType: 'global' | 'targeted' | 'inactive';
      intendedCount: number;
      deliveredCount: number;
      readCount: number;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pages: number;
  }>(`/push/broadcasts?page=${page}`),

  getAnalytics: () => adminApi.get<any>("/analytics"),
  resetAnalytics: () => adminApi.post("/analytics/reset"),

  getAnnouncements: () => adminApi.get<{ announcements: any[] }>("/announcements"),
  createAnnouncement: (data: { message: string; type: string; expiresAt?: string }) =>
    adminApi.post<{ announcement: any }>("/announcements", data),
  updateAnnouncement: (id: string, data: { active?: boolean; message?: string; type?: string }) =>
    adminApi.patch<{ announcement: any }>(`/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => adminApi.delete(`/announcements/${id}`),
};

export const announcementsApi = {
  getActive: () => api.get<{ announcements: any[] }>("/announcements"),
};

export const progressionApi = {
  get:       () => api.get<{ progress: any }>('/progression'),
  daily:     () => api.post<{ reward: any; newDay: number; loginStreak: number; leveled: boolean; rankedUp: boolean; newLevel: number; newRank: string; newAchievements: any[]; progress: any }>('/progression/daily'),
  luckySpin: () => api.post<{ outcome: any; progress: any }>('/progression/lucky-spin'),
  leaderboard: (category: 'xp' | 'streak' | 'survival') =>
    api.get<{ leaderboard: any[]; category: string }>(`/progression/leaderboard?category=${category}`),
  achievements: () => api.get<{ achievements: any[] }>('/progression/achievements'),
};

export const survivalApi = {
  history: (page = 1) => api.get<{ records: any[]; total: number; page: number; pages: number }>(`/survival/history?page=${page}`),
  status:  () => api.get<{ survival: any }>('/survival/status'),
  stats:   () => api.get<{
    runsPlayed: number; runsWon: number; runsLost: number; runsAbandoned: number;
    stagesPlayed: number; stagesWon: number; stageWinRate: number;
    runWinRate: number; bestStage: number;
    totalEarned: number; totalSpent: number; netPoints: number;
  }>('/survival/stats'),
  active:  () => api.get<{ battles: any[] }>('/survival/active'),
};

export default api;
