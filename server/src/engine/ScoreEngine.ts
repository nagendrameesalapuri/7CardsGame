import { GameState, RoundResult, MatchResult, PlayerRoundResult } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export class ScoreEngine {
  /**
   * Called when a player says SHOW.
   *
   * Winner determination:
   *  - If SHOW player has the strictly lowest (or tied-lowest) hand total → they win (0 pts).
   *  - Otherwise → the player with the actual lowest total wins;
   *    SHOW player receives the sum of ALL other players' hand totals as penalty;
   *    losing non-SHOW players receive their own hand total.
   *
   * No elimination — everyone plays all rounds; lowest cumulative score wins.
   */
  static calculateRoundResult(state: GameState, showPlayerId: string): RoundResult {
    const activePlayers = state.players.filter(p => !p.isEliminated);

    // Minimum scoreable total is 2 (a total of 1 is rounded up to 2)
    const scoreableTotal = (n: number) => (n === 1 ? 2 : n);

    const totals = activePlayers.map(p => ({
      player: p,
      handTotal: DeckManager.calculateHandTotal(p.hand),
    }));

    const minTotal = Math.min(...totals.map(t => t.handTotal));
    const showPlayerEntry = totals.find(t => t.player.id === showPlayerId)!;
    const showPlayerTotal = showPlayerEntry.handTotal;

    // Show caller wins on tie — they declared first so they get the edge
    const showPlayerWon = showPlayerTotal <= minTotal;

    const winnerEntry = showPlayerWon
      ? showPlayerEntry
      : totals.find(t => t.handTotal === minTotal)!;

    // Penalty for failed show = sum of all other active players' scoreable totals
    const opponentSum = totals
      .filter(t => t.player.id !== showPlayerId)
      .reduce((sum, t) => sum + scoreableTotal(t.handTotal), 0);

    const playerResults: PlayerRoundResult[] = state.players.map(p => {
      if (p.isEliminated) {
        return {
          playerId: p.id,
          username: p.username,
          hand: p.hand,
          roundPoints: 0,
          totalScore: p.totalScore,
        };
      }

      let roundPoints: number;
      if (p.id === winnerEntry.player.id) {
        roundPoints = 0;
      } else if (!showPlayerWon && p.id === showPlayerId) {
        roundPoints = opponentSum;
      } else {
        roundPoints = scoreableTotal(totals.find(t => t.player.id === p.id)!.handTotal);
      }

      return {
        playerId: p.id,
        username: p.username,
        hand: p.hand,
        roundPoints,
        totalScore: p.totalScore + roundPoints,
      };
    });

    return {
      winnerId: winnerEntry.player.id,
      showPlayerId,
      showPlayerWon,
      playerResults,
      nextRoundIn: 6000,
    };
  }

  /**
   * Check if the match is over.
   * Ends when all rounds have been played (roundNumber >= roundCount),
   * or early if only one active player remains.
   * Winner = player with the lowest cumulative score.
   */
  static checkMatchOver(state: GameState): MatchResult | null {
    const active = state.players.filter(p => !p.isEliminated);

    // Early end if only one player left
    if (active.length <= 1) {
      const winner = active[0] ?? state.players[0];
      return {
        winnerId: winner.id,
        winnerUsername: winner.username,
        finalScores: state.players.map(p => ({
          playerId: p.id,
          username: p.username,
          totalScore: p.totalScore,
        })),
      };
    }

    // Not done yet
    if (state.roundNumber < state.roundCount) return null;

    // All rounds played — winner has lowest total (using updated scores from roundResult)
    const results = state.roundResult?.playerResults ?? [];
    const activeResults = results.filter(r =>
      !state.players.find(p => p.id === r.playerId)?.isEliminated
    );

    const winner = activeResults.reduce(
      (best, r) => r.totalScore < best.totalScore ? r : best,
      activeResults[0]
    );

    return {
      winnerId: winner.playerId,
      winnerUsername: winner.username,
      finalScores: results.map(r => ({
        playerId: r.playerId,
        username: r.username,
        totalScore: r.totalScore,
      })),
    };
  }
}
