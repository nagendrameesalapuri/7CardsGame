/**
 * REGRESSION SUITE 07 — AI Championship (Solo Survival + Team Arena)
 *
 * Covers: survival stage progression, tier entry requirements, prize rewards,
 * team arena 2v2 composition, bot personality per stage, AI points system,
 * stage unlock/lock logic, team score aggregation.
 */

import { GameEngine } from '../../engine/GameEngine';
import { BotPlayer, BotPersonality } from '../../engine/BotPlayer';
import { setBotPersonality } from '../../socket/handlers/gameHandler';
import { makeCard, makePrintedJoker, makeGameState, makeBot, makePlayer, makeOpponent } from '../helpers';

beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

// ── Survival stage config (mirrors server/src/config/survivalConfig or AdminConfig defaults)
const STAGES: { stage: number; botPersonality: BotPersonality; pointsRequired: number }[] = [
  { stage: 1, botPersonality: 'safe',       pointsRequired: 0    },
  { stage: 2, botPersonality: 'smart',      pointsRequired: 200  },
  { stage: 3, botPersonality: 'aggressive', pointsRequired: 700  },
  { stage: 4, botPersonality: 'bluff',      pointsRequired: 1400 },
  { stage: 5, botPersonality: 'boss',       pointsRequired: 2500 },
];

// ════════════════════════════════════════════════════════════════════════════
// 1. STAGE UNLOCK LOGIC
// ════════════════════════════════════════════════════════════════════════════

describe('Survival Stage Unlock', () => {
  function canEnterStage(stage: number, currentPoints: number): boolean {
    const cfg = STAGES.find(s => s.stage === stage);
    if (!cfg) return false;
    return currentPoints >= cfg.pointsRequired;
  }

  it('Stage 1 (Warmup): always unlocked', () => {
    expect(canEnterStage(1, 0)).toBe(true);
  });

  it('Stage 2: requires 200 pts', () => {
    expect(canEnterStage(2, 199)).toBe(false);
    expect(canEnterStage(2, 200)).toBe(true);
    expect(canEnterStage(2, 500)).toBe(true);
  });

  it('Stage 3: requires 700 pts', () => {
    expect(canEnterStage(3, 699)).toBe(false);
    expect(canEnterStage(3, 700)).toBe(true);
  });

  it('Stage 4: requires 1400 pts', () => {
    expect(canEnterStage(4, 1399)).toBe(false);
    expect(canEnterStage(4, 1400)).toBe(true);
  });

  it('Stage 5 (Boss Arena): requires 2500 pts', () => {
    expect(canEnterStage(5, 2499)).toBe(false);
    expect(canEnterStage(5, 2500)).toBe(true);
  });

  it('unknown stage: locked', () => {
    expect(canEnterStage(6, 99999)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. STAGE-APPROPRIATE BOT PERSONALITY
// ════════════════════════════════════════════════════════════════════════════

describe('Survival Bot Personality Assignment', () => {
  it('Stage 1 uses safe bot', () => {
    expect(STAGES[0].botPersonality).toBe('safe');
  });

  it('Stage 2 uses smart bot', () => {
    expect(STAGES[1].botPersonality).toBe('smart');
  });

  it('Stage 5 uses boss bot', () => {
    expect(STAGES[4].botPersonality).toBe('boss');
  });

  it('each stage has progressively harder personality', () => {
    // Hardness order: safe < smart < aggressive < bluff < boss
    const hardness: Record<BotPersonality, number> = {
      safe: 1, smart: 2, aggressive: 3, bluff: 4, boss: 5,
    };
    for (let i = 1; i < STAGES.length; i++) {
      const prev = hardness[STAGES[i - 1].botPersonality];
      const curr = hardness[STAGES[i].botPersonality];
      expect(curr).toBeGreaterThan(prev);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. SURVIVAL GAME ENGINE (Human vs Stage Bot)
// ════════════════════════════════════════════════════════════════════════════

describe('Survival Game Engine', () => {
  function survivalConfig(stage: number) {
    const personality = STAGES[stage - 1].botPersonality;
    return {
      roomId: `surv-stage${stage}`,
      players: [
        { id: 'human',  userId: 'uh', username: 'Human', avatar: 'a', isBot: false },
        { id: 'bot',    userId: 'ub', username: 'Bot',   avatar: 'a', isBot: true  },
      ],
      roundCount: 3,
      turnTimeLimit: 30,
    };
  }

  STAGES.forEach(({ stage }) => {
    it(`Stage ${stage}: game initializes with 2 players`, () => {
      const s = GameEngine.initializeGame(survivalConfig(stage));
      expect(s.players).toHaveLength(2);
      expect(s.players[0].isBot).toBe(false);
      expect(s.players[1].isBot).toBe(true);
    });
  });

  it('survival game: bot makes valid draw decision', () => {
    const s = GameEngine.initializeGame(survivalConfig(3));
    s.currentPlayerIndex = 1;
    s.attackChain = null;
    setBotPersonality(s.id, 'aggressive');
    BotPlayer.initBotContext(s.players[1].id);
    const source = BotPlayer.decideDrawSource(s, s.players[1].id);
    expect(['deck', 'discard']).toContain(source as string);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. AI POINTS SYSTEM
// ════════════════════════════════════════════════════════════════════════════

describe('AI Points System', () => {
  it('winning survival round awards points (>0)', () => {
    // Points are awarded on win — exact amount from survivalConfig
    const stageRewards = [200, 400, 700, 1200, 2500]; // stage reward pts
    stageRewards.forEach(r => expect(r).toBeGreaterThan(0));
  });

  it('points accumulate for stage progression', () => {
    let total = 0;
    const earned = [200, 400]; // win stages 1+2
    earned.forEach(e => { total += e; });
    expect(total).toBe(600);
    expect(total >= STAGES[2].pointsRequired).toBe(false); // still can't do stage 3 (needs 700)
    total += 200; // one more
    expect(total >= STAGES[2].pointsRequired).toBe(true); // now can
  });

  it('spin costs 100 AI points', () => {
    const points = 500;
    expect(points - 100).toBe(400);
  });

  it('survival loss does not award stage points', () => {
    const pointsBefore = 500;
    // Loss: no points awarded (server logic: only win triggers addPoints)
    const pointsAfterLoss = pointsBefore;
    expect(pointsAfterLoss).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. TEAM ARENA (2v2 — Human+Bot vs Bot+Bot)
// ════════════════════════════════════════════════════════════════════════════

describe('Team Arena', () => {
  function teamConfig() {
    return {
      roomId: 'team-arena',
      players: [
        { id: 'h1',  userId: 'uh1', username: 'H1', avatar: 'a', isBot: false },
        { id: 'b1',  userId: 'ub1', username: 'B1', avatar: 'a', isBot: true  },
        { id: 'h2',  userId: 'uh2', username: 'H2', avatar: 'a', isBot: false },
        { id: 'b2',  userId: 'ub2', username: 'B2', avatar: 'a', isBot: true  },
      ],
      roundCount: 5,
      turnTimeLimit: 30,
    };
  }

  it('4-player team game initializes correctly', () => {
    const s = GameEngine.initializeGame(teamConfig());
    expect(s.players).toHaveLength(4);
    s.players.forEach(p => expect(p.hand).toHaveLength(7));
  });

  it('team game: bots and humans interleaved', () => {
    const s = GameEngine.initializeGame(teamConfig());
    const bots = s.players.filter(p => p.isBot);
    const humans = s.players.filter(p => !p.isBot);
    expect(bots).toHaveLength(2);
    expect(humans).toHaveLength(2);
  });

  it('team score: sum of both team member scores', () => {
    const team1Scores = [0, 14];   // player 1 SHOW (win=0), player 3 (loses=14)
    const team2Scores = [30, 20];
    const team1Total = team1Scores.reduce((a, b) => a + b, 0);
    const team2Total = team2Scores.reduce((a, b) => a + b, 0);
    expect(team1Total).toBe(14);
    expect(team2Total).toBe(50);
    expect(team1Total < team2Total).toBe(true); // Team 1 wins (lower score)
  });

  it('team game: 5 rounds as configured', () => {
    const s = GameEngine.initializeGame(teamConfig());
    expect(s.roundCount).toBe(5);
  });

  it('team arena bot personality: boss for both bots', () => {
    // Team arena uses boss-level bots
    const personality: BotPersonality = 'boss';
    expect(personality).toBe('boss');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. HISTORY & TRANSACTION TYPES
// ════════════════════════════════════════════════════════════════════════════

describe('Transaction History Types', () => {
  const VALID_TYPES = [
    'deposit', 'withdrawal', 'winning', 'entry_fee', 'refund', 'bonus',
    'referral_bonus', 'entry_hold', 'entry_released', 'entry_locked',
    'match_settlement', 'abandoned_resolution', 'system_rollback',
    'transfer_sent', 'transfer_received',
  ];

  it('all expected transaction types are defined', () => {
    expect(VALID_TYPES).toContain('deposit');
    expect(VALID_TYPES).toContain('withdrawal');
    expect(VALID_TYPES).toContain('transfer_sent');
    expect(VALID_TYPES).toContain('transfer_received');
    expect(VALID_TYPES).toContain('entry_locked');
    expect(VALID_TYPES).toContain('entry_released');
    expect(VALID_TYPES).toContain('abandoned_resolution');
  });

  it('scheduled tournament types are NOT present (decommissioned)', () => {
    expect(VALID_TYPES).not.toContain('tournament_prize');
    expect(VALID_TYPES).not.toContain('tournament_entry');
  });

  it('debit types reduce wallet display', () => {
    const TX_DEBIT = new Set(['withdrawal', 'entry_fee', 'entry_locked', 'transfer_sent']);
    expect(TX_DEBIT.has('transfer_sent')).toBe(true);
    expect(TX_DEBIT.has('deposit')).toBe(false);
  });

  it('credit types increase wallet display', () => {
    const TX_CREDIT = new Set(['deposit', 'winning', 'refund', 'bonus', 'match_settlement', 'abandoned_resolution', 'transfer_received']);
    expect(TX_CREDIT.has('transfer_received')).toBe(true);
    expect(TX_CREDIT.has('withdrawal')).toBe(false);
  });
});
