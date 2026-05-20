/**
 * Direct HTTP API client for test setup/teardown.
 * Used for seeding data and verifying state without going through the UI.
 */
import { APIRequestContext, request } from '@playwright/test';
import { ENV } from '../config/env';

export interface GuestAuthResult {
  token: string;
  guestToken: string;
  user: { id: string; username: string; walletBalance: number; isGuest: boolean };
}

export interface WalletResult {
  balance: number;
  message: string;
}

export interface WalletState {
  balance: number;
  isGuest: boolean;
  transactions: Transaction[];
  lockedRewards: number;
}

export interface Transaction {
  _id: string;
  type: 'deposit' | 'withdrawal' | 'entry_fee' | 'prize' | 'refund' | 'dev_add';
  amount: number;
  status: string;
  description: string;
  createdAt: string;
}

export interface SurvivalStatus {
  survivalId: string;
  tier: string;
  tierLabel: string;
  currentStage: number;
  totalStages: number;
  status: string;
  entryPoints: number;
  currentRoomCode: string | null;
}

/**
 * Create a standalone API context (independent of any browser page).
 * Caller must call `.dispose()` when done.
 */
export async function createApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: ENV.API_URL });
}

export class ApiClient {
  constructor(
    private ctx: APIRequestContext,
    private token: string | null = null,
  ) {}

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  setToken(token: string) { this.token = token; }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async guestLogin(username: string): Promise<GuestAuthResult> {
    const res = await this.ctx.post('/api/auth/guest', {
      data: { username },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok()) throw new Error(`Guest login failed: ${await res.text()}`);
    const body = await res.json();
    this.token = body.token;
    return body as GuestAuthResult;
  }

  async getMe() {
    const res = await this.ctx.get('/api/users/me', { headers: this.headers() });
    if (!res.ok()) throw new Error(`getMe failed: ${await res.text()}`);
    return res.json();
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async devAddBalance(amount = 500): Promise<WalletResult> {
    const res = await this.ctx.post('/api/wallet/dev/add', {
      data: { amount },
      headers: { ...this.headers(), 'Content-Type': 'application/json' } as Record<string, string>,
    });
    if (!res.ok()) throw new Error(`devAddBalance failed: ${await res.text()}`);
    return res.json();
  }

  async getWallet(): Promise<WalletState> {
    const res = await this.ctx.get('/api/wallet', { headers: this.headers() });
    if (!res.ok()) throw new Error(`getWallet failed: ${await res.text()}`);
    return res.json();
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  async getRooms() {
    const res = await this.ctx.get('/api/rooms', { headers: this.headers() });
    if (!res.ok()) throw new Error(`getRooms failed: ${await res.text()}`);
    return res.json();
  }

  // ── Survival ──────────────────────────────────────────────────────────────

  async getSurvivalStatus(): Promise<{ survival: SurvivalStatus | null }> {
    const res = await this.ctx.get('/api/survival/status', { headers: this.headers() });
    if (!res.ok()) throw new Error(`getSurvivalStatus failed: ${await res.text()}`);
    return res.json();
  }

  async getSurvivalHistory() {
    const res = await this.ctx.get('/api/survival/history', { headers: this.headers() });
    if (!res.ok()) throw new Error(`getSurvivalHistory failed: ${await res.text()}`);
    return res.json();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const res = await this.ctx.get(`/api/users/${userId}`, { headers: this.headers() });
    if (!res.ok()) throw new Error(`getProfile failed: ${await res.text()}`);
    return res.json();
  }
}
