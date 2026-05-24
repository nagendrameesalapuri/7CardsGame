/**
 * Hold System Test Utilities
 * Helpers for the Match Protection & Entry Hold architecture.
 */
import { Page, APIRequestContext, expect } from '@playwright/test';
import { ApiClient, createApiContext } from './api';
import { ENV } from '../config/env';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HoldTransactionType =
  | 'entry_hold'
  | 'entry_released'
  | 'entry_locked'
  | 'match_settlement'
  | 'abandoned_resolution'
  | 'system_rollback';

export type LegacyTransactionType =
  | 'deposit' | 'withdrawal' | 'entry_fee' | 'refund' | 'bonus' | 'winning';

export type TransactionType = HoldTransactionType | LegacyTransactionType;

export interface HoldWalletState {
  balance: number;           // total (walletBalance in DB)
  heldBalance: number;       // reserved for active entries
  availableBalance: number;  // balance - heldBalance
  isGuest: boolean;
  transactions: HoldTransaction[];
}

export interface HoldTransaction {
  _id: string;
  type: TransactionType;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  heldBefore: number;
  heldAfter: number;
  metadata: {
    roomCode?: string;
    matchState?: string;
    releaseReason?: string;
    exploitFlag?: boolean;
    survivalTournamentId?: string;
    teamId?: string;
  };
  createdAt: string;
}

export interface WalletReconciliation {
  totalBalance: number;
  heldBalance: number;
  availableBalance: number;
  // Computed
  computedAvailable: number;   // totalBalance - heldBalance
  isBalanced: boolean;         // computedAvailable === availableBalance
  discrepancy: number;
}

// ── API client extension for hold system ─────────────────────────────────────

export class HoldApiClient extends ApiClient {
  constructor(ctx: APIRequestContext, token: string | null = null) {
    super(ctx, token);
  }

  async getHoldWallet(): Promise<HoldWalletState> {
    const res = await (this as any).ctx.get('/api/wallet', {
      headers: (this as any).headers(),
    });
    if (!res.ok()) throw new Error(`getHoldWallet failed: ${await res.text()}`);
    return res.json();
  }

  async getAdminHoldOverview(adminToken: string) {
    const res = await (this as any).ctx.get('/api/admin/hold-system/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok()) throw new Error(`getAdminHoldOverview failed: ${await res.text()}`);
    return res.json();
  }

  async getAdminExploitStats(userId: string, adminToken: string) {
    const res = await (this as any).ctx.get(`/api/admin/hold-system/exploit/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok()) throw new Error(`getAdminExploitStats failed: ${await res.text()}`);
    return res.json();
  }
}

// ── Hold wallet reader from page ──────────────────────────────────────────────

export async function getHoldWalletState(page: Page): Promise<HoldWalletState> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('No auth token — user must be logged in');

  const ctx = await createApiContext();
  try {
    const client = new HoldApiClient(ctx, token);
    return client.getHoldWallet();
  } finally {
    await ctx.dispose();
  }
}

// ── Wallet math validation ────────────────────────────────────────────────────

export function reconcileWallet(state: HoldWalletState): WalletReconciliation {
  const computedAvailable = state.balance - state.heldBalance;
  const discrepancy = Math.abs(computedAvailable - state.availableBalance);
  return {
    totalBalance: state.balance,
    heldBalance: state.heldBalance,
    availableBalance: state.availableBalance,
    computedAvailable,
    isBalanced: discrepancy < 0.01,
    discrepancy,
  };
}

export function assertWalletEquation(state: HoldWalletState): void {
  const r = reconcileWallet(state);
  if (!r.isBalanced) {
    throw new Error(
      `Wallet equation VIOLATED: total(${r.totalBalance}) - held(${r.heldBalance}) ≠ available(${r.availableBalance}) [computed=${r.computedAvailable}]`,
    );
  }
  if (state.availableBalance < 0) {
    throw new Error(`NEGATIVE available balance: ${state.availableBalance}`);
  }
  if (state.heldBalance < 0) {
    throw new Error(`NEGATIVE held balance: ${state.heldBalance}`);
  }
  if (state.balance < 0) {
    throw new Error(`NEGATIVE total balance: ${state.balance}`);
  }
}

// ── Transaction finders ───────────────────────────────────────────────────────

export function findTransactionsByType(
  txns: HoldTransaction[],
  type: TransactionType,
): HoldTransaction[] {
  return txns.filter(t => t.type === type);
}

export function findLatestTransaction(
  txns: HoldTransaction[],
  type: TransactionType,
): HoldTransaction | undefined {
  return txns
    .filter(t => t.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export function countTransactionsByType(
  txns: HoldTransaction[],
  type: TransactionType,
): number {
  return txns.filter(t => t.type === type).length;
}

// ── Assertions ────────────────────────────────────────────────────────────────

/**
 * Assert that the wallet contains no hold transactions for a room
 * (before the game has started, indicates clean state).
 */
export function assertNoActiveHoldForRoom(
  txns: HoldTransaction[],
  roomCode: string,
): void {
  const holds = txns.filter(
    t => t.type === 'entry_hold'
      && t.metadata?.roomCode === roomCode
      && t.status === 'completed',
  );
  const releases = txns.filter(
    t => t.type === 'entry_released'
      && t.metadata?.roomCode === roomCode,
  );
  const locks = txns.filter(
    t => t.type === 'entry_locked'
      && t.metadata?.roomCode === roomCode,
  );

  // If hold was placed, it must be followed by either a release or a lock
  if (holds.length > 0 && releases.length === 0 && locks.length === 0) {
    throw new Error(
      `Room ${roomCode} has ${holds.length} unclosed hold(s) with no release/lock`,
    );
  }
}

/**
 * Assert transaction balance fields are self-consistent.
 */
export function assertTransactionIntegrity(tx: HoldTransaction): void {
  // For credit types, balanceAfter should be >= balanceBefore
  const creditTypes: TransactionType[] = [
    'deposit', 'winning', 'refund', 'bonus',
    'match_settlement', 'abandoned_resolution',
  ];
  const debitTypes: TransactionType[] = [
    'withdrawal', 'entry_fee', 'entry_locked',
  ];
  const neutralTypes: TransactionType[] = ['entry_hold', 'entry_released'];

  if (creditTypes.includes(tx.type) && tx.status === 'completed') {
    if (tx.balanceAfter < tx.balanceBefore) {
      throw new Error(
        `Credit transaction ${tx._id} (${tx.type}) has balanceAfter(${tx.balanceAfter}) < balanceBefore(${tx.balanceBefore})`,
      );
    }
  }
  if (debitTypes.includes(tx.type) && tx.status === 'completed') {
    if (tx.balanceAfter > tx.balanceBefore) {
      throw new Error(
        `Debit transaction ${tx._id} (${tx.type}) has balanceAfter(${tx.balanceAfter}) > balanceBefore(${tx.balanceBefore})`,
      );
    }
  }
  if (neutralTypes.includes(tx.type) && tx.status === 'completed') {
    if (tx.balanceBefore !== tx.balanceAfter) {
      throw new Error(
        `Neutral transaction ${tx._id} (${tx.type}) changed wallet balance: ${tx.balanceBefore} → ${tx.balanceAfter}`,
      );
    }
  }
}

// ── Admin token helper ────────────────────────────────────────────────────────

export async function getAdminToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('adminToken'));
  if (!token) throw new Error('No admin token — admin must be logged in first');
  return token;
}

// ── Poll utility ──────────────────────────────────────────────────────────────

/**
 * Poll a condition until it becomes true or times out.
 * Returns the last value.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  condition: (val: T) => boolean,
  opts: { intervalMs?: number; timeoutMs?: number; label?: string } = {},
): Promise<T> {
  const { intervalMs = 1000, timeoutMs = 15_000, label = 'condition' } = opts;
  const deadline = Date.now() + timeoutMs;
  let lastValue: T | undefined;

  while (Date.now() < deadline) {
    lastValue = await fn();
    if (condition(lastValue)) return lastValue;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  throw new Error(
    `pollUntil timed out after ${timeoutMs}ms waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`,
  );
}
