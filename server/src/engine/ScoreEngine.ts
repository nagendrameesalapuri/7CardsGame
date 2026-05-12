import { GameState, RoundResult, MatchResult, PlayerRoundResult } from '../../../shared/src/types';
import { DeckManager } from './DeckManager';

export class ScoreEngine {
  /**
   * Called when a player declares SHOW.
   *
   * SHOW SUCCESS (show caller has the lowest hand):
   *   - Show caller wins → 0 round points.
   *   - All other players pay their own hand total.
   *
   * SHOW FAIL (show caller does NOT have the lowest hand):
   *   - Actual lowest-hand player(s) win → 0 round points each.
   *   - Failed show caller pays the SUM of ALL active players' hand totals
   *     (their own hand + every other player's hand, including the winner's).
   *     Example: caller=4, winner=3, other=7 → penalty = 4+3+7 = 14
   *   - All other non-winning players pay their own hand total normally.
   *
   * Ties: if show fails and multiple players share the minimum hand total,
   * all tied players win (0 pts each). Show caller still pays the full sum.
   *
   * Score of 1 is treated as 2 (minimum non-zero penalty).
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

    // Show caller wins on tie — declared first gets the edge
    const showPlayerWon = showPlayerTotal <= minTotal;

    const winnerIds = showPlayerWon
      ? [showPlayerId]
      : totals.filter(t => t.handTotal === minTotal).map(t => t.player.id);

    const primaryWinnerId = winnerIds[0];

    // Failed SHOW penalty = sum of ALL active players' hand totals (incl. show caller's own)
    // This is larger than the old (showPlayerTotal + minTotal) formula which was incorrect.
    const failedShowPenalty = totals.reduce((sum, t) => sum + scoreableTotal(t.handTotal), 0);

    const playerResults: PlayerRoundResult[] = state.players.map(p => {
      if (p.isEliminated) {
        return { playerId: p.id, username: p.username, hand: p.hand, roundPoints: 0, totalScore: p.totalScore };
      }

      let roundPoints: number;
      if (winnerIds.includes(p.id)) {
        roundPoints = 0;
      } else if (!showPlayerWon && p.id === showPlayerId) {
        roundPoints = failedShowPenalty;
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

    // Debug log
    console.log('[ScoreEngine] Round result:', {
      showCaller: showPlayerEntry.player.username,
      showCallerPoints: showPlayerTotal,
      showPlayerWon,
      actualWinners: winnerIds.map(id => state.players.find(p => p.id === id)?.username),
      lowestPoints: minTotal,
      penaltyApplied: showPlayerWon ? 0 : failedShowPenalty,
      playerRoundPoints: playerResults.map(r => `${r.username}: +${r.roundPoints} (total ${r.totalScore})`),
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
