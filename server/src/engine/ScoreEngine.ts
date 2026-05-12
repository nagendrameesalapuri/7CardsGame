import { GameState, RoundResult, MatchResult, PlayerRoundResult } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export class ScoreEngine {
  /**
   * Called when a player declares SHOW.
   *
   * Winner determination:
   *  - Show player wins alone when their total ≤ minTotal (declared first → gets the edge).
   *    winnerIds = [showPlayerId] → only they receive 0 round points.
   *  - Show player fails (their total > minTotal) → ALL players tied at minTotal share the win.
   *    winnerIds = every player whose handTotal === minTotal → each gets 0 round points.
   *  - Show player who fails pays penalty = their hand total + minTotal.
   *  - All other non-winning players pay their own hand total.
   */
  static calculateRoundResult(state: GameState, showPlayerId: string): RoundResult {
    const activePlayers = state.players.filter(p => !p.isEliminated);

    // Score of 1 is rounded up to 2 (minimum non-zero penalty)
    const scoreableTotal = (n: number) => (n === 1 ? 2 : n);

    const totals = activePlayers.map(p => ({
      player: p,
      handTotal: DeckManager.calculateHandTotal(p.hand),
    }));

    const minTotal = Math.min(...totals.map(t => t.handTotal));
    const showPlayerEntry = totals.find(t => t.player.id === showPlayerId)!;
    const showPlayerTotal = showPlayerEntry.handTotal;

    // Show caller wins on tie — declared first, gets the edge
    const showPlayerWon = showPlayerTotal <= minTotal;

    // When show wins: only show player gets 0 pts (sole winner even if others tie)
    // When show fails: every player at minTotal gets 0 pts
    const winnerIds = showPlayerWon
      ? [showPlayerId]
      : totals.filter(t => t.handTotal === minTotal).map(t => t.player.id);

    const primaryWinnerId = winnerIds[0];

    // Penalty for failed show = show player's own total + the minimum total
    const failedShowPenalty = showPlayerTotal + minTotal;

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
      if (winnerIds.includes(p.id)) {
        roundPoints = 0;                                           // winner(s) — 0 pts
      } else if (!showPlayerWon && p.id === showPlayerId) {
        roundPoints = failedShowPenalty;                          // failed show penalty
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
      winnerId: primaryWinnerId,
      winnerIds,
      showPlayerId,
      showPlayerWon,
      playerResults,
      nextRoundIn: 6000,
    };
  }

  /**
   * Check if the match is over.
   * Supports ties — all players sharing the minimum cumulative score are co-winners.
   */
  static checkMatchOver(state: GameState): MatchResult | null {
    const active = state.players.filter(p => !p.isEliminated);

    // Early end — only one active player
    if (active.length <= 1) {
      const winner = active[0] ?? state.players[0];
      return {
        winnerId: winner.id,
        winnerIds: [winner.id],
        winnerUsername: winner.username,
        finalScores: state.players.map(p => ({
          playerId: p.id,
          username: p.username,
          totalScore: p.totalScore,
        })),
      };
    }

    if (state.roundNumber < state.roundCount) return null;

    // All rounds played — find player(s) with lowest cumulative score
    const results = state.roundResult?.playerResults ?? [];
    const activeResults = results.filter(r =>
      !state.players.find(p => p.id === r.playerId)?.isEliminated
    );

    const minScore = Math.min(...activeResults.map(r => r.totalScore));
    const matchWinners = activeResults.filter(r => r.totalScore === minScore);
    const primary = matchWinners[0];

    return {
      winnerId: primary.playerId,
      winnerIds: matchWinners.map(r => r.playerId),
      winnerUsername: matchWinners.map(r => r.username).join(' & '),
      finalScores: results.map(r => ({
        playerId: r.playerId,
        username: r.username,
        totalScore: r.totalScore,
      })),
    };
  }
}
