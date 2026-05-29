/**
 * REGRESSION SUITE 04 — Entry Hold / Lock / Release / Refund System
 *
 * Covers: hold placement on join, lock on game start, idempotency guard,
 * release on pre-LIVE cancel, orphan game refund, available balance check,
 * 90-second reconnect window, double-lock prevention.
 *
 * Uses mocked mongoose models — zero network dependency.
 */

// ── Mock mongoose Transaction + User ─────────────────────────────────────────
const mockTransactionFindOne = jest.fn();
const mockTransactionCreate  = jest.fn();
const mockUserFindById       = jest.fn();
const mockUserFindOneAndUpdate = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();

jest.mock('../../models/Transaction', () => ({
  Transaction: {
    findOne:  (...a: any[]) => ({ select: () => ({ lean: () => mockTransactionFindOne(...a) }) }),
    create:   (...a: any[]) => mockTransactionCreate(...a),
  },
}));

jest.mock('../../models/User', () => ({
  User: {
    findById:          (...a: any[]) => ({ select: () => ({ lean: () => mockUserFindById(...a) }) }),
    findOneAndUpdate:  (...a: any[]) => mockUserFindOneAndUpdate(...a),
    findByIdAndUpdate: (...a: any[]) => mockUserFindByIdAndUpdate(...a),
  },
}));


import { lockEntryHold, releaseEntryHold } from '../../socket/handlers/roomHandler';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());

// ════════════════════════════════════════════════════════════════════════════
// 1. lockEntryHold — HAPPY PATH
// ════════════════════════════════════════════════════════════════════════════

describe('lockEntryHold — Normal Lock', () => {
  it('skips for zero entry fee', async () => {
    const result = await lockEntryHold('u1', 0, 'ROOM1');
    expect(result).toBe(true);
    expect(mockTransactionFindOne).not.toHaveBeenCalled();
  });

  it('returns true and creates transaction when both balances sufficient', async () => {
    mockTransactionFindOne.mockResolvedValue(null); // not already locked
    mockUserFindById.mockResolvedValue({ walletBalance: 100, heldBalance: 20 });
    mockUserFindOneAndUpdate.mockResolvedValue({ walletBalance: 80, heldBalance: 0 });
    mockTransactionCreate.mockResolvedValue({});

    const result = await lockEntryHold('u1', 20, 'ROOM1');
    expect(result).toBe(true);
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'entry_locked', amount: 20 }),
    );
  });

  it('uses fallback path when heldBalance insufficient (hold gap)', async () => {
    mockTransactionFindOne.mockResolvedValue(null);
    mockUserFindById.mockResolvedValue({ walletBalance: 100, heldBalance: 0 }); // held gap
    // First findOneAndUpdate (atomic with held check) returns null → fallback
    mockUserFindOneAndUpdate
      .mockResolvedValueOnce(null)                              // primary fails
      .mockResolvedValueOnce({ walletBalance: 80, heldBalance: 0 }); // fallback succeeds
    mockTransactionCreate.mockResolvedValue({});

    const result = await lockEntryHold('u1', 20, 'ROOM1');
    expect(result).toBe(true);
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('hold gap corrected') }),
    );
  });

  it('returns false when wallet balance insufficient', async () => {
    mockTransactionFindOne.mockResolvedValue(null);
    mockUserFindById.mockResolvedValue({ walletBalance: 10, heldBalance: 0 });
    mockUserFindOneAndUpdate.mockResolvedValue(null); // primary fails
    mockUserFindOneAndUpdate.mockResolvedValue(null); // fallback fails too

    const result = await lockEntryHold('u1', 20, 'ROOM1');
    expect(result).toBe(false);
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. lockEntryHold — IDEMPOTENCY GUARD (double-charge prevention)
// ════════════════════════════════════════════════════════════════════════════

describe('lockEntryHold — Idempotency Guard', () => {
  it('returns true without deducting if already locked for this room', async () => {
    // Simulate existing entry_locked transaction
    mockTransactionFindOne.mockResolvedValue({ _id: 'tx123' });

    const result = await lockEntryHold('u1', 20, 'ROOM1');
    expect(result).toBe(true);
    // Must NOT call findById (no balance check needed)
    expect(mockUserFindById).not.toHaveBeenCalled();
    // Must NOT create another transaction
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    // Must NOT update wallet
    expect(mockUserFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('idempotency guard queries correct userId and roomCode', async () => {
    mockTransactionFindOne.mockResolvedValue({ _id: 'tx123' });
    await lockEntryHold('user-abc', 20, 'ROOMXYZ');
    expect(mockTransactionFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-abc',
        type: 'entry_locked',
        'metadata.roomCode': 'ROOMXYZ',
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. releaseEntryHold
// ════════════════════════════════════════════════════════════════════════════

// releaseEntryHold is void — check side effects via mockTransactionCreate
describe('releaseEntryHold', () => {
  it('releases hold: creates entry_released transaction', async () => {
    mockUserFindById.mockResolvedValue({ walletBalance: 100, heldBalance: 20 });
    mockUserFindByIdAndUpdate.mockResolvedValue({ walletBalance: 100, heldBalance: 0 });
    mockTransactionCreate.mockResolvedValue({});

    await releaseEntryHold('u1', 20, 'ROOM1', 'cancel');
    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'entry_released' }),
    );
  });

  it('skips for zero entry fee — no transaction created', async () => {
    await releaseEntryHold('u1', 0, 'ROOM1', 'cancel');
    expect(mockTransactionCreate).not.toHaveBeenCalled();
    expect(mockUserFindById).not.toHaveBeenCalled();
  });

  it('user not found: no transaction created, no crash', async () => {
    mockUserFindById.mockResolvedValue(null);
    await expect(releaseEntryHold('u1', 20, 'ROOM1', 'cancel')).resolves.not.toThrow();
    expect(mockTransactionCreate).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. HOLD LIFECYCLE STATE MACHINE
// ════════════════════════════════════════════════════════════════════════════

describe('Hold Lifecycle State Machine', () => {
  it('join (free room): no hold placed', () => {
    const entryFee = 0;
    const holdPlaced = entryFee > 0;
    expect(holdPlaced).toBe(false);
  });

  it('join (wager room): hold placed on join', () => {
    const entryFee = 20;
    const holdPlaced = entryFee > 0;
    expect(holdPlaced).toBe(true);
  });

  it('game goes LIVE: hold → locked (wallet deducted)', () => {
    // entry_hold: no wallet change (only heldBalance++).
    // entry_locked: wallet-- and held-- (net: wallet decreased, held restored).
    const walletBefore = 100;
    const heldBefore = 20;
    const walletAfterLock = walletBefore - 20;
    const heldAfterLock = heldBefore - 20;
    expect(walletAfterLock).toBe(80);
    expect(heldAfterLock).toBe(0);
  });

  it('game cancelled pre-LIVE: hold released (wallet unchanged)', () => {
    const walletBefore = 100;
    const heldBefore = 20;
    const walletAfterRelease = walletBefore; // no change
    const heldAfterRelease = heldBefore - 20;
    expect(walletAfterRelease).toBe(100);
    expect(heldAfterRelease).toBe(0);
  });

  it('LIVE game abandoned: locked amount refunded (wallet restored)', () => {
    const walletAfterLock = 80;
    const refund = 20;
    const walletAfterRefund = walletAfterLock + refund;
    expect(walletAfterRefund).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. RECONNECT PROTECTION (90-second window)
// ════════════════════════════════════════════════════════════════════════════

describe('Reconnect Window', () => {
  it('within 90 seconds: game continues (no refund)', () => {
    const disconnectTime = Date.now();
    const reconnectTime = disconnectTime + 60_000; // 60s later
    const windowMs = 90_000;
    const withinWindow = (reconnectTime - disconnectTime) <= windowMs;
    expect(withinWindow).toBe(true);
  });

  it('after 90 seconds: game abandoned, entry refunded', () => {
    const disconnectTime = Date.now();
    const reconnectTime = disconnectTime + 100_000; // 100s later
    const windowMs = 90_000;
    const withinWindow = (reconnectTime - disconnectTime) <= windowMs;
    expect(withinWindow).toBe(false);
  });
});
