import { Server } from 'socket.io';
import { ScheduledTournament } from '../models/ScheduledTournament';
import { Room } from '../models/Room';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { sendNotification } from '../services/fcmService';

// ── Game bridge (avoids circular import with gameHandler) ─────────────────────
type StartRoomGameFn = (io: Server, roomCode: string, opts?: { disableElimination?: boolean }) => Promise<void>;
let _startRoomGame: StartRoomGameFn | null = null;

export function registerTournamentGameBridge(fn: StartRoomGameFn): void {
  _startRoomGame = fn;
}

// ── Room code generator ───────────────────────────────────────────────────────
async function generateTournamentRoomCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = 'T';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const exists = await Room.findOne({ code }).select('_id').lean();
    if (!exists) return code;
  }
  throw new Error('Could not generate unique tournament room code');
}

// ── Create and start a tournament room for a set of players ──────────────────
async function createAndStartTournamentRoom(
  io: Server,
  tournament: any,
  survivors: any[],
  round: number,
): Promise<void> {
  if (!_startRoomGame) {
    console.error('[Tournament] Game bridge not registered — cannot start tournament room');
    return;
  }

  const roomCode = await generateTournamentRoomCode();

  const humanSurvivors = survivors.filter((r: any) => !r.isBot);
  const firstHost = humanSurvivors[0] ?? survivors[0];

  await Room.create({
    code: roomCode,
    name: `${tournament.name} — Round ${round}`,
    hostId: String(firstHost.userId),
    status: 'waiting',
    matchState: 'forming',
    players: survivors.map((r: any, idx: number) => ({
      userId: String(r.userId),
      username: r.username,
      avatar: r.avatar ?? 'avatar_1',
      isReady: true,
      isHost: idx === 0,
      isBot: r.isBot ?? false,
    })),
    config: {
      maxPlayers: survivors.length,
      botCount: 0, // bots already embedded in players array above
      roundCount: 1,
      turnTimeLimit: 20,
      isPrivate: true,
      allowBots: false,
      entryFee: 0,
    },
    paidPlayerIds: [],
    heldPlayerIds: [],
  });

  // Update tournament state
  tournament.currentRound = round;
  tournament.activeRoomCode = roomCode;
  await tournament.save();

  // Start game immediately — players reconnect via game:can_resume
  await _startRoomGame(io, roomCode, { disableElimination: true });

  // Notify only human survivors (bots need no notification)
  for (const reg of humanSurvivors) {
    const uid = String(reg.userId);
    io.to(`user:${uid}`).emit('tournament:room_ready', {
      tournamentId: String(tournament._id),
      tournamentName: tournament.name,
      round,
      roomCode,
      survivorsCount: survivors.length,
    });
    // Also emit game:can_resume so GamePage auto-prompts reconnect for players still on game screen
    io.to(`user:${uid}`).emit('game:can_resume', { roomCodes: [roomCode] });
    sendNotification({
      userId: uid,
      title: `⚔ Round ${round} — ${tournament.name}`,
      message: round === 1
        ? `Tournament is starting! Join your room now to play.`
        : `Round ${round} starting! Your score: ${reg.score}/${tournament.eliminationTarget}. Join now!`,
      category: 'tournament',
      type: 'warning',
      actionUrl: '/game',
      skipThrottle: true,
    }).catch(() => {});
  }

  // Broadcast for all clients watching the tournament
  io.emit('tournament:elim_update', {
    tournamentId: String(tournament._id),
    round,
    roomCode,
    registrations: tournament.registrations.map((r: any) => ({
      userId: String(r.userId),
      username: r.username,
      score: r.score,
      eliminated: r.eliminated,
      eliminatedAt: r.eliminatedAt,
      timeoutCount: r.timeoutCount,
      rank: r.rank,
      prizeWon: r.prizeWon,
    })),
  });

  console.log(`[Tournament] "${tournament.name}" Round ${round} started — room ${roomCode} with ${survivors.length} players`);
}

// ── Elimination Tournament Hook ───────────────────────────────────────────────

export async function handleElimTournamentMatchEnd(
  io: Server,
  playerUserIds: string[],
  playerScoreUpdates: Record<string, number>,
  playerTimeouts: Record<string, number> = {},
  roomCode?: string,
): Promise<void> {
  if (playerUserIds.length === 0) return;

  const query: any = {
    status: 'live',
    mode: 'elimination',
    'registrations.userId': { $in: playerUserIds },
  };
  // Only process the tournament whose active room just finished
  if (roomCode) query.activeRoomCode = roomCode;

  const tournaments = await ScheduledTournament.find(query);

  for (const tournament of tournaments) {
    const now = new Date();
    let changed = false;

    for (const reg of tournament.registrations) {
      const uid = String(reg.userId);
      if (reg.eliminated) continue;

      // ── Accumulate card scores ──────────────────────────────────────────
      if (playerScoreUpdates[uid] !== undefined) {
        reg.score += playerScoreUpdates[uid];
        changed = true;

        if (reg.score >= tournament.eliminationTarget) {
          reg.eliminated = true;
          reg.eliminatedAt = now;
          console.log(`[ElimTournament] ${reg.username} eliminated in "${tournament.name}" — score ${reg.score}`);
          if (!(reg as any).isBot) {
            sendNotification({
              userId: uid,
              title: `💀 Eliminated — ${tournament.name}`,
              message: `You reached ${reg.score} pts (target: ${tournament.eliminationTarget}). Eliminated!`,
              category: 'tournament',
              type: 'info',
              actionUrl: '/tournaments',
            }).catch(() => {});
          }
        }
      }

      // ── Timeout strikes (humans only — bots never time out) ────────────
      if (!(reg as any).isBot && !reg.eliminated && playerTimeouts[uid]) {
        reg.timeoutCount = (reg.timeoutCount ?? 0) + playerTimeouts[uid];
        if (reg.timeoutCount >= 3) {
          reg.eliminated = true;
          reg.eliminatedAt = now;
          changed = true;
          console.log(`[ElimTournament] ${reg.username} eliminated (${reg.timeoutCount} timeouts) in "${tournament.name}"`);
          sendNotification({
            userId: uid,
            title: `💀 Eliminated (Inactivity) — ${tournament.name}`,
            message: `Eliminated for ${reg.timeoutCount} timeouts. Stay active next time!`,
            category: 'tournament',
            type: 'info',
            actionUrl: '/tournaments',
          }).catch(() => {});
        }
      }
    }

    if (!changed) continue;

    const survivors = tournament.registrations.filter((r) => !r.eliminated);
    const humanSurvivors = survivors.filter((r) => !(r as any).isBot);

    // Emit live standings — only expose non-bot info to clients
    io.emit('tournament:elim_update', {
      tournamentId: String(tournament._id),
      round: tournament.currentRound,
      survivors: humanSurvivors.length,
      registrations: tournament.registrations
        .filter((r) => !(r as any).isBot)
        .map((r) => ({
          userId: String(r.userId),
          username: r.username,
          score: r.score,
          eliminated: r.eliminated,
          eliminatedAt: r.eliminatedAt,
          timeoutCount: r.timeoutCount,
        })),
    });

    if (survivors.length <= tournament.winnersCount || humanSurvivors.length === 0) {
      // Enough players eliminated OR no humans remain — end tournament
      await tournament.save();
      await distributeElimPrizes(String(tournament._id), io);
    } else {
      // Start next round with all surviving players (humans + bots)
      await tournament.save();
      const nextRound = (tournament.currentRound ?? 1) + 1;

      // Brief pause before next round so players can see elimination results
      setTimeout(async () => {
        try {
          const fresh = await ScheduledTournament.findById(tournament._id);
          if (!fresh || fresh.status !== 'live') return;
          const activeSurvivors = fresh.registrations.filter((r) => !r.eliminated);
          const activeHumans = activeSurvivors.filter((r) => !(r as any).isBot);
          if (activeHumans.length >= 1 && activeSurvivors.length >= 2) {
            await createAndStartTournamentRoom(io, fresh, activeSurvivors, nextRound);
          } else {
            await distributeElimPrizes(String(fresh._id), io);
          }
        } catch (err) {
          console.error('[ElimTournament] Error starting next round:', err);
        }
      }, 15_000); // 15s gap between rounds — players see results
    }
  }
}

async function autoCancelTournament(tournamentId: string, reason: string): Promise<void> {
  const tournament = await ScheduledTournament.findById(tournamentId);
  if (!tournament) return;

  if (tournament.entryFee > 0) {
    const feeInRupees = tournament.entryFee / 100; // entryFee is in pts; 100 pts = ₹1
    for (const reg of tournament.registrations) {
      const user = await User.findById(reg.userId);
      if (user) {
        const balanceBefore = user.walletBalance;
        user.walletBalance += feeInRupees;
        await user.save();
        await Transaction.create({
          userId: String(reg.userId),
          type: 'refund',
          amount: feeInRupees,
          status: 'completed',
          description: `Entry refund — "${tournament.name}" (auto-cancelled)`,
          balanceBefore,
          balanceAfter: user.walletBalance,
          heldBefore: user.heldBalance,
          heldAfter: user.heldBalance,
          metadata: { scheduledTournamentId: String(tournament._id) },
        });
      }
      sendNotification({
        userId: String(reg.userId),
        title: `❌ "${tournament.name}" Cancelled`,
        message: reason,
        category: 'tournament',
        type: 'info',
        actionUrl: '/tournaments',
      }).catch(() => {});
    }
  }

  tournament.status = 'cancelled';
  tournament.cancelledAt = new Date();
  tournament.cancelReason = reason;
  await tournament.save();
}

async function creditPrize(
  tournament: any,
  reg: any,
  rank: number,
  prizeWon: number,
  breakdown: any,
): Promise<void> {
  if (prizeWon > 0) {
    const prizeInRupees = prizeWon / 100; // prizeWon is in pts; 100 pts = ₹1
    const user = await User.findById(reg.userId);
    if (user) {
      const balanceBefore = user.walletBalance;
      user.walletBalance += prizeInRupees;
      await user.save();
      await Transaction.create({
        userId: String(reg.userId),
        type: 'tournament_prize',
        amount: prizeInRupees,
        status: 'completed',
        description: `${breakdown?.label ?? `Rank #${rank}`} — ${tournament.name}`,
        balanceBefore,
        balanceAfter: user.walletBalance,
        heldBefore: user.heldBalance,
        heldAfter: user.heldBalance,
        metadata: { scheduledTournamentId: String(tournament._id) },
      });
      sendNotification({
        userId: String(reg.userId),
        title: `🏆 Tournament Result — Rank #${rank}`,
        message: `${breakdown?.label ?? `Rank #${rank}`} in "${tournament.name}"! You earned ${prizeWon} pts.`,
        category: 'tournament',
        type: 'success',
        actionUrl: '/tournaments',
        skipThrottle: true,
      }).catch(() => {});
    }
  } else {
    sendNotification({
      userId: String(reg.userId),
      title: `⚔ Tournament Ended — Rank #${rank}`,
      message: `You finished #${rank} in "${tournament.name}" with ${reg.score} pts. Keep competing!`,
      category: 'tournament',
      type: 'info',
      actionUrl: '/tournaments',
    }).catch(() => {});
  }
}

async function distributeElimPrizes(tournamentId: string, io: Server): Promise<void> {
  const tournament = await ScheduledTournament.findById(tournamentId);
  if (!tournament || tournament.status !== 'live') return;

  const MIN_PLAYERS = 2;
  if (tournament.registrations.length < MIN_PLAYERS) {
    const reason = tournament.registrations.length === 0
      ? 'No players registered — tournament cancelled.'
      : `Only ${tournament.registrations.length} player registered — minimum ${MIN_PLAYERS} required.`;
    await autoCancelTournament(tournamentId, reason);
    return;
  }

  // Separate human registrations only — bots never receive prizes
  const humanRegs = tournament.registrations.filter((r) => !(r as any).isBot);
  const survivors = humanRegs.filter((r) => !r.eliminated);
  const eliminated = humanRegs.filter((r) => r.eliminated);

  // All human players got knocked out in the same round — split prize equally
  if (survivors.length === 0 && eliminated.length > 0) {
    const latestMs = Math.max(
      ...eliminated.map((r) => (r.eliminatedAt ? new Date(r.eliminatedAt).getTime() : 0)),
    );
    const tiedPlayers = eliminated.filter(
      (r) => r.eliminatedAt && new Date(r.eliminatedAt).getTime() === latestMs,
    );
    if (tiedPlayers.length > 1) {
      const share = Math.floor(tournament.prizePool / tiedPlayers.length);
      const remainder = tournament.prizePool - share * tiedPlayers.length;
      for (let i = 0; i < tiedPlayers.length; i++) {
        const reg = tiedPlayers[i];
        const prizeWon = share + (i === 0 ? remainder : 0);
        const regIdx = tournament.registrations.findIndex((r) => String(r.userId) === String(reg.userId));
        if (regIdx !== -1) {
          tournament.registrations[regIdx].prizeWon = prizeWon;
          tournament.registrations[regIdx].rank = 1;
        }
        if (prizeWon > 0) {
          const prizeInRupees = prizeWon / 100; // prizeWon is in pts; 100 pts = ₹1
          const user = await User.findById(reg.userId);
          if (user) {
            const balanceBefore = user.walletBalance;
            user.walletBalance += prizeInRupees;
            await user.save();
            await Transaction.create({
              userId: String(reg.userId),
              type: 'tournament_prize',
              amount: prizeInRupees,
              status: 'completed',
              description: `Tie — split prize in "${tournament.name}"`,
              balanceBefore,
              balanceAfter: user.walletBalance,
              heldBefore: user.heldBalance,
              heldAfter: user.heldBalance,
              metadata: { scheduledTournamentId: String(tournament._id) },
            });
          }
        }
        sendNotification({
          userId: String(reg.userId),
          title: `🤝 Tournament Tied!`,
          message: `It's a tie in "${tournament.name}"! You share the prize and each receive ${prizeWon} pts.`,
          category: 'tournament',
          type: 'success',
          actionUrl: '/tournaments',
          skipThrottle: true,
        }).catch(() => {});
      }
      tournament.status = 'completed';
      tournament.completedAt = new Date();
      await tournament.save();
      io.emit('tournament:elim_update', {
        tournamentId: String(tournament._id),
        status: 'completed',
        tied: true,
        registrations: tournament.registrations.map((r) => ({
          userId: String(r.userId),
          username: r.username,
          score: r.score,
          eliminated: r.eliminated,
          eliminatedAt: r.eliminatedAt,
          rank: r.rank,
          prizeWon: r.prizeWon,
        })),
      });
      return;
    }
  }

  survivors.sort((a, b) => a.score - b.score);
  eliminated.sort((a, b) => {
    const ta = a.eliminatedAt ? new Date(a.eliminatedAt).getTime() : 0;
    const tb = b.eliminatedAt ? new Date(b.eliminatedAt).getTime() : 0;
    return tb - ta;
  });

  const ranked = [...survivors, ...eliminated]; // humans only, sorted above
  for (let i = 0; i < ranked.length; i++) {
    const reg = ranked[i];
    const rank = i + 1;
    const breakdown = tournament.prizeBreakdown.find((p) => p.rank === rank);
    const prizeWon = breakdown ? Math.floor((tournament.prizePool * breakdown.percentage) / 100) : 0;

    const regIdx = tournament.registrations.findIndex((r) => String(r.userId) === String(reg.userId));
    if (regIdx !== -1) {
      tournament.registrations[regIdx].prizeWon = prizeWon;
      tournament.registrations[regIdx].rank = rank;
    }

    await creditPrize(tournament, reg, rank, prizeWon, breakdown);
  }

  tournament.status = 'completed';
  tournament.completedAt = new Date();
  await tournament.save();

  io.emit('tournament:elim_update', {
    tournamentId: String(tournament._id),
    status: 'completed',
    // Only expose human registrations in the final broadcast
    registrations: tournament.registrations.filter((r) => !(r as any).isBot).map((r) => ({
      userId: String(r.userId),
      username: r.username,
      score: r.score,
      eliminated: r.eliminated,
      eliminatedAt: r.eliminatedAt,
      rank: r.rank,
      prizeWon: r.prizeWon,
    })),
  });
}

async function distributePrizes(tournamentId: string): Promise<void> {
  const tournament = await ScheduledTournament.findById(tournamentId);
  if (!tournament || tournament.status !== 'live') return;

  if (tournament.mode === 'elimination') {
    await distributeElimPrizes(tournamentId, undefined as any);
    return;
  }

  const MIN_PLAYERS = 2;
  if (tournament.registrations.length < MIN_PLAYERS) {
    const reason = tournament.registrations.length === 0
      ? 'No players registered — tournament cancelled and not held.'
      : `Only ${tournament.registrations.length} player registered — minimum ${MIN_PLAYERS} required to run.`;
    await autoCancelTournament(tournamentId, reason);
    return;
  }

  const userIds = tournament.registrations.map((r) => String(r.userId));
  const GRACE_MS = 10 * 60 * 1000;
  const scoringCutoff = new Date(tournament.endTime.getTime() + GRACE_MS);

  const txns = await Transaction.find({
    userId: { $in: userIds },
    type: { $in: ['winning', 'match_settlement'] },
    status: 'completed',
    amount: { $gt: 0 },
    createdAt: { $gte: tournament.startTime, $lte: scoringCutoff },
  }).lean();

  const scoreMap = new Map<string, number>();
  for (const t of txns) {
    scoreMap.set(t.userId, (scoreMap.get(t.userId) ?? 0) + t.amount);
  }

  const ranked = tournament.registrations
    .map((r) => ({ ...r, score: scoreMap.get(String(r.userId)) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  for (let i = 0; i < ranked.length; i++) {
    const reg = ranked[i];
    const rank = i + 1;
    const breakdown = tournament.prizeBreakdown.find((p) => p.rank === rank);
    const prizeWon = breakdown ? Math.floor((tournament.prizePool * breakdown.percentage) / 100) : 0;

    const regIdx = tournament.registrations.findIndex((r) => String(r.userId) === String(reg.userId));
    if (regIdx !== -1) {
      tournament.registrations[regIdx].score = reg.score;
      tournament.registrations[regIdx].prizeWon = prizeWon;
      tournament.registrations[regIdx].rank = rank;
    }

    await creditPrize(tournament, reg, rank, prizeWon, breakdown);
  }

  tournament.status = 'completed';
  tournament.completedAt = new Date();
  await tournament.save();
}

async function startTournament(tournamentId: string, io: Server): Promise<void> {
  const tournament = await ScheduledTournament.findById(tournamentId);
  if (!tournament) return;

  // Cancel if fewer than 2 players registered
  if (tournament.registrations.length < 2) {
    const reason = tournament.registrations.length === 0
      ? 'No players registered — tournament cancelled.'
      : 'Only 1 player registered — minimum 2 required to start.';
    console.log(`[TournamentScheduler] Auto-cancelling "${tournament.name}": ${reason}`);
    await autoCancelTournament(tournamentId, reason);
    return;
  }

  tournament.status = 'live';
  await tournament.save();

  // Notify all registered players
  for (const reg of tournament.registrations) {
    sendNotification({
      userId: String(reg.userId),
      title: `⚔ ${tournament.name} is LIVE!`,
      message: `The tournament has started! Play now to earn points and win your share of ${tournament.prizePool} pts.`,
      category: 'tournament',
      type: 'warning',
      actionUrl: '/tournaments',
      skipThrottle: true,
    }).catch(() => {});
  }

  // Broadcast to all connected clients
  io.emit('admin:notification', {
    id: `tournament-live-${String(tournament._id)}`,
    sentAt: new Date().toISOString(),
    title: `⚔ ${tournament.name} is LIVE!`,
    message: `Scheduled tournament has started. ${tournament.registrations.length} players competing for ${tournament.prizePool} pts!`,
    type: 'success',
    category: 'tournament',
    actionUrl: '/tournaments',
  });

  // Notify all clients that this tournament is now live so they can refresh
  io.emit('tournament:started', {
    tournamentId: String(tournament._id),
    name: tournament.name,
  });

  // Auto-create first room for elimination tournaments
  if (tournament.mode === 'elimination') {
    const survivors = tournament.registrations.filter((r) => !r.eliminated);
    await createAndStartTournamentRoom(io, tournament, survivors, 1);
  }
}

export function startTournamentScheduler(io: Server): void {
  setInterval(async () => {
    try {
      const now = new Date();

      const toStart = await ScheduledTournament.find({
        status: 'upcoming',
        startTime: { $lte: now },
      }).select('_id').lean();

      for (const t of toStart) {
        await startTournament(String(t._id), io);
      }

      // End live timed tournaments whose endTime has passed
      // (Elimination tournaments end via handleElimTournamentMatchEnd)
      const toEnd = await ScheduledTournament.find({
        status: 'live',
        mode: { $ne: 'elimination' },
        endTime: { $lte: now },
      }).select('_id').lean();

      for (const t of toEnd) {
        await distributePrizes(String(t._id));
      }
    } catch (err) {
      console.error('[TournamentScheduler] Error:', err);
    }
  }, 30_000);
}
