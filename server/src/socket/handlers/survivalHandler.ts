import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Room } from '../../models/Room';
import { User } from '../../models/User';
import { Transaction } from '../../models/Transaction';
import {
  SurvivalTournament,
  SURVIVAL_STAGES,
  TIER_CONFIG,
  SurvivalTier,
} from '../../models/SurvivalTournament';
import { SurvivalTeam } from '../../models/SurvivalTeam';
import { handleTeamSurvivalMatchEnd } from './survivalTeamHandler';
import { startRoomGame, getActiveGame, setBotPersonality, assignBotPersonalities, overrideGameDifficultyBoost } from './gameHandler';
import { GameState } from '../../../../shared/src/types';
import { getAdminConfig } from '../../models/AdminConfig';
import { awardXp } from '../../utils/progressionService';
import { XP_REWARDS } from '../../utils/progression';
import { getBadge } from '../../utils/badgeCache';
import {
  notifySurvivalStageComplete,
  notifySurvivalWon,
  notifySurvivalLost,
  notifyBossArenaUnlocked,
  notifyWinStreak,
} from '../../services/notificationTriggers';

const POINTS_PER_RUPEE = 100;

function pointsToRupees(points: number): number {
  return points / POINTS_PER_RUPEE;
}

// Per-stage difficulty boost — escalates with stage difficulty.
// These values feed into BotPlayer.decide() to shift bot play quality without
// giving bots hidden information or manipulating card draws.
const STAGE_DIFFICULTY_BOOST: Record<number, number> = {
  1: 0.00,  // Stage 1 (Iron Fist / safe): no boost — warmup
  2: 0.08,  // Stage 2 (Blaze / aggressive): slight pressure
  3: 0.14,  // Stage 3 (Phantom / bluff): moderate — deception needs confidence
  4: 0.22,  // Stage 4 (Cipher + Raven / smart + aggressive): two bots, meaningful boost
  5: 0.30,  // Stage 5 (Viper + Ghost + Specter): three bots, near-max boost
};

// Apply both personality and difficulty boost for a survival game.
function applyStageBotSettings(roomCode: string, gameId: string, stage: number, bots: any[]): void {
  const stageConfig = SURVIVAL_STAGES.find(s => s.stage === stage)!;
  if (!stageConfig) return;

  if (stageConfig.botCount > 1) {
    assignBotPersonalities(gameId, bots.map((b: any, i: number) => ({
      userId:      b.userId,
      personality: stageConfig.personalities[i] ?? stageConfig.personalities[0],
    })));
  } else {
    setBotPersonality(gameId, stageConfig.personalities[0]);
  }

  const boost = STAGE_DIFFICULTY_BOOST[stage] ?? 0;
  overrideGameDifficultyBoost(roomCode, boost);
}

// Load effective tier config from DB, falling back to static TIER_CONFIG defaults
export async function getEffectiveTierConfig(tier: SurvivalTier) {
  try {
    const adminCfg = await getAdminConfig();
    const sc = (adminCfg.survivalConfig as any)?.[tier];
    if (sc && typeof sc.entryPoints === 'number' && Array.isArray(sc.stageRewards) && sc.stageRewards.length === 5) {
      return { entryPoints: sc.entryPoints, label: TIER_CONFIG[tier].label, stageRewards: sc.stageRewards as number[] };
    }
  } catch { /* fall through */ }
  return TIER_CONFIG[tier];
}

async function createSurvivalRoom(
  userId: string, username: string, avatar: string, socketId: string, stage: number,
): Promise<string> {
  const stageConfig = SURVIVAL_STAGES.find(s => s.stage === stage)!;
  let code: string;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    attempts++;
  } while (await Room.exists({ code }) && attempts < 10);

  const botCount = stageConfig.botCount;
  const maxPlayers = 1 + botCount; // human + bots

  await Room.create({
    code,
    name: `Survival S${stage} — ${username}`.slice(0, 30),
    hostId: userId,
    players: [{ userId, username, avatar, isReady: true, isHost: true, isBot: false, socketId }],
    config: {
      maxPlayers,
      roundCount: 3,
      isPrivate: true,
      turnTimeLimit: 30,
      allowBots: true,
      botCount,
      entryFee: 0,
      botNames: stageConfig.botNames,
      ...(botCount > 1
        ? { botPersonalities: stageConfig.personalities }
        : { botPersonality: stageConfig.personalities[0] }),
    },
    paidPlayerIds: [],
    status: 'waiting',
  });

  return code!;
}

function emitGameState(socket: Socket, roomCode: string, userId: string) {
  const gameState = getActiveGame(roomCode);
  if (!gameState) return;
  const myPlayer = gameState.players.find(p => p.userId === userId);
  socket.emit('game:state', {
    id: gameState.id,
    roomId: gameState.roomId,
    status: gameState.status,
    players: gameState.players.map(p => ({
      id: p.id, userId: p.userId, username: p.username, avatar: p.avatar,
      handCount: p.handCount, totalScore: p.totalScore, roundScore: p.roundScore,
      isConnected: p.isConnected, isEliminated: p.isEliminated, seatIndex: p.seatIndex, isBot: p.isBot,
      badge: p.isBot ? undefined : getBadge(p.userId),
    })),
    discardPile: gameState.discardPile,
    deckCount: gameState.deck.length,
    jokerRank: gameState.jokerRank,
    jokerCard: gameState.jokerCard,
    currentPlayerIndex: gameState.currentPlayerIndex,
    turnNumber: gameState.turnNumber,
    turnStartTime: gameState.turnStartTime,
    turnTimeLimit: gameState.turnTimeLimit,
    attackChain: gameState.attackChain,
    roundCount: gameState.roundCount,
    roundNumber: gameState.roundNumber,
    hasDrawnThisTurn: gameState.hasDrawnThisTurn,
    showPlayerId: gameState.showPlayerId,
    roundResult: gameState.roundResult,
    chatMessages: gameState.chatMessages,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? '',
  });
}

const handledMatchEnds = new Set<string>();
const survivalStartInProgress = new Set<string>(); // prevents double-start race condition

// Called from gameHandler after every match ends
export async function handleSurvivalMatchEnd(io: Server, state: GameState, matchResult: any) {
  if (handledMatchEnds.has(state.id)) {
    console.warn(`[Survival] Match ${state.id} already processed — skipping duplicate`);
    return;
  }
  handledMatchEnds.add(state.id);
  setTimeout(() => handledMatchEnds.delete(state.id), 60_000);

  // Check for team tournament first
  const team = await SurvivalTeam.findOne({ currentRoomCode: state.roomId, status: 'playing' });
  if (team) {
    await handleTeamSurvivalMatchEnd(io, state, team);
    return;
  }

  const survival = await SurvivalTournament.findOne({ currentRoomCode: state.roomId, status: 'active' });
  if (!survival) return;

  const tierCfg = await getEffectiveTierConfig(survival.tier);
  const stageIdx = survival.currentStage - 1;
  // S1: use rewards locked at tournament start; fall back to live config for old records
  const stageReward = (survival.stageRewards?.[stageIdx] as number | undefined) ?? tierCfg.stageRewards[stageIdx] ?? 0;
  const stageConfig = SURVIVAL_STAGES.find(s => s.stage === survival.currentStage)!;

  // Get final totalScore for any player from round results or player state
  const getScore = (playerId: string): number => {
    if (state.roundResult) {
      const pr = state.roundResult.playerResults.find(r => r.playerId === playerId);
      if (pr) return pr.totalScore;
    }
    return state.players.find(p => p.id === playerId)?.totalScore ?? 999;
  };

  const humanPlayer = state.players.find(p => !p.isBot);
  const botPlayers  = state.players.filter(p => p.isBot);

  const humanScore = humanPlayer ? getScore(humanPlayer.id) : 999;
  const botScores  = botPlayers.map(b => getScore(b.id));
  const minBotScore = botScores.length > 0 ? Math.min(...botScores) : 999;

  // Guard: if no round completed and all scores are 0, the game ended before any play
  // (e.g. immediate disconnect). Don't trigger a false tiebreaker — mark as abandoned.
  const roundCompleted = !!state.roundResult;
  if (!roundCompleted && humanScore === 0 && botScores.every(s => s === 0)) {
    console.warn(`[Survival] Match ${state.id} ended with no completed round — skipping tiebreaker`);
    return;
  }

  // Human wins only if their score is strictly lower than EVERY bot (lower = better in 7-card)
  const playerWon = humanScore < minBotScore;
  const isDraw    = roundCompleted && humanScore === minBotScore && botScores.every(s => s >= humanScore);

  // Mark old survival room as completed so it clears from admin live rooms view
  await Room.findOneAndUpdate({ code: state.roomId }, { status: 'completed' }).catch(() => {});

  // Persist rounds played
  survival.roundsPlayed = (survival.roundsPlayed ?? 0) + state.roundNumber;

  const scoreboard = [
    { name: humanPlayer?.username ?? 'You', score: humanScore, isHuman: true },
    ...botPlayers.map((b, i) => ({ name: stageConfig.botNames[i] ?? b.username, score: botScores[i], isHuman: false })),
  ].sort((a, b) => a.score - b.score);

  // ── TIEBREAKER: first draw → give one bonus round instead of eliminating ────
  if (isDraw && !survival.tiebreakerPending) {
    let tieCode: string;
    let tieAtt = 0;
    do {
      tieCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      tieAtt++;
    } while (await Room.exists({ code: tieCode }) && tieAtt < 10);

    await Room.create({
      code: tieCode,
      name: `Tiebreak S${survival.currentStage} — ${humanPlayer?.username ?? 'Player'}`.slice(0, 30),
      hostId: String(survival.userId),
      players: [{
        userId:   String(survival.userId),
        username: humanPlayer?.username ?? 'Player',
        avatar:   humanPlayer?.avatar   ?? '',
        isReady: true, isHost: true, isBot: false,
      }],
      config: {
        maxPlayers:    1 + stageConfig.botCount,
        roundCount:    1,
        isPrivate:     true,
        turnTimeLimit: 30,
        allowBots:     true,
        botCount:      stageConfig.botCount,
        entryFee:      0,
        botNames: stageConfig.botNames,
        ...(stageConfig.botCount > 1
          ? { botPersonalities: stageConfig.personalities }
          : { botPersonality:   stageConfig.personalities[0] }),
      },
      paidPlayerIds: [],
      status: 'waiting',
    });

    survival.tiebreakerPending = true;
    survival.currentRoomCode   = tieCode;
    await survival.save();

    const playerSocket = [...io.sockets.sockets.values()].find(s => (s as any).userId === String(survival.userId));
    if (playerSocket) {
      playerSocket.emit('survival:tiebreaker', {
        stage:         survival.currentStage,
        stageName:     stageConfig.name,
        stageDesc:     stageConfig.description,
        botNames:      stageConfig.botNames,
        personalities: stageConfig.personalities,
        playerScore:   humanScore,
        botScore:      minBotScore,
        botScores,
        scoreboard,
        stageResults:  survival.stageResults,
      });
    }
    return;
  }

  // ── If tiebreaker also tied → player loses (no infinite rounds) ───────────
  // If tiebreaker was decisive (win or loss) → clear the flag
  if (survival.tiebreakerPending) {
    survival.tiebreakerPending = false;
  }

  // A draw that reaches here means it was the tiebreaker round and still tied → loss
  const resolvedPlayerWon = isDraw ? false : playerWon;

  survival.stageResults.push({
    stage:        survival.currentStage,
    personality:  stageConfig.personalities[0],
    playerWon:    resolvedPlayerWon,
    playerScore:  humanScore,
    botScore:     minBotScore,
    botScores,
    botNames:     stageConfig.botNames,
    pointsEarned: resolvedPlayerWon ? stageReward : 0,
  });

  const payload: Record<string, any> = {
    stage:        survival.currentStage,
    totalStages:  5,
    stageName:    stageConfig.name,
    stageDesc:    stageConfig.description,
    botNames:     stageConfig.botNames,
    personalities: stageConfig.personalities,
    playerWon:    resolvedPlayerWon,
    isDraw:       isDraw && !resolvedPlayerWon,
    playerScore:  humanScore,
    botScore:     minBotScore,
    botScores,
    scoreboard,
    pointsEarned: resolvedPlayerWon ? stageReward : 0,
    stageResults: survival.stageResults,
  };

  if (!resolvedPlayerWon) {
    // Human eliminated
    survival.status = 'lost';
    survival.currentRoomCode = null;
    survival.completedAt = new Date();
    await survival.save();
    payload.tournamentOver = true;
    payload.won = false;
    payload.totalPointsEarned = survival.totalPointsEarned;
    if (isDraw) payload.eliminatedByDraw = true;
    awardXp(io, { userId: survival.userId, baseXp: XP_REWARDS.LOSE_GAME, isBot: true, won: false }).catch(console.error);
    notifySurvivalLost(survival.userId, survival.currentStage, stageConfig.botNames[0] ?? 'AI');
  } else {
    // Stage cleared — credit reward
    const rupees = pointsToRupees(stageReward);
    const snapBefore = await User.findOneAndUpdate(
      { _id: survival.userId },
      { $inc: { walletBalance: rupees } },
      { new: false },
    ).lean() as any;
    await Transaction.create({
      userId: survival.userId,
      type: 'winning',
      amount: rupees,
      status: 'completed',
      description: `Survival Stage ${survival.currentStage} cleared (${stageConfig.name}) — ${stageReward} pts`,
      balanceBefore: snapBefore?.walletBalance ?? 0,
      balanceAfter: (snapBefore?.walletBalance ?? 0) + rupees,
      heldBefore: snapBefore?.heldBalance ?? 0,
      heldAfter: snapBefore?.heldBalance ?? 0,
      metadata: { survivalTournamentId: survival.id, stage: survival.currentStage },
    });

    survival.totalPointsEarned += stageReward;
    payload.newWalletBalance = (await User.findById(survival.userId).select('walletBalance').lean())?.walletBalance ?? 0;

    const isBossStage = survival.currentStage === 5;
    awardXp(io, {
      userId: survival.userId,
      baseXp: isBossStage ? XP_REWARDS.WIN_SURVIVAL_BOSS : XP_REWARDS.WIN_SURVIVAL_STAGE,
      isBot: true, won: true,
      isSurvivalStage: true,
      isSurvivalBoss: isBossStage,
      stageClearedNum: survival.currentStage,
    }).catch(console.error);

    if (survival.currentStage >= 5) {
      // Championship complete — won!
      survival.status = 'won';
      survival.currentRoomCode = null;
      survival.completedAt = new Date();
      await survival.save();
      payload.tournamentOver = true;
      payload.won = true;
      payload.totalPointsEarned = survival.totalPointsEarned;
      awardXp(io, {
        userId: survival.userId,
        baseXp: XP_REWARDS.COMPLETE_SURVIVAL,
        isBot: true, won: true,
        isSurvivalWin: true,
      }).catch(console.error);
      notifySurvivalWon(survival.userId, survival.tier, survival.totalPointsEarned);
    } else {
      // Prepare next stage room (uses per-stage botCount & personalities)
      const nextStage = survival.currentStage + 1;
      const humanUser = await User.findById(survival.userId).select('username avatar');
      if (!humanUser) { await survival.save(); return; }

      let nextCode: string;
      let att = 0;
      do {
        nextCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        att++;
      } while (await Room.exists({ code: nextCode }) && att < 10);

      const nextStageConfig = SURVIVAL_STAGES.find(s => s.stage === nextStage)!;
      const nextBotCount = nextStageConfig.botCount;

      await Room.create({
        code: nextCode,
        name: `Survival S${nextStage} — ${humanUser.username}`.slice(0, 30),
        hostId: survival.userId,
        players: [{ userId: survival.userId, username: humanUser.username, avatar: humanUser.avatar, isReady: true, isHost: true, isBot: false }],
        config: {
          maxPlayers: 1 + nextBotCount,
          roundCount: 3,
          isPrivate: true,
          turnTimeLimit: 30,
          allowBots: true,
          botCount: nextBotCount,
          entryFee: 0,
          botNames: nextStageConfig.botNames,
          ...(nextBotCount > 1
            ? { botPersonalities: nextStageConfig.personalities }
            : { botPersonality: nextStageConfig.personalities[0] }),
        },
        paidPlayerIds: [],
        status: 'waiting',
      });

      survival.currentStage = nextStage;
      survival.currentRoomCode = nextCode;
      await survival.save();

      // Fire-and-forget notification triggers
      if (nextStage === 5) {
        notifyBossArenaUnlocked(survival.userId);
      } else {
        notifySurvivalStageComplete(survival.userId, survival.currentStage - 1, nextStage, stageReward);
      }

      payload.tournamentOver = false;
      payload.nextStage = nextStage;
      payload.nextRoomCode = nextCode;
      payload.nextStageName = nextStageConfig.name;
      payload.nextStageDesc = nextStageConfig.description;
      payload.nextBotNames  = nextStageConfig.botNames;
      payload.nextPersonalities = nextStageConfig.personalities;
    }
  }

  // Emit to player
  const playerSocket = [...io.sockets.sockets.values()].find(s => (s as any).userId === survival.userId);
  if (playerSocket) playerSocket.emit('survival:stage_result', payload);
}

export function registerSurvivalHandlers(io: Server, socket: Socket) {
  const userId: string   = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string   = (socket as any).avatar;
  const isGuest: boolean = (socket as any).isGuest;

  // Start or resume survival tournament
  socket.on('survival:start', async (data: { tier: SurvivalTier }) => {
    if (survivalStartInProgress.has(userId)) return; // debounce double-tap
    survivalStartInProgress.add(userId);
    // S2: hoist so outer catch can release hold on Transaction.create failure
    let tierCfg: Awaited<ReturnType<typeof getEffectiveTierConfig>> | undefined;
    let entryRupees = 0;
    let holdPlaced = false;
    let userBeforeHold: any = null;
    try {
      const { tier } = data;
      if (isGuest) return socket.emit('survival:error', 'Guests cannot join tournaments. Please sign in.');
      if (!TIER_CONFIG[tier]) return socket.emit('survival:error', 'Invalid tournament tier');

      tierCfg = await getEffectiveTierConfig(tier);
      entryRupees = pointsToRupees(tierCfg.entryPoints);

      // Check for existing active survival tournament
      const existing = await SurvivalTournament.findOne({ userId, status: 'active' });
      if (existing) {
        const roomExists = existing.currentRoomCode ? await Room.exists({ code: existing.currentRoomCode }) : false;
        const gameActive = existing.currentRoomCode ? !!getActiveGame(existing.currentRoomCode) : false;

        if (!roomExists && !gameActive) {
          // Stale — refund using the original entry amount, not the new tier's fee
          const staleFee = pointsToRupees(existing.entryPoints);
          existing.status = 'abandoned';
          await existing.save();
          const preRefund = await User.findOneAndUpdate(
            { _id: userId },
            { $inc: { walletBalance: staleFee } },
            { new: false },
          );
          if (preRefund) {
            await Transaction.create({
              userId,
              type: 'abandoned_resolution',
              amount: staleFee,
              status: 'completed',
              description: `Stale survival refund — previous ${existing.tier} tournament abandoned`,
              balanceBefore: preRefund.walletBalance,
              balanceAfter: preRefund.walletBalance + staleFee,
              heldBefore: preRefund.heldBalance ?? 0,
              heldAfter: preRefund.heldBalance ?? 0,
              metadata: { survivalTournamentId: String(existing._id), releaseReason: 'stale_tournament' },
            });
          }
        } else {
          // Resume
          if (existing.currentRoomCode) {
            await socket.join(existing.currentRoomCode);
            socket.data.roomCode = existing.currentRoomCode;
            if (!getActiveGame(existing.currentRoomCode)) {
              await startRoomGame(io, existing.currentRoomCode);
              const game = getActiveGame(existing.currentRoomCode);
              if (game) {
                applyStageBotSettings(
                  existing.currentRoomCode!,
                  game.id,
                  existing.currentStage,
                  game.players.filter((p: any) => p.isBot),
                );
              }
            }
            emitGameState(socket, existing.currentRoomCode, userId);
          }
          return socket.emit('survival:resumed', {
            survivalId:    existing.id,
            tier:          existing.tier,
            currentStage:  existing.currentStage,
            totalStages:   5,
            entryPoints:   existing.entryPoints,
            totalPointsEarned: existing.totalPointsEarned,
            stageResults:  existing.stageResults,
            roomCode:      existing.currentRoomCode,
          });
        }
      }

      // ── ENTRY HOLD: reserve funds before starting ───────────────────────────
      userBeforeHold = await User.findOneAndUpdate(
        {
          _id: userId,
          $expr: { $gte: [{ $subtract: ['$walletBalance', { $ifNull: ['$heldBalance', 0] }] }, entryRupees] },
        },
        { $inc: { heldBalance: entryRupees } },
        { new: false },
      );
      if (!userBeforeHold) {
        return socket.emit('survival:error', `Insufficient balance. Need ₹${entryRupees} (${tierCfg!.entryPoints} pts) to enter.`);
      }

      // S2: mark hold live so outer catch can release it if Transaction.create below throws
      holdPlaced = true;

      await Transaction.create({
        userId,
        type: 'entry_hold',
        amount: entryRupees,
        status: 'completed',
        description: `Survival Championship hold (${tierCfg.label})`,
        balanceBefore: userBeforeHold.walletBalance,
        balanceAfter: userBeforeHold.walletBalance,
        heldBefore: userBeforeHold.heldBalance ?? 0,
        heldAfter: (userBeforeHold.heldBalance ?? 0) + entryRupees,
        metadata: { matchState: 'forming' },
      });

      let roomCode: string | undefined;
      let survival: any;
      try {
        roomCode = await createSurvivalRoom(userId, username, avatar, socket.id, 1);

        survival = await SurvivalTournament.create({
          userId,
          tier,
          currentStage: 1,
          entryPoints: tierCfg!.entryPoints,
          // S1: snapshot stage rewards so mid-tournament admin changes don't affect payouts
          stageRewards: tierCfg!.stageRewards,
          currentRoomCode: roomCode,
        });

        await socket.join(roomCode);
        socket.data.roomCode = roomCode;
        await startRoomGame(io, roomCode);

        // Apply stage 1 difficulty settings (stage 1 = no boost, safe personality)
        const initialGame = getActiveGame(roomCode);
        if (initialGame) {
          applyStageBotSettings(
            roomCode,
            initialGame.id,
            1,
            initialGame.players.filter((p: any) => p.isBot),
          );
        }

        // ── ENTRY LOCK: game is now LIVE — convert hold to locked deduction ──
        const walletSnap = await User.findOneAndUpdate(
          { _id: userId, walletBalance: { $gte: entryRupees } },
          { $inc: { walletBalance: -entryRupees, heldBalance: -Math.min(entryRupees, (userBeforeHold.heldBalance ?? 0) + entryRupees) } },
          { new: true },
        );
        if (walletSnap) {
          await Transaction.create({
            userId,
            type: 'entry_locked',
            amount: entryRupees,
            status: 'completed',
            description: `Survival Championship locked (${tierCfg.label})`,
            balanceBefore: walletSnap.walletBalance + entryRupees,
            balanceAfter: walletSnap.walletBalance,
            heldBefore: (userBeforeHold.heldBalance ?? 0) + entryRupees,
            heldAfter: walletSnap.heldBalance,
            metadata: { survivalTournamentId: survival.id, matchState: 'live' },
          });
        } else {
          // Wallet drained between hold and lock — abort cleanly
          console.error(`[Survival] Lock failed for user ${userId} — releasing hold and aborting`);
          await User.findByIdAndUpdate(userId, { $inc: { heldBalance: -entryRupees } }).catch(console.error);
          await Transaction.create({
            userId, type: 'entry_released', amount: entryRupees, status: 'completed',
            description: `Survival hold released — lock failed (${tierCfg.label})`,
            balanceBefore: userBeforeHold.walletBalance, balanceAfter: userBeforeHold.walletBalance,
            heldBefore: (userBeforeHold.heldBalance ?? 0) + entryRupees, heldAfter: userBeforeHold.heldBalance ?? 0,
            metadata: { releaseReason: 'lock_failed' },
          }).catch(console.error);
          if (roomCode) await Room.deleteOne({ code: roomCode }).catch(() => {});
          if (survival?.id) await SurvivalTournament.deleteOne({ _id: survival.id }).catch(() => {});
          socket.emit('survival:error', 'Could not start tournament — insufficient balance. Please try again.');
          return;
        }

        const game = getActiveGame(roomCode);
        if (game) setBotPersonality(game.id, SURVIVAL_STAGES[0].personalities[0]);

        emitGameState(socket, roomCode, userId);
        socket.emit('survival:started', {
          survivalId:   survival.id,
          tier,
          currentStage: 1,
          totalStages:  5,
          entryPoints:  tierCfg.entryPoints,
          roomCode,
          stageName:    SURVIVAL_STAGES[0].name,
          stageDesc:    SURVIVAL_STAGES[0].description,
          botNames:     SURVIVAL_STAGES[0].botNames,
          personalities: SURVIVAL_STAGES[0].personalities,
        });
      } catch (err) {
        console.error('[Survival] Setup error:', err);
        // Release the hold — game never started, wallet untouched
        await User.findByIdAndUpdate(userId, { $inc: { heldBalance: -entryRupees } }).catch(console.error);
        await Transaction.create({
          userId, type: 'entry_released', amount: entryRupees, status: 'completed',
          description: `Survival hold released — startup failed (${tierCfg.label})`,
          balanceBefore: userBeforeHold.walletBalance, balanceAfter: userBeforeHold.walletBalance,
          heldBefore: (userBeforeHold.heldBalance ?? 0) + entryRupees, heldAfter: userBeforeHold.heldBalance ?? 0,
          metadata: { releaseReason: 'startup_failed' },
        }).catch(console.error);
        if (roomCode) await Room.deleteOne({ code: roomCode }).catch(() => {});
        if (survival?.id) await SurvivalTournament.deleteOne({ _id: survival.id }).catch(() => {});
        socket.emit('survival:error', 'Failed to start tournament. Please try again.');
      }
    } catch (err) {
      // S2: release hold if Transaction.create for entry_hold threw after the hold was placed
      if (holdPlaced && tierCfg) {
        await User.findByIdAndUpdate(userId, { $inc: { heldBalance: -entryRupees } }).catch(console.error);
        await Transaction.create({
          userId, type: 'entry_released', amount: entryRupees, status: 'completed',
          description: `Survival hold released — startup error (${tierCfg.label})`,
          balanceBefore: userBeforeHold?.walletBalance ?? 0, balanceAfter: userBeforeHold?.walletBalance ?? 0,
          heldBefore: (userBeforeHold?.heldBalance ?? 0) + entryRupees, heldAfter: userBeforeHold?.heldBalance ?? 0,
          metadata: { releaseReason: 'startup_failed' },
        }).catch(console.error);
      }
      console.error('[Survival] Start error:', err);
      socket.emit('survival:error', 'Failed to start tournament. Please try again.');
    } finally {
      survivalStartInProgress.delete(userId);
    }
  });

  // Continue to next stage after a stage win
  socket.on('survival:continue', async () => {
    try {
      const survival = await SurvivalTournament.findOne({ userId, status: 'active' });
      if (!survival || !survival.currentRoomCode) return socket.emit('survival:error', 'No active tournament');

      await socket.join(survival.currentRoomCode);
      socket.data.roomCode = survival.currentRoomCode;

      if (!getActiveGame(survival.currentRoomCode)) {
        await startRoomGame(io, survival.currentRoomCode);
        const game = getActiveGame(survival.currentRoomCode);
        if (game) {
          applyStageBotSettings(
            survival.currentRoomCode!,
            game.id,
            survival.currentStage,
            game.players.filter((p: any) => p.isBot),
          );
        }
      }

      emitGameState(socket, survival.currentRoomCode, userId);
    } catch (err) {
      console.error('[Survival] Continue error:', err);
      socket.emit('survival:error', 'Failed to load next stage');
    }
  });

  // Query active survival status
  socket.on('survival:status', async () => {
    try {
      const s = await SurvivalTournament.findOne({ userId, status: 'active' });
      if (!s) return socket.emit('survival:status_result', null);
      const activeGame = s.currentRoomCode ? getActiveGame(s.currentRoomCode) : null;
      const hasPlayedRounds = (s.roundsPlayed ?? 0) > 0
        || s.stageResults.length > 0
        || !!(activeGame && activeGame.roundNumber > 1);
      socket.emit('survival:status_result', {
        survivalId:       s.id,
        tier:             s.tier,
        tierLabel:        TIER_CONFIG[s.tier]?.label ?? s.tier,
        currentStage:     s.currentStage,
        totalStages:      5,
        entryPoints:      s.entryPoints,
        totalPointsEarned: s.totalPointsEarned,
        stageResults:     s.stageResults,
        currentRoomCode:  s.currentRoomCode,
        hasPlayedRounds,
      });
    } catch { /* ignore */ }
  });

  // Quit active survival tournament with smart refund logic
  socket.on('survival:abandon', async () => {
    try {
      const s = await SurvivalTournament.findOne({ userId, status: 'active' });
      if (!s) return socket.emit('survival:error', 'No active tournament');

      // Refund if: no rounds at all have been played across all stages
      const activeGame = s.currentRoomCode ? getActiveGame(s.currentRoomCode) : null;
      const totalRoundsPlayed = (s.roundsPlayed ?? 0)
        + (activeGame ? activeGame.roundNumber - 1 : 0); // roundNumber - 1 = rounds COMPLETED (round N is current)
      const giveRefund = totalRoundsPlayed === 0 && s.stageResults.length === 0;

      // Use the actual entryPoints stored on the record (set at purchase time)
      const entryRupees = pointsToRupees(s.entryPoints);

      s.status = 'abandoned';
      s.completedAt = new Date();
      s.currentRoomCode = null;
      await s.save();

      if (giveRefund) {
        const userSnap = await User.findByIdAndUpdate(
          userId,
          { $inc: { walletBalance: entryRupees } },
          { new: false },
        ).lean() as any;
        await Transaction.create({
          userId,
          type: 'abandoned_resolution',
          amount: entryRupees,
          status: 'completed',
          description: `Survival entry returned — quit before playing (${s.tier})`,
          balanceBefore: userSnap?.walletBalance ?? 0,
          balanceAfter: (userSnap?.walletBalance ?? 0) + entryRupees,
          heldBefore: userSnap?.heldBalance ?? 0,
          heldAfter: userSnap?.heldBalance ?? 0,
          metadata: { survivalTournamentId: s.id, matchState: 'cancelled' },
        });
      }

      socket.emit('survival:abandoned', {
        totalPointsEarned: s.totalPointsEarned,
        refunded: giveRefund,
        refundAmount: giveRefund ? s.entryPoints : 0,
      });
    } catch (err) {
      socket.emit('survival:error', 'Failed to quit tournament');
    }
  });
}

// Called from gameHandler when admin force-ends a survival game room
export async function handleSurvivalForceEnd(io: Server, roomCode: string) {
  try {
    const s = await SurvivalTournament.findOne({ currentRoomCode: roomCode, status: 'active' });
    if (!s) return;
    s.status = 'abandoned';
    s.currentRoomCode = null;
    s.completedAt = new Date();
    await s.save();
    const playerSocket = [...io.sockets.sockets.values()].find(sk => (sk as any).userId === String(s.userId));
    if (playerSocket) {
      playerSocket.emit('survival:abandoned', { totalPointsEarned: s.totalPointsEarned, refunded: false, refundAmount: 0, forcedByAdmin: true });
    }
  } catch (err) {
    console.error('[Survival] Force-end error:', err);
  }
}
