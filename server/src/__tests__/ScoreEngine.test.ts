import { ScoreEngine } from '../engine/ScoreEngine';
import { makeCard, makePlayer, makeGameState } from './helpers';

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { (console.log as jest.Mock).mockRestore(); });

describe('ScoreEngine', () => {

  // ── calculateRoundResult ─────────────────────────────────────────────────────

  describe('calculateRoundResult — show success', () => {
    it('show caller with lowest hand gets 0 round points', () => {
      const bot  = makePlayer('bot',   [makeCard('A'), makeCard('2'), makeCard('2')]);  // total=5
      const opp  = makePlayer('opp',   [makeCard('K'), makeCard('Q'), makeCard('J')]);  // total=30
      const state = makeGameState([bot, opp], { hasDrawnThisTurn: false });

      const result = ScoreEngine.calculateRoundResult(state, 'bot');
      expect(result.showPlayerWon).toBe(true);
      const callerResult = result.playerResults.find(r => r.playerId === 'bot')!;
      expect(callerResult.roundPoints).toBe(0);
    });

    it('losers pay their own hand total when show succeeds', () => {
      const bot  = makePlayer('bot',  [makeCard('A'), makeCard('2'), makeCard('2')]);  // total=5
      const opp1 = makePlayer('opp1', [makeCard('K'), makeCard('Q')]);                // total=20
      const opp2 = makePlayer('opp2', [makeCard('9'), makeCard('6'), makeCard('4')]); // total=19
      const state = makeGameState([bot, opp1, opp2]);

      const result = ScoreEngine.calculateRoundResult(state, 'bot');
      const r1 = result.playerResults.find(r => r.playerId === 'opp1')!;
      const r2 = result.playerResults.find(r => r.playerId === 'opp2')!;
      expect(r1.roundPoints).toBe(20);
      expect(r2.roundPoints).toBe(19);
    });

    it('show caller wins the tie (same total as another player)', () => {
      const caller = makePlayer('caller', [makeCard('3'), makeCard('2')]);  // total=5
      const other  = makePlayer('other',  [makeCard('4'), makeCard('A')]); // total=5
      const state  = makeGameState([caller, other]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      expect(result.showPlayerWon).toBe(true);
      expect(result.winnerIds).toEqual(['caller']);
    });
  });

  describe('calculateRoundResult — show fail', () => {
    it('failed caller pays sum of ALL active players hand totals', () => {
      const caller = makePlayer('caller', [makeCard('K'), makeCard('Q')]);       // total=20
      const winner = makePlayer('winner', [makeCard('A'), makeCard('2')]);        // total=3
      const other  = makePlayer('other',  [makeCard('7'), makeCard('6')]);        // total=13
      const state  = makeGameState([caller, winner, other]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      expect(result.showPlayerWon).toBe(false);
      const callerResult = result.playerResults.find(r => r.playerId === 'caller')!;
      // Penalty = sum of all: 20 + 3 + 13 = 36
      expect(callerResult.roundPoints).toBe(36);
    });

    it('actual lowest-hand players get 0 when show fails', () => {
      const caller = makePlayer('caller', [makeCard('K'), makeCard('Q')]);   // total=20
      const winner = makePlayer('winner', [makeCard('A'), makeCard('2')]);   // total=3
      const state  = makeGameState([caller, winner]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      const winnerResult = result.playerResults.find(r => r.playerId === 'winner')!;
      expect(winnerResult.roundPoints).toBe(0);
    });

    it('other non-winning players pay their own hand total when show fails', () => {
      const caller = makePlayer('caller', [makeCard('K')]);                  // total=10
      const winner = makePlayer('winner', [makeCard('A')]);                  // total=1
      const bystander = makePlayer('by',  [makeCard('9'), makeCard('5')]);   // total=14
      const state  = makeGameState([caller, winner, bystander]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      const byResult = result.playerResults.find(r => r.playerId === 'by')!;
      expect(byResult.roundPoints).toBe(14);
    });

    it('multiple players tie at minimum — all get 0 when show fails', () => {
      const caller = makePlayer('caller', [makeCard('K'), makeCard('K')]);   // total=20
      const tied1  = makePlayer('tied1',  [makeCard('3'), makeCard('2')]);   // total=5
      const tied2  = makePlayer('tied2',  [makeCard('4'), makeCard('A')]);   // total=5
      const state  = makeGameState([caller, tied1, tied2]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      expect(result.winnerIds).toContain('tied1');
      expect(result.winnerIds).toContain('tied2');
      const r1 = result.playerResults.find(r => r.playerId === 'tied1')!;
      const r2 = result.playerResults.find(r => r.playerId === 'tied2')!;
      expect(r1.roundPoints).toBe(0);
      expect(r2.roundPoints).toBe(0);
    });
  });

  describe('calculateRoundResult — edge rules', () => {
    it('score of 1 is rounded up to 2 (minimum non-zero penalty)', () => {
      // Caller fails, winner has joker (0 pts), loser has Ace (1 pt → rounded to 2)
      const caller = makePlayer('caller', [makeCard('K'), makeCard('Q')]); // total=20
      const winner = makePlayer('winner', [makeCard('A', 'clubs', { isJoker: true })]); // total=0 (joker)
      const loser  = makePlayer('loser',  [makeCard('A')]);                // total=1 → penalty=2
      const state  = makeGameState([caller, winner, loser]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      // Caller fails: winner has 0, loser has 1 which rounds up to 2
      expect(result.showPlayerWon).toBe(false);
      const loserResult = result.playerResults.find(r => r.playerId === 'loser')!;
      expect(loserResult.roundPoints).toBe(2); // 1 → rounded up to 2
    });

    it('eliminated players get 0 points regardless', () => {
      const caller   = makePlayer('caller',   [makeCard('A')]);  // total=1
      const elim     = makePlayer('elim',     [makeCard('K'), makeCard('Q')], { isEliminated: true });
      const active   = makePlayer('active',   [makeCard('9')]);  // total=9
      const state    = makeGameState([caller, elim, active]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      const elimResult = result.playerResults.find(r => r.playerId === 'elim')!;
      expect(elimResult.roundPoints).toBe(0);
    });

    it('totalScore is cumulative (added to existing totalScore)', () => {
      const caller = makePlayer('caller', [makeCard('A')], { totalScore: 15 }); // already has 15
      const opp    = makePlayer('opp',    [makeCard('K'), makeCard('9')]);       // total=19
      const state  = makeGameState([caller, opp]);

      const result = ScoreEngine.calculateRoundResult(state, 'caller');
      const callerResult = result.playerResults.find(r => r.playerId === 'caller')!;
      expect(callerResult.totalScore).toBe(15); // 0 round points + 15 existing
      const oppResult = result.playerResults.find(r => r.playerId === 'opp')!;
      expect(oppResult.totalScore).toBe(19);
    });
  });

  // ── checkMatchOver ───────────────────────────────────────────────────────────

  describe('checkMatchOver', () => {
    it('returns null when rounds remain', () => {
      const p1 = makePlayer('p1', [makeCard('A')]);
      const p2 = makePlayer('p2', [makeCard('K')]);
      const state = makeGameState([p1, p2], { roundNumber: 1, roundCount: 3 });
      expect(ScoreEngine.checkMatchOver(state)).toBeNull();
    });

    it('returns match result on last round', () => {
      const p1 = makePlayer('p1', [makeCard('A')], { totalScore: 10 });
      const p2 = makePlayer('p2', [makeCard('K')], { totalScore: 25 });
      // Need roundResult populated
      const state = makeGameState([p1, p2], {
        roundNumber: 3,
        roundCount: 3,
        roundResult: {
          winnerId: 'p1',
          winnerIds: ['p1'],
          showPlayerId: 'p1',
          showPlayerWon: true,
          playerResults: [
            { playerId: 'p1', username: 'Player_p1', hand: [], roundPoints: 0, totalScore: 10 },
            { playerId: 'p2', username: 'Player_p2', hand: [], roundPoints: 15, totalScore: 25 },
          ],
          nextRoundIn: 6000,
        },
      });

      const result = ScoreEngine.checkMatchOver(state);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe('p1');
    });

    it('returns early when only 1 active player remains', () => {
      const winner = makePlayer('winner', [makeCard('A')]);
      const elim   = makePlayer('elim',   [makeCard('K')], { isEliminated: true });
      const state  = makeGameState([winner, elim], { roundNumber: 1, roundCount: 5 });
      const result = ScoreEngine.checkMatchOver(state);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe('winner');
    });
  });
});
