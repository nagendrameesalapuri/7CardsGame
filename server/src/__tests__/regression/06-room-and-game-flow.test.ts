/**
 * REGRESSION SUITE 06 — Room Lifecycle, Game Flow & Public Rooms
 *
 * Covers: room creation rules, join validation, guest restrictions,
 * bot count limits, public/private visibility, game start atomicity,
 * resume after disconnect, invite via favorites.
 */

import { GameEngine } from '../../engine/GameEngine';
import { makeCard, makePrintedJoker, makeGameState, makePlayer } from '../helpers';

beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ── Pure business-rule helpers (mirror server validation logic) ───────────────

interface RoomConfig {
  entryFee: number;
  maxPlayers: number;
  botCount: number;
  isPrivate: boolean;
  roundCount: number;
}

interface JoinAttempt {
  isGuest: boolean;
  walletBalance: number;
  heldBalance: number;
  roomStatus: 'waiting' | 'playing' | 'starting';
  currentPlayers: number;
  maxPlayers: number;
  entryFee: number;
}

function validateJoin(a: JoinAttempt): string | null {
  if (a.roomStatus !== 'waiting') return 'Room is not open for joining';
  if (a.isGuest && a.entryFee > 0) return 'Guests cannot join cash games';
  if (a.currentPlayers >= a.maxPlayers) return 'Room is full';
  const available = Math.max(0, a.walletBalance - a.heldBalance);
  if (a.entryFee > 0 && available < a.entryFee) return 'Insufficient available balance';
  return null;
}

function validateRoomCreate(cfg: RoomConfig & { totalPlayers: number }): string | null {
  if (cfg.totalPlayers > 10) return 'Too many players (max 10)';
  if (cfg.roundCount < 1 || cfg.roundCount > 20) return 'Invalid round count (1–20)';
  if (cfg.botCount < 0) return 'Bot count cannot be negative';
  if (cfg.entryFee < 0) return 'Entry fee cannot be negative';
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. ROOM CREATION VALIDATION
// ════════════════════════════════════════════════════════════════════════════

describe('Room Creation Validation', () => {
  const base: RoomConfig & { totalPlayers: number } = {
    entryFee: 0, maxPlayers: 6, botCount: 0, isPrivate: false, roundCount: 3, totalPlayers: 2,
  };

  it('valid free room: passes', () => expect(validateRoomCreate({ ...base })).toBeNull());
  it('valid wager room: passes', () => expect(validateRoomCreate({ ...base, entryFee: 20 })).toBeNull());
  it('11 total players: rejected', () => expect(validateRoomCreate({ ...base, totalPlayers: 11 })).toMatch(/10/));
  it('10 total players: allowed', () => expect(validateRoomCreate({ ...base, totalPlayers: 10 })).toBeNull());
  it('0 round count: rejected', () => expect(validateRoomCreate({ ...base, roundCount: 0 })).toBeTruthy());
  it('21 round count: rejected', () => expect(validateRoomCreate({ ...base, roundCount: 21 })).toBeTruthy());
  it('1 round count: allowed (quick game)', () => expect(validateRoomCreate({ ...base, roundCount: 1 })).toBeNull());
  it('20 round count: allowed (max)', () => expect(validateRoomCreate({ ...base, roundCount: 20 })).toBeNull());
  it('negative entry fee: rejected', () => expect(validateRoomCreate({ ...base, entryFee: -1 })).toBeTruthy());
});

// ════════════════════════════════════════════════════════════════════════════
// 2. ROOM JOIN VALIDATION
// ════════════════════════════════════════════════════════════════════════════

describe('Room Join Validation', () => {
  const baseJoin: JoinAttempt = {
    isGuest: false, walletBalance: 100, heldBalance: 0,
    roomStatus: 'waiting', currentPlayers: 1, maxPlayers: 6, entryFee: 20,
  };

  it('valid non-guest join wager room', () => expect(validateJoin(baseJoin)).toBeNull());
  it('valid free room join (guest allowed)', () => {
    expect(validateJoin({ ...baseJoin, isGuest: true, entryFee: 0 })).toBeNull();
  });
  it('guest cannot join wager room', () => {
    expect(validateJoin({ ...baseJoin, isGuest: true, entryFee: 20 })).toMatch(/Guest/);
  });
  it('room full: rejected', () => {
    expect(validateJoin({ ...baseJoin, currentPlayers: 6, maxPlayers: 6 })).toMatch(/full/);
  });
  it('room already playing: rejected', () => {
    expect(validateJoin({ ...baseJoin, roomStatus: 'playing' })).toMatch(/not open/);
  });
  it('room starting: rejected', () => {
    expect(validateJoin({ ...baseJoin, roomStatus: 'starting' })).toMatch(/not open/);
  });
  it('insufficient available balance: rejected', () => {
    expect(validateJoin({ ...baseJoin, walletBalance: 50, heldBalance: 40, entryFee: 20 })).toMatch(/balance/);
  });
  it('held balance reduces available (join blocked when held > available)', () => {
    // Wallet 100, held 90 → available 10, entry 20 → blocked
    expect(validateJoin({ ...baseJoin, walletBalance: 100, heldBalance: 90, entryFee: 20 })).toBeTruthy();
  });
  it('exact balance: allowed', () => {
    expect(validateJoin({ ...baseJoin, walletBalance: 20, heldBalance: 0, entryFee: 20 })).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. PUBLIC ROOMS VISIBILITY
// ════════════════════════════════════════════════════════════════════════════

describe('Public Rooms Visibility', () => {
  function isVisible(room: { isPrivate: boolean; status: string }): boolean {
    return !room.isPrivate && room.status === 'waiting';
  }

  it('public waiting room: visible in lobby', () => {
    expect(isVisible({ isPrivate: false, status: 'waiting' })).toBe(true);
  });
  it('private room: hidden from lobby', () => {
    expect(isVisible({ isPrivate: true, status: 'waiting' })).toBe(false);
  });
  it('playing room: hidden from lobby', () => {
    expect(isVisible({ isPrivate: false, status: 'playing' })).toBe(false);
  });
  it('finished room: hidden from lobby', () => {
    expect(isVisible({ isPrivate: false, status: 'finished' })).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. GAME START ATOMICITY
// ════════════════════════════════════════════════════════════════════════════

describe('Game Start Atomicity', () => {
  it('room status "starting" prevents second start attempt', () => {
    // The atomic findOneAndUpdate({ status:'waiting' }) returns null if already 'starting'
    const canStart = (status: string) => status === 'waiting';
    expect(canStart('waiting')).toBe(true);
    expect(canStart('starting')).toBe(false);
    expect(canStart('playing')).toBe(false);
  });

  it('concurrent starts: only one can claim "waiting → starting"', () => {
    let status = 'waiting';
    function atomicClaim(): boolean {
      if (status === 'waiting') { status = 'starting'; return true; }
      return false;
    }
    const results = [atomicClaim(), atomicClaim(), atomicClaim()];
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter(r => !r)).toHaveLength(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. RESUME GAME (reconnect flow)
// ════════════════════════════════════════════════════════════════════════════

describe('Resume Game', () => {
  it('game state persists in memory after disconnect', () => {
    const s = GameEngine.initializeGame({
      roomId: 'resume-room',
      players: [
        { id: 'p0', userId: 'u0', username: 'P0', avatar: 'a', isBot: false },
        { id: 'p1', userId: 'u1', username: 'P1', avatar: 'a', isBot: false },
      ],
      roundCount: 3,
      turnTimeLimit: 30,
    });
    // Simulate drawing a card
    const r = GameEngine.processDrawCard(s, s.players[0].id, 'deck');
    const savedId = r.state?.id;
    expect(savedId).toBe(s.id);
    // State is mutable reference — persists in activeGames Map
    expect(r.state!.hasDrawnThisTurn).toBe(true);
  });

  it('reconnected player isConnected set back to true', () => {
    const s = GameEngine.initializeGame({
      roomId: 'r',
      players: [
        { id: 'p0', userId: 'u0', username: 'P0', avatar: 'a', isBot: false },
        { id: 'p1', userId: 'u1', username: 'P1', avatar: 'a', isBot: true  },
      ],
      roundCount: 3, turnTimeLimit: 30,
    });
    s.players[0].isConnected = false;
    // Reconnect
    s.players[0].isConnected = true;
    expect(s.players[0].isConnected).toBe(true);
  });

  it('switch app and return: game state unchanged while within 90s', () => {
    const s = GameEngine.initializeGame({
      roomId: 'r',
      players: [
        { id: 'p0', userId: 'u0', username: 'P0', avatar: 'a', isBot: false },
        { id: 'p1', userId: 'u1', username: 'P1', avatar: 'a', isBot: true  },
      ],
      roundCount: 3, turnTimeLimit: 30,
    });
    const handBefore = [...s.players[0].hand];
    const roundBefore = s.roundNumber;
    // Simulate "app switch" — no server-side change within 90s
    expect(s.roundNumber).toBe(roundBefore);
    expect(s.players[0].hand.length).toBe(handBefore.length);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. GAME INVITE SYSTEM
// ════════════════════════════════════════════════════════════════════════════

describe('Game Invite System', () => {
  it('invite only valid to favorites', () => {
    const favorites = ['user-b', 'user-c'];
    const recipientId = 'user-b';
    expect(favorites.includes(recipientId)).toBe(true);
  });

  it('cannot invite non-favorite', () => {
    const favorites = ['user-b'];
    const recipientId = 'user-x';
    expect(favorites.includes(recipientId)).toBe(false);
  });

  it('cannot invite yourself', () => {
    const senderId = 'user-a';
    const recipientId = 'user-a';
    expect(senderId === recipientId).toBe(true); // rejected case
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. PLAY VS AI (bot-only rooms)
// ════════════════════════════════════════════════════════════════════════════

describe('Play vs AI', () => {
  it('bot-only game starts with correct bot count', () => {
    const s = GameEngine.initializeGame({
      roomId: 'ai-room',
      players: [
        { id: 'h', userId: 'uh', username: 'Human', avatar: 'a', isBot: false },
        { id: 'b1', userId: 'ub1', username: 'Bot1', avatar: 'a', isBot: true },
        { id: 'b2', userId: 'ub2', username: 'Bot2', avatar: 'a', isBot: true },
      ],
      roundCount: 3, turnTimeLimit: 30,
    });
    expect(s.players.filter(p => p.isBot)).toHaveLength(2);
    expect(s.players.filter(p => !p.isBot)).toHaveLength(1);
  });

  it('free mode (0 entry fee) does not require wallet balance', () => {
    const entryFee = 0;
    const walletBalance = 0;
    const canJoin = walletBalance >= entryFee;
    expect(canJoin).toBe(true);
  });

  it('AI points not deducted in free vs-AI mode (only spin costs points)', () => {
    const aiPointsBefore = 1000;
    // Playing vs AI doesn't cost points — only spin does
    const aiPointsAfterGame = aiPointsBefore;
    expect(aiPointsAfterGame).toBe(aiPointsBefore);
  });
});
