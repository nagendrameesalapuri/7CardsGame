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

export const authApi = {
  googleLogin: () => { window.location.href = `${BACKEND}/api/auth/google`; },
  guestLogin: (username: string) =>
    api.post<{ token: string; guestToken: string; user: any }>('/auth/guest', { username }),
  getMe: () => api.get<{ user: any }>('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const roomsApi = {
  list: () => api.get<{ rooms: any[] }>('/rooms'),
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

export default api;
