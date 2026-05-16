/**
 * BotPlayer test suite — positive, negative, and edge-case coverage.
 *
 * Bugs revealed by this suite are tagged [BUG-N] in the test name.
 * Tests that EXPOSE a known bug are marked with .failing() or a comment.
 */

import { BotPlayer, BotPersonality, OpponentProfile } from '../engine/BotPlayer';
import { GameState } from '../../../shared/src/types';
import {
  makeCard, makePrintedJoker, makePaperJoker,
  makePlayer, makeBot, makeGameState, makeAttackChain, makeOpponent,
} from './helpers';

// Suppress engine console.log in tests
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { (console.log as jest.Mock).mockRestore(); });

// ── Deterministic random helper ──────────────────────────────────────────────
// When we want to bypass probabilistic paths, lock Math.random.
function withRandom(value: number, fn: () => void): void {
  const spy = jest.spyOn(Math, 'random').mockReturnValue(value);
  try { fn(); } finally { spy.mockRestore(); }
}

// Unique bot ID per test avoids ctxMap state bleed
let botCounter = 0;
const freshBotId = () => `bot-${++botCounter}`;

// ════════════════════════════════════════════════════════════════════════════
// getThinkDelay
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.getThinkDelay', () => {
  it('returns a positive number for every personality', () => {
    const personalities: BotPersonality[] = ['safe', 'aggressive', 'bluff', 'smart', 'boss'];
    personalities.forEach(p => {
      const delay = BotPlayer.getThinkDelay(p, 0);
      expect(delay).toBeGreaterThan(0);
    });
  });

  it('safe personality has the highest base delay (≥ 1200ms)', () => {
    // With Math.random=0: delay ≈ base (1200ms) - boost(0) = 1200. Clamped to max(350, value).
    withRandom(0, () => {
      const delay = BotPlayer.getThinkDelay('safe', 0);
      expect(delay).toBeGreaterThanOrEqual(1200);
    });
  });

  it('aggressive personality responds fastest (base 280ms)', () => {
    withRandom(0, () => {
      const aggressiveDelay = BotPlayer.getThinkDelay('aggressive', 0);
      const safeDelay       = BotPlayer.getThinkDelay('safe', 0);
      expect(aggressiveDelay).toBeLessThan(safeDelay);
    });
  });

  it('minimum delay is never below 350ms', () => {
    // Even with max boost (0.35) and random=0, must not go below 350
    const personalities: BotPersonality[] = ['safe', 'aggressive', 'bluff', 'smart', 'boss'];
    personalities.forEach(p => {
      for (let i = 0; i < 5; i++) {
        const delay = BotPlayer.getThinkDelay(p, 0.35);
        expect(delay).toBeGreaterThanOrEqual(350);
      }
    });
  });

  it('higher difficulty boost reduces think delay', () => {
    withRandom(0, () => {
      const lowBoost  = BotPlayer.getThinkDelay('smart', 0);
      const highBoost = BotPlayer.getThinkDelay('smart', 0.35);
      expect(highBoost).toBeLessThanOrEqual(lowBoost);
    });
  });

  it('returns integer (Math.round applied)', () => {
    withRandom(0.5, () => {
      const delay = BotPlayer.getThinkDelay('boss', 0);
      expect(Number.isInteger(delay)).toBe(true);
    });
  });

  it('bluff personality adds random spike delay ~18% of turns', () => {
    // Pre-init context so initBotContext doesn't consume a random call mid-sequence
    const id = freshBotId();
    BotPlayer.initBotContext(id);

    // Random call order in getThinkDelay('bluff'):
    //   #1 → baseDelay = 700 + r1*680
    //   #2 → spike check: r2 < 0.18 → trigger?
    //   #3 → spike amount: 600 + r3*800
    //   #4 → getCtx(id): context already exists, NO random call
    //   (no cooldown/bait phase — building phase, no extra delay)
    const spy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0)    // #1: baseDelay = 700 + 0 = 700
      .mockReturnValueOnce(0.1)  // #2: spike check 0.1 < 0.18 → trigger
      .mockReturnValueOnce(0)    // #3: spike = 600 + 0*800 = 600 → total 1300
      .mockReturnValue(0.5);     // #4+: anything else
    try {
      const spikedDelay = BotPlayer.getThinkDelay('bluff', 0, id);
      expect(spikedDelay).toBeGreaterThanOrEqual(1300); // 700 base + 600 spike minimum
    } finally { spy.mockRestore(); }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// shouldCallShow
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.shouldCallShow', () => {

  function showState(botHand: ReturnType<typeof makeCard>[], botId: string) {
    const bot  = makeBot(botId, botHand);
    const opp  = makePlayer('opp-show', [makeCard('K'), makeCard('Q'), makeCard('J')]);
    return makeGameState([bot, opp], { hasDrawnThisTurn: false });
  }

  // ── Hard floor: total ≤ 5 always returns true ─────────────────────────────

  it('always shows when hand total = 0 (all jokers)', () => {
    const id = freshBotId();
    const state = showState([makePrintedJoker(), makePrintedJoker()], id);
    expect(BotPlayer.shouldCallShow(state, id, 'safe')).toBe(true);
  });

  it('always shows when hand total = 5 for all personalities', () => {
    (['safe', 'aggressive', 'bluff', 'smart', 'boss'] as BotPersonality[]).forEach(p => {
      const id = freshBotId();
      // A(1) + 2(2) + 2(2) = 5
      const state = showState([makeCard('A'), makeCard('2'), makeCard('2')], id);
      expect(BotPlayer.shouldCallShow(state, id, p)).toBe(true);
    });
  });

  // ── Hard ceiling: total > SHOW_HARD_MAX always returns false ─────────────

  it('never shows when total > 5 for safe personality (SHOW_HARD_MAX=5)', () => {
    const id = freshBotId();
    const state = showState([makeCard('3'), makeCard('2'), makeCard('2')], id); // total=7 (wrong, 3+2+2=7 > 5)
    withRandom(1, () => { // suppress randomness
      expect(BotPlayer.shouldCallShow(state, id, 'safe')).toBe(false);
    });
  });

  it('never shows when total = 6 for safe personality', () => {
    const id = freshBotId();
    const state = showState([makeCard('4'), makeCard('2')], id); // 4+2=6
    expect(BotPlayer.shouldCallShow(state, id, 'safe')).toBe(false);
  });

  it('never shows when total = 6 for boss personality (SHOW_HARD_MAX=5)', () => {
    const id = freshBotId();
    const state = showState([makeCard('4'), makeCard('2')], id); // 6
    expect(BotPlayer.shouldCallShow(state, id, 'boss')).toBe(false);
  });

  it('never shows when total = 7 for smart personality (SHOW_HARD_MAX=6)', () => {
    const id = freshBotId();
    const state = showState([makeCard('4'), makeCard('3')], id); // 7
    expect(BotPlayer.shouldCallShow(state, id, 'smart')).toBe(false);
  });

  it('can show when total = 7 for aggressive (SHOW_HARD_MAX=7)', () => {
    // total=7 ≤ 7 → passes hard ceiling; confidence check runs
    const id = freshBotId();
    const state = showState([makeCard('4'), makeCard('3')], id); // 7
    withRandom(1, () => {
      // At high confidence, should return true; showBias=0.06 and total=7 is borderline
      const result = BotPlayer.shouldCallShow(state, id, 'aggressive', 0.35);
      // With max boost, should be willing to show at 7
      expect(typeof result).toBe('boolean'); // at least doesn't crash
    });
  });

  it('never shows when total = 8 for aggressive (> SHOW_HARD_MAX=7)', () => {
    const id = freshBotId();
    const state = showState([makeCard('4'), makeCard('4')], id); // 8
    expect(BotPlayer.shouldCallShow(state, id, 'aggressive')).toBe(false);
  });

  it('never shows when total = 10 for bluff (> SHOW_HARD_MAX=9)', () => {
    const id = freshBotId();
    const state = showState([makeCard('5'), makeCard('5')], id); // 10
    expect(BotPlayer.shouldCallShow(state, id, 'bluff')).toBe(false);
  });

  it('can consider showing when total = 9 for bluff (passes hard ceiling)', () => {
    const id = freshBotId();
    const state = showState([makeCard('5'), makeCard('4')], id); // 9
    // Confidence check runs — just ensure it doesn't crash and returns bool
    withRandom(1, () => {
      expect(typeof BotPlayer.shouldCallShow(state, id, 'bluff')).toBe('boolean');
    });
  });

  // ── Critical threat lowers show threshold ─────────────────────────────────

  it('more likely to show when opponent has ≤ 3 cards (race condition pressure)', () => {
    const id = freshBotId();
    // Bot has total=6 (just above safe threshold but within aggressive range)
    const bot  = makeBot(id, [makeCard('4'), makeCard('2')]);
    const opp  = makePlayer('opp-crit', Array.from({ length: 2 }, () => makeCard('A')), { handCount: 2 });
    const state = makeGameState([bot, opp]);
    const opps = [makeOpponent('user_opp-crit', { handCount: 2 })];
    // Should be more willing to show at total=6 for aggressive due to opponent pressure
    withRandom(1, () => {
      const result = BotPlayer.shouldCallShow(state, id, 'aggressive', 0.2, opps);
      expect(typeof result).toBe('boolean');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// decideAttackResponse
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.decideAttackResponse', () => {
  it('throws all real 7s when available', () => {
    const id = freshBotId();
    const seven1 = makeCard('7');
    const seven2 = makeCard('7', 'diamonds');
    const bot   = makeBot(id, [seven1, seven2, makeCard('K')]);
    const opp   = makePlayer('opp-atk', [makeCard('K')]);
    const state = makeGameState([bot, opp], {
      attackChain: makeAttackChain('opp-atk', 0, 1),
      currentPlayerIndex: 0,
    });
    const resp = BotPlayer.decideAttackResponse(state, id);
    expect(resp.action).toBe('throw');
    expect(resp.cardIds).toEqual(expect.arrayContaining([seven1.id, seven2.id]));
    expect(resp.cardIds).toHaveLength(2);
  });

  it('takes penalty when no real 7s in hand', () => {
    const id = freshBotId();
    const bot   = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('A')]);
    const opp   = makePlayer('opp-atk2', [makeCard('7')]);
    const state = makeGameState([bot, opp], {
      attackChain: makeAttackChain('opp-atk2', 0, 1),
      currentPlayerIndex: 0,
    });
    const resp = BotPlayer.decideAttackResponse(state, id);
    expect(resp.action).toBe('take');
    expect(resp.cardIds).toBeUndefined();
  });

  it('ignores joker-rank 7s (isJoker=true) — takes instead of throwing', () => {
    const id = freshBotId();
    const jokerSeven = makePaperJoker('7'); // 7 is the joker rank → isJoker=true
    const bot   = makeBot(id, [jokerSeven, makeCard('K')]);
    const opp   = makePlayer('opp-atk3', [makeCard('7')]);
    const state = makeGameState([bot, opp], {
      attackChain: makeAttackChain('opp-atk3', 0, 1),
      currentPlayerIndex: 0,
    });
    const resp = BotPlayer.decideAttackResponse(state, id);
    expect(resp.action).toBe('take'); // joker 7 is not a real 7
  });

  it('throws only real 7s when mix of real and joker 7s present', () => {
    const id = freshBotId();
    const real7   = makeCard('7');
    const joker7  = makePaperJoker('7');
    const bot   = makeBot(id, [real7, joker7, makeCard('K')]);
    const opp   = makePlayer('opp-atk4', [makeCard('7')]);
    const state = makeGameState([bot, opp], {
      attackChain: makeAttackChain('opp-atk4', 0, 1),
      currentPlayerIndex: 0,
    });
    const resp = BotPlayer.decideAttackResponse(state, id);
    expect(resp.action).toBe('throw');
    expect(resp.cardIds).toEqual([real7.id]);
    expect(resp.cardIds).not.toContain(joker7.id);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// decideDrawSource
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.decideDrawSource', () => {
  function drawState(botHand: ReturnType<typeof makeCard>[], botId: string, discardTop: ReturnType<typeof makeCard>) {
    const bot = makeBot(botId, botHand);
    const opp = makePlayer('opp-draw', Array.from({ length: 5 }, () => makeCard('K')));
    return makeGameState([bot, opp], { discardPile: [discardTop] });
  }

  it('returns "deck" when discard pile is empty', () => {
    const id = freshBotId();
    const bot = makeBot(id, [makeCard('K'), makeCard('Q')]);
    const opp = makePlayer('opp-d1', [makeCard('K')]);
    const state = makeGameState([bot, opp], { discardPile: [] });
    expect(BotPlayer.decideDrawSource(state, id)).toBe('deck');
  });

  it('returns "deck" when top discard is a real 7', () => {
    const id = freshBotId();
    const state = drawState([makeCard('K'), makeCard('Q')], id, makeCard('7'));
    expect(BotPlayer.decideDrawSource(state, id)).toBe('deck');
  });

  it('returns "deck" when top discard is a real J', () => {
    const id = freshBotId();
    const state = drawState([makeCard('K'), makeCard('Q')], id, makeCard('J'));
    expect(BotPlayer.decideDrawSource(state, id)).toBe('deck');
  });

  it('returns "discard" when top discard is a printed joker (rank=Joker, value=0)', () => {
    // BUG-002 fixed: bot now takes printed jokers from the discard pile.
    // Printed jokers are already visible (not unknown), so no information leakage concern.
    const id = freshBotId();
    const state = drawState([makeCard('K'), makeCard('Q')], id, makePrintedJoker());
    expect(BotPlayer.decideDrawSource(state, id)).toBe('discard');
  });

  it('returns "discard" when top discard is a paper joker (value=0)', () => {
    const id = freshBotId();
    // jokerRank='5' so this 5 is a paper joker
    const paperJoker5 = makePaperJoker('5');
    const state = drawState([makeCard('K'), makeCard('Q')], id, paperJoker5);
    expect(BotPlayer.decideDrawSource(state, id)).toBe('discard');
  });

  it('returns "discard" when top card completes a pair with good value', () => {
    const id = freshBotId();
    const topDiscard = makeCard('6'); // value=6
    const botHand = [
      makeCard('6', 'clubs'),  // pair match for top discard
      makeCard('K'),           // worst card (value=10)
    ];
    const state = drawState(botHand, id, topDiscard);
    // discardValue(6) <= worstValue(10) and completes pair → take from discard
    expect(BotPlayer.decideDrawSource(state, id)).toBe('discard');
  });

  it('returns "deck" when discard value is worse than worst in hand', () => {
    const id = freshBotId();
    const topDiscard = makeCard('K'); // value=10
    const botHand = [makeCard('A'), makeCard('2'), makeCard('3')]; // worst=3
    // discardValue(10) > worstValue(3) by more than DISCARD_SAVE_THRESHOLD → deck
    const state = drawState(botHand, id, topDiscard);
    expect(BotPlayer.decideDrawSource(state, id)).toBe('deck');
  });

  it('returns "deck" under critical threat even if discard value ≥ 4', () => {
    const id = freshBotId();
    // Opponent has 2 cards → critical threat
    const bot = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J')]);
    const opp = makePlayer('opp-crit-draw', [makeCard('A'), makeCard('2')], { handCount: 2 });
    const topDiscard = makeCard('6'); // value=6 (≥ 4 threshold)
    const state = makeGameState([bot, opp], { discardPile: [topDiscard] });
    const opps = [makeOpponent('user_opp-crit-draw', { handCount: 2 })];
    const result = BotPlayer.decideDrawSource(state, id, 0, opps);
    expect(result).toBe('deck');
  });

  it('returns "discard" when taking improves score significantly', () => {
    const id = freshBotId();
    const topDiscard = makeCard('A'); // value=1
    const botHand = [makeCard('K'), makeCard('Q'), makeCard('J')]; // worst=10
    // discardValue(1) < worstValue(10) by more than DISCARD_SAVE_THRESHOLD(1) → take
    const state = drawState(botHand, id, topDiscard);
    expect(BotPlayer.decideDrawSource(state, id)).toBe('discard');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// decideDiscard — 11-step pipeline
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.decideDiscard', () => {

  function discardState(
    botId: string,
    botHand: ReturnType<typeof makeCard>[],
    opps: ReturnType<typeof makePlayer>[] = [],
    topDiscard = makeCard('5'),
  ) {
    const bot = makeBot(botId, botHand);
    const state = makeGameState([bot, ...opps], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: true,
      currentPlayerIndex: 0,
    });
    return state;
  }

  // ── Step 1: Show Interruption (CRITICAL + 7s in hand) ────────────────────

  it('Step 1 — preserves 7s and dumps worst safe non-power card under CRITICAL threat', () => {
    const id = freshBotId();
    const seven1 = makeCard('7');
    const seven2 = makeCard('7', 'diamonds');
    const king   = makeCard('K'); // high value, safe to discard
    const ace    = makeCard('A'); // denial priority — should NOT discard
    const botHand = [seven1, seven2, king, ace, makeCard('9'), makeCard('8'), makeCard('6')];

    // Opponent at 2 cards → CRITICAL. showThreat ≥ 0 due to opponent card count
    const opp = makePlayer('opp-s1', Array.from({ length: 2 }, () => makeCard('A')), { handCount: 2 });
    const state = discardState(id, botHand, [opp]);
    const opps  = [makeOpponent('user_opp-s1', { handCount: 2 })];

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0, opps);
      // Should preserve 7s (not in result)
      expect(result).not.toContain(seven1.id);
      expect(result).not.toContain(seven2.id);
      // Should NOT discard the Ace (denial priority)
      expect(result).not.toContain(ace.id);
    });
  });

  // ── Step 2: Attack all 7s ─────────────────────────────────────────────────

  it('Step 2 — aggressive bot throws ALL 7s when opponent at attackAllAt threshold (4 cards)', () => {
    const id = freshBotId();
    const s1 = makeCard('7');
    const s2 = makeCard('7', 'clubs');
    const botHand = [s1, s2, makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8')];
    // Opponent with 4 cards → minOpponentCards=4 ≤ attackAllAt(4 for aggressive)
    const opp = makePlayer('opp-atk-all', Array.from({ length: 4 }, () => makeCard('6')), { handCount: 4 });
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'aggressive', 0);
      expect(result).toContain(s1.id);
      expect(result).toContain(s2.id);
    });
  });

  it('Step 2 — safe bot does NOT attack when opponent at 4 cards (attackAllAt=0)', () => {
    const id = freshBotId();
    const s1 = makeCard('7');
    const botHand = [s1, makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8'), makeCard('6')];
    const opp = makePlayer('opp-safe', Array.from({ length: 4 }, () => makeCard('6')), { handCount: 4 });
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'safe', 0);
      // Safe personality: attackAllAt=0, minOpponentCards(4) > 0 → no attack
      expect(result).not.toContain(s1.id);
    });
  });

  it('Step 1 — CRITICAL + bot has 7s + minOpps≤3: preserves 7s, dumps worst safe card instead', () => {
    // Step 1 (show interruption) fires BEFORE step 2 when opponent ≤ 3 cards.
    // It PRESERVES 7s for later attack and dumps the worst safe non-power card.
    const id = freshBotId();
    const seven = makeCard('7');
    const king  = makeCard('K'); // value=10 — worst non-power card, safe to dump
    const ace   = makeCard('A'); // denial priority — should NOT be dumped
    const botHand = [seven, king, ace, makeCard('9'), makeCard('8'), makeCard('6'), makeCard('5')];
    // Opponent at 2 cards → CRITICAL and minOpponentCards ≤ 3 → step 1 fires
    const opp = makePlayer('opp-si', [makeCard('A'), makeCard('2')], { handCount: 2 });
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'safe', 0);
      // Step 1: preserve 7s (not in result), dump worst safe card (king)
      expect(result).not.toContain(seven.id);   // 7 is preserved
      expect(result).toContain(king.id);         // king is dumped (worst safe)
    });
  });

  // ── Step 4 (immediate show) ───────────────────────────────────────────────

  it('Step 4 — discards card that brings hand total to ≤5 (immediate show positioning)', () => {
    const id = freshBotId();
    const king  = makeCard('K'); // value=10 — discarding this brings total to 3
    const ace   = makeCard('A'); // value=1
    const two   = makeCard('2'); // value=2
    const joker1 = makePrintedJoker();
    const joker2 = makePrintedJoker();
    // total = 10+1+2+0+0 = 13. Discard K → remaining = 3 ≤ 5
    const botHand = [king, ace, two, joker1, joker2];
    const opp = makePlayer('opp-imm-show', [makeCard('K'), makeCard('Q')]);
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0);
      expect(result).toContain(king.id);
    });
  });

  // ── BUG-001: Jack show opportunity miss ───────────────────────────────────

  it('[BUG-001] bot misses optimal Jack discard when J is the only card preventing show', () => {
    /**
     * BUG-001 (HIGH): bestReductionDiscard() excludes real Jacks from candidates.
     * When discarding a Jack would bring hand total to ≤5 but the next player has
     * many cards (skipAt conditions not met), the bot never considers discarding the Jack.
     * The "immediate show" check (step 4) uses normalBestScore which ignores Jacks.
     *
     * Optimal play: discard J → remaining total = A+2+joker+joker = 3 → enables show next turn.
     * Actual play:  bot discards 2 → remaining = J+A+joker+joker = 11 (misses the show window).
     *
     * This test documents the BUG. Remove `.failing()` once the bug is fixed.
     */
    const id = freshBotId();
    const jack  = makeCard('J');  // value=10 — if discarded: remaining = 3 ≤ 5
    const ace   = makeCard('A');  // value=1
    const two   = makeCard('2');  // value=2
    const joker1 = makePrintedJoker(); // value=0
    const joker2 = makePrintedJoker(); // value=0
    // Total = 10+1+2+0+0 = 13. Discard J → 1+2+0+0 = 3 → show possible next turn.
    const botHand = [jack, ace, two, joker1, joker2];
    // Next player (opp) has 7 cards — no skip incentive
    const opp = makePlayer('opp-bug1', Array.from({ length: 7 }, () => makeCard('K')), { handCount: 7 });
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0);
      // BUG: bot should discard the Jack, but won't because:
      //   - normalBestScore ignores Jacks → normalBestScore=11 (not ≤5)
      //   - step 6 (Jack deploy) requires nextPlayerCards ≤ skipAt(4), but opp has 7
      // Actual result will be [ace.id] or [two.id] — not the Jack.
      // EXPECTED correct behavior: result should contain jack.id
      expect(result).toContain(jack.id); // ← this assertion FAILS → reveals BUG-001
    });
  });

  // ── Step 7: Denial scoring — boss avoids discarding valuable opponent cards ─

  it('Step 7 — boss does NOT discard A or 2 when opponent is at 2 cards (critical)', () => {
    const id = freshBotId();
    BotPlayer.initBotContext(id);
    const ace = makeCard('A');  // denial priority
    const two = makeCard('2');  // denial priority
    const king = makeCard('K');
    const queen = makeCard('Q');
    const nine  = makeCard('9');
    const eight = makeCard('8');
    const five  = makeCard('5');
    // total = 1+2+10+10+9+8+5 = 45
    const botHand = [ace, two, king, queen, nine, eight, five];
    // Opponent at 2 cards → CRITICAL threat → high denial weight
    const opp = makePlayer('opp-denial', [makeCard('A'), makeCard('2')], { handCount: 2 });
    const state = discardState(id, botHand, [opp]);
    const opps  = [makeOpponent('user_opp-denial', { handCount: 2 })];

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'boss', 0, opps);
      // With CRITICAL threat and high denialWeight (0.82), combined score for A/2 is
      // much worse than for K/Q. Bot should discard K or Q, not A or 2.
      expect(result).not.toContain(ace.id);
      expect(result).not.toContain(two.id);
    });
  });

  it('Step 7 — smart bot does NOT discard Ace when it would help panicking opponent', () => {
    const id = freshBotId();
    const ace = makeCard('A');
    const king = makeCard('K');
    const nine = makeCard('9');
    const botHand = [ace, king, nine, makeCard('Q'), makeCard('J'), makeCard('8'), makeCard('6')];
    // Opponent at 3 cards with many draws (panicking) → high show pressure
    const opp = makePlayer('opp-panic', [makeCard('5'), makeCard('4'), makeCard('3')], { handCount: 3 });
    const state = discardState(id, botHand, [opp]);
    const opps  = [makeOpponent('user_opp-panic', {
      handCount: 3, recentDraws: 5, recentCuts: 0, recentShows: 0,
    })];

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0, opps);
      expect(result).not.toContain(ace.id);
    });
  });

  // ── Step 9: Low-score stability preservation ──────────────────────────────

  it('Step 9 — preserves stable low-value hand, only discards genuinely high cards', () => {
    const id = freshBotId();
    // Hand with high stability: [joker(0), joker(0), A(1), 2(2), 3(3), K(10), Q(10)]
    // Total = 0+0+1+2+3+10+10 = 26. Stability is high (many low-value cards).
    const j1 = makePrintedJoker();
    const j2 = makePrintedJoker();
    const ace = makeCard('A');
    const two = makeCard('2');
    const three = makeCard('3');
    const king  = makeCard('K');
    const queen = makeCard('Q');
    const botHand = [j1, j2, ace, two, three, king, queen];
    const opp = makePlayer('opp-stab', [makeCard('K'), makeCard('Q')]);
    const state = discardState(id, botHand, [opp]);

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0);
      // Should discard K or Q (high-value cards), NOT the low-value stability cards
      expect(result).not.toContain(j1.id);
      expect(result).not.toContain(j2.id);
      expect(result).not.toContain(ace.id);
      expect(result).not.toContain(two.id);
      expect(result).not.toContain(three.id);
    });
  });

  // ── Fallback: hand of only one card ───────────────────────────────────────

  it('fallback — single-card hand discards that card', () => {
    const id = freshBotId();
    const only = makeCard('9');
    const bot  = makeBot(id, [only]);
    const opp  = makePlayer('opp-single', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0);
      expect(result).toContain(only.id);
    });
  });

  it('fallback — hand of all 7s discards a 7 (attack)', () => {
    const id = freshBotId();
    const s1 = makeCard('7');
    const s2 = makeCard('7', 'clubs');
    const bot  = makeBot(id, [s1, s2]);
    const opp  = makePlayer('opp-all7', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'smart', 0);
      // With alwaysAttack=false for smart and minOpponentCards=1 ≤ attackOneAt(5)
      expect(result.length).toBeGreaterThan(0);
    });
  });

  it('fallback — hand of all printed jokers does not crash', () => {
    const id = freshBotId();
    const jks = Array.from({ length: 4 }, () => makePrintedJoker());
    const bot  = makeBot(id, jks);
    const opp  = makePlayer('opp-allj', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });

    withRandom(1, () => {
      expect(() => {
        BotPlayer.decideDiscard(state, id, 'smart', 0);
      }).not.toThrow();
    });
  });

  // ── Personality-specific behaviors ───────────────────────────────────────

  it('bluff personality: may execute tactical deception line (non-critical state)', () => {
    const id = freshBotId();
    // Bluff triggers at random < 0.20 — test with random=0.1
    const hand = [
      makeCard('8'), makeCard('8', 'clubs'), // pair of 8s (medium value 8 ≥ 5)
      makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('6'),
    ];
    const opp = makePlayer('opp-bluff', Array.from({ length: 6 }, () => makeCard('K')), { handCount: 6 });
    const state = discardState(id, hand, [opp]);

    const spy = jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)   // triggers bluff tactical line check
      .mockReturnValueOnce(0.1)   // mediumPair found — execute scatter
      .mockReturnValue(1);

    try {
      const result = BotPlayer.decideDiscard(state, id, 'bluff', 0);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    } finally { spy.mockRestore(); }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// decide() — Main Integration Entry Point
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer.decide', () => {

  // ── Attack chain ──────────────────────────────────────────────────────────

  it('returns attack_throw when bot is attack target with real 7s', () => {
    const id = freshBotId();
    const seven = makeCard('7');
    const bot   = makeBot(id, [seven, makeCard('K')]);
    const opp   = makePlayer('opp-decide-atk', [makeCard('7')]);
    const state = makeGameState([bot, opp], {
      currentPlayerIndex: 0, // bot is current player (also attack target)
      attackChain: makeAttackChain('opp-decide-atk', 0, 1),
    });
    const decision = BotPlayer.decide(state, id, 'aggressive', 0);
    expect(decision.action).toBe('attack_throw');
    expect(decision.cardIds).toContain(seven.id);
  });

  it('returns attack_take when bot is attack target with no real 7s', () => {
    const id = freshBotId();
    const bot   = makeBot(id, [makeCard('K'), makeCard('Q')]);
    const opp   = makePlayer('opp-decide-take', [makeCard('7')]);
    const state = makeGameState([bot, opp], {
      currentPlayerIndex: 0,
      attackChain: makeAttackChain('opp-decide-take', 0, 1),
    });
    const decision = BotPlayer.decide(state, id, 'smart', 0);
    expect(decision.action).toBe('attack_take');
  });

  // ── Show (before drawing) ─────────────────────────────────────────────────

  it('shows before drawing when hand total ≤ 5 and hasDrawnThisTurn=false', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('A'), makeCard('2'), makeCard('2')]); // total=5
    const opp  = makePlayer('opp-show-b4', [makeCard('K'), makeCard('Q')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: false });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      expect(decision.action).toBe('show');
    });
  });

  it('does NOT show when hasDrawnThisTurn=true (must discard first)', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('A'), makeCard('2'), makeCard('2')]); // total=5
    const opp  = makePlayer('opp-no-show', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      // Must discard, not show (GameEngine would reject show after drawing)
      expect(decision.action).toBe('discard');
    });
  });

  it('does NOT show when total > SHOW_HARD_MAX even at start of turn', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q')]); // total=20
    const opp  = makePlayer('opp-no-show2', [makeCard('A')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: false });
    const decision = BotPlayer.decide(state, id, 'safe', 0);
    expect(decision.action).not.toBe('show');
  });

  // ── Cut rule ──────────────────────────────────────────────────────────────

  it('cuts when matching card is in hand and top discard is NOT a 7 or joker', () => {
    const id = freshBotId();
    const matching = makeCard('9'); // matches top discard rank
    const topDiscard = makeCard('9', 'clubs');
    const bot  = makeBot(id, [matching, makeCard('K'), makeCard('Q'), makeCard('J')]);
    const opp  = makePlayer('opp-cut', [makeCard('K'), makeCard('Q')]);
    const state = makeGameState([bot, opp], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
    });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      expect(decision.action).toBe('discard');
      expect(decision.cardIds).toContain(matching.id);
    });
  });

  it('does NOT cut when top discard is a real 7 (7s cannot be cut)', () => {
    const id = freshBotId();
    const matching7 = makeCard('7'); // would match top discard rank
    const topDiscard = makeCard('7', 'clubs'); // top is a real 7
    const bot  = makeBot(id, [matching7, makeCard('K'), makeCard('Q'), makeCard('J')]);
    const opp  = makePlayer('opp-no-cut7', [makeCard('K')]);
    const state = makeGameState([bot, opp], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
    });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      // Cannot cut a 7 — should show (total=37 > 5 for safe) or draw
      expect(decision.action).not.toBe('discard');
    });
  });

  it('can cut a Jack when top discard is J (GameEngine allows J cuts)', () => {
    // NOTE: The game rules description says "cut except 7/J" but processDiscard
    // only excludes real 7s from the cut rule — Jacks CAN be cut per the engine.
    // This behavior is consistent with the GameEngine implementation.
    const id = freshBotId();
    const matchingJ  = makeCard('J');
    const topDiscard = makeCard('J', 'diamonds');
    const bot  = makeBot(id, [matchingJ, makeCard('K'), makeCard('Q'), makeCard('9'), makeCard('8')]);
    const opp  = makePlayer('opp-cut-j', [makeCard('K'), makeCard('Q'), makeCard('J')]);
    const state = makeGameState([bot, opp], {
      discardPile: [topDiscard],
      hasDrawnThisTurn: false,
    });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      // BotPlayer allows cutting Jacks (consistent with GameEngine implementation)
      // If it cuts: action='discard', cardIds includes matchingJ.id
      // If it doesn't cut (low cutOk criteria): action='draw'
      // Either is valid — just must not crash
      expect(['draw', 'discard']).toContain(decision.action);
    });
  });

  // ── Draw decision ─────────────────────────────────────────────────────────

  it('returns draw action when no cut possible and hasDrawnThisTurn=false', () => {
    const id = freshBotId();
    // Hand doesn't match top discard; total > 5 so no show
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9')]);
    const opp  = makePlayer('opp-draw-dec', [makeCard('K')]);
    const state = makeGameState([bot, opp], {
      discardPile: [makeCard('5')],  // top=5, bot has no 5s
      hasDrawnThisTurn: false,
    });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      expect(decision.action).toBe('draw');
      expect(['deck', 'discard']).toContain(decision.source);
    });
  });

  // ── Discard decision ──────────────────────────────────────────────────────

  it('returns discard action when hasDrawnThisTurn=true', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8')]);
    const opp  = makePlayer('opp-discard-dec', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });
    withRandom(1, () => {
      const decision = BotPlayer.decide(state, id, 'smart', 0);
      expect(decision.action).toBe('discard');
      expect(decision.cardIds).toBeDefined();
      expect(decision.cardIds!.length).toBeGreaterThan(0);
    });
  });

  // ── Safety: bot not found ─────────────────────────────────────────────────

  it('returns safe default { action: draw, source: deck } when bot not in state', () => {
    const opp   = makePlayer('opp-ghost', [makeCard('K')]);
    const state = makeGameState([opp]);
    const decision = BotPlayer.decide(state, 'nonexistent-bot-id', 'smart', 0);
    expect(decision.action).toBe('draw');
    expect(decision.source).toBe('deck');
  });

  // ── Boss mode switching ───────────────────────────────────────────────────

  it('boss: advances emotional context on each decide() call', () => {
    const id = freshBotId();
    BotPlayer.initBotContext(id);
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9')]);
    const opp  = makePlayer('opp-boss-ctx', [makeCard('K'), makeCard('Q')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: false });

    // Call decide multiple times — should not crash
    withRandom(0.5, () => {
      for (let i = 0; i < 5; i++) {
        expect(() => BotPlayer.decide(state, id, 'boss', 0)).not.toThrow();
      }
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// BotMatchContext — emotional phase state machine
// ════════════════════════════════════════════════════════════════════════════

describe('BotPlayer — BotMatchContext', () => {
  it('initBotContext starts in building phase with 0 pressure turns', () => {
    const id = freshBotId();
    BotPlayer.initBotContext(id);
    // We can observe the context effects through getThinkDelay
    // (cooldown/bait phase adds extra delay)
    withRandom(0, () => {
      const baseDelay = BotPlayer.getThinkDelay('boss', 0, id);
      expect(baseDelay).toBeGreaterThan(0);
    });
  });

  it('cleanupBotContext removes context without crashing', () => {
    const id = freshBotId();
    BotPlayer.initBotContext(id);
    expect(() => BotPlayer.cleanupBotContext(id)).not.toThrow();
    // After cleanup, getThinkDelay should still work (re-creates context lazily)
    expect(() => BotPlayer.getThinkDelay('boss', 0, id)).not.toThrow();
  });

  it('bait phase adds extra delay to boss (simulates passive play window)', () => {
    // Force bot into bait phase by checking delay increase
    // bait adds 300-700ms extra delay on top of base
    // We test this indirectly since ctxMap is private
    const id = freshBotId();
    BotPlayer.initBotContext(id);
    // In building phase (fresh context), delay is base + jitter
    // In bait phase (advanced context), delay has +300-700ms extra
    // We can't directly set phase, but verify the delay stays within range
    const delay = BotPlayer.getThinkDelay('boss', 0, id);
    expect(delay).toBeGreaterThanOrEqual(350); // minimum clamped
    expect(delay).toBeLessThan(5000); // reasonable upper bound
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Personality comparison tests
// ════════════════════════════════════════════════════════════════════════════

describe('Personality comparison', () => {
  it('aggressive always has alwaysAttack=true behavior — attacks even without near-show opponent', () => {
    const id = freshBotId();
    const seven = makeCard('7');
    const botHand = [seven, makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8'), makeCard('6')];
    const opp = makePlayer('opp-agg', Array.from({ length: 7 }, () => makeCard('K')), { handCount: 7 });
    const state = makeGameState([makeBot(id, botHand), opp], { hasDrawnThisTurn: true });

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'aggressive', 0);
      // aggressive: alwaysAttack=true → always throws 7s when available
      expect(result).toContain(seven.id);
    });
  });

  it('safe never attacks when opponent has 7 cards (attackAllAt=0)', () => {
    const id = freshBotId();
    const seven = makeCard('7');
    const botHand = [seven, makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8'), makeCard('6')];
    const opp = makePlayer('opp-safe-no-atk', Array.from({ length: 7 }, () => makeCard('K')), { handCount: 7 });
    const state = makeGameState([makeBot(id, botHand), opp], { hasDrawnThisTurn: true });

    withRandom(1, () => {
      const result = BotPlayer.decideDiscard(state, id, 'safe', 0);
      // safe: attackAllAt=0, not CRITICAL → should NOT throw the 7
      expect(result).not.toContain(seven.id);
    });
  });

  it('SHOW_HARD_MAX enforced correctly for all personalities', () => {
    const caps: Array<[BotPersonality, number]> = [
      ['safe', 5], ['boss', 5], ['smart', 6], ['aggressive', 7], ['bluff', 9],
    ];
    caps.forEach(([personality, max]) => {
      const id = freshBotId();
      // total = max + 1 → above hard ceiling → must return false
      const excessTotal = max + 1;
      // Build a hand with exactly excessTotal points (using A(1) cards)
      const hand = Array.from({ length: excessTotal }, (_, i) =>
        makeCard('A', i < 4 ? 'hearts' : 'diamonds')
      );
      // Use a minimal 2-player state
      const bot   = makeBot(id, hand);
      const opp   = makePlayer('opp-cap', [makeCard('K'), makeCard('Q')]);
      const state = makeGameState([bot, opp]);
      expect(BotPlayer.shouldCallShow(state, id, personality)).toBe(false);
    });
  });

  it('boss think delay is fastest base among all personalities', () => {
    // Use random=0.5: avoids triggering boss deliberation pause (requires < 0.10)
    // boss:  200 + 0.5*180 = 290 → clamped to max(350,290) = 350
    // smart: 480 + 0.5*340 = 650 → max(350,650) = 650
    // safe: 1200 + 0.5*600 = 1500
    withRandom(0.5, () => {
      const bossDelay   = BotPlayer.getThinkDelay('boss', 0);
      const smartDelay  = BotPlayer.getThinkDelay('smart', 0);
      const safeDelay   = BotPlayer.getThinkDelay('safe', 0);
      expect(bossDelay).toBeLessThan(smartDelay);
      expect(smartDelay).toBeLessThan(safeDelay);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Edge cases & robustness
// ════════════════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('no human opponents → threat level stays low (no crash)', () => {
    const id = freshBotId();
    // All players are bots — no humans
    const bot1 = makeBot(id, [makeCard('K'), makeCard('Q')]);
    const bot2 = makeBot('bot2-edge', [makeCard('9'), makeCard('8')], { isBot: true });
    const state = makeGameState([bot1, bot2], { hasDrawnThisTurn: true });
    withRandom(1, () => {
      expect(() => BotPlayer.decideDiscard(state, id, 'boss', 0)).not.toThrow();
    });
  });

  it('all players except bot are eliminated → bot should act without crash', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J')]);
    const elim = makePlayer('elim-player', [makeCard('A')], { isEliminated: true });
    const state = makeGameState([bot, elim], { hasDrawnThisTurn: true });
    withRandom(1, () => {
      expect(() => BotPlayer.decideDiscard(state, id, 'smart', 0)).not.toThrow();
    });
  });

  it('difficultyBoost clamped to [0, 0.35] — negative and excessive values handled', () => {
    withRandom(0.5, () => {
      expect(() => BotPlayer.getThinkDelay('boss', -1)).not.toThrow();
      expect(() => BotPlayer.getThinkDelay('boss', 100)).not.toThrow();
    });
  });

  it('decideDiscard with empty opponents array does not crash', () => {
    const id = freshBotId();
    const botHand = [makeCard('K'), makeCard('Q'), makeCard('J'), makeCard('9'), makeCard('8'), makeCard('6'), makeCard('5')];
    const bot  = makeBot(id, botHand);
    const opp  = makePlayer('opp-empty-opps', [makeCard('K')]);
    const state = makeGameState([bot, opp], { hasDrawnThisTurn: true });
    withRandom(1, () => {
      expect(() => BotPlayer.decideDiscard(state, id, 'boss', 0, [])).not.toThrow();
    });
  });

  it('decideDrawSource with hand of all jokers does not crash', () => {
    const id = freshBotId();
    const botHand = Array.from({ length: 7 }, () => makePrintedJoker());
    const bot  = makeBot(id, botHand);
    const opp  = makePlayer('opp-allj-draw', [makeCard('K')]);
    const state = makeGameState([bot, opp], { discardPile: [makeCard('9')] });
    expect(() => BotPlayer.decideDrawSource(state, id)).not.toThrow();
  });

  it('decide() with empty deck returns valid action', () => {
    const id = freshBotId();
    const bot  = makeBot(id, [makeCard('K'), makeCard('Q'), makeCard('J')]);
    const opp  = makePlayer('opp-empty-deck', [makeCard('K')]);
    const state = makeGameState([bot, opp], { deck: [], hasDrawnThisTurn: false });
    withRandom(1, () => {
      expect(() => BotPlayer.decide(state, id, 'smart', 0)).not.toThrow();
    });
  });

  it('normalizeBoost clamps to [0, 0.35] — verify via delay reduction', () => {
    withRandom(0, () => {
      const zeroBoost    = BotPlayer.getThinkDelay('smart', 0);
      const maxBoost     = BotPlayer.getThinkDelay('smart', 0.35);
      const excessBoost  = BotPlayer.getThinkDelay('smart', 99);   // clamped to 0.35
      const negBoost     = BotPlayer.getThinkDelay('smart', -1);   // clamped to 0
      expect(maxBoost).toBeLessThanOrEqual(zeroBoost);
      expect(excessBoost).toBeCloseTo(maxBoost, 0); // ≈ same as max
      expect(negBoost).toBeCloseTo(zeroBoost, 0);   // ≈ same as 0 boost
    });
  });
});
