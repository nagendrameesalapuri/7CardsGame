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
import { startRoomGame, getActiveGame, setBotPersonality, assignBotPersonalities } from './gameHandler';
import { GameState } from '../../../../shared/src/types';
import { getAdminConfig } from '../../models/AdminConfig';
import { awardXp } from '../../utils/progressionService';
import { XP_REWARDS } from '../../utils/progression';
import { getBadge } from '../../utils/badgeCache';

const POINTS_PER_RUPEE = 100;

function pointsToRupees(points: number): number {
  return points / POINTS_PER_RUPEE;
}

// Load effective tier config from DB, falling back to static TIER_CONFIG defaults
async function getEffectiveTierConfig(tier: SurvivalTier) {
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

// Called from gameHandler after every match ends
export async function handleSurvivalMatchEnd(io: Server, state: GameState, matchResult: any) {
  const survival = await SurvivalTournament.findOne({ currentRoomCode: state.roomId, status: 'active' });
  if (!survival) return;

  const tierCfg = await getEffectiveTierConfig(survival.tier);
  const stageIdx = survival.currentStage - 1;
  const stageReward = tierCfg.stageRewards[stageIdx] ?? 0;
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

  // Human wins only if their score is strictly lower than EVERY bot (lower = better in 7-card)
  const playerWon = humanScore < minBotScore;
  const isDraw    = humanScore === minBotScore && botScores.every(s => s >= humanScore);

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
  } else {
    // Stage cleared — credit reward
    const rupees = pointsToRupees(stageReward);
    await User.findByIdAndUpdate(survival.userId, { $inc: { walletBalance: rupees } });
    await Transaction.create({
      userId: survival.userId,
      type: 'winning',
      amount: rupees,
      status: 'completed',
      description: `Survival Stage ${survival.currentStage} cleared (${stageConfig.name}) — ${stageReward} pts`,
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
    try {
      const { tier } = data;
      if (isGuest) return socket.emit('survival:error', 'Guests cannot join tournaments. Please sign in.');
      if (!TIER_CONFIG[tier]) return socket.emit('survival:error', 'Invalid tournament tier');

      const tierCfg = await getEffectiveTierConfig(tier);
      const entryRupees = pointsToRupees(tierCfg.entryPoints);

      // Check for existing active survival tournament
      const existing = await SurvivalTournament.findOne({ userId, status: 'active' });
      if (existing) {
        const roomExists = existing.currentRoomCode ? await Room.exists({ code: existing.currentRoomCode }) : false;
        const gameActive = existing.currentRoomCode ? !!getActiveGame(existing.currentRoomCode) : false;

        if (!roomExists && !gameActive) {
          // Stale — refund and reset
          existing.status = 'abandoned';
          await existing.save();
          await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryRupees } });
        } else {
          // Resume
          if (existing.currentRoomCode) {
            await socket.join(existing.currentRoomCode);
            socket.data.roomCode = existing.currentRoomCode;
            if (!getActiveGame(existing.currentRoomCode)) {
              await startRoomGame(io, existing.currentRoomCode);
              const game = getActiveGame(existing.currentRoomCode);
              if (game) {
                const stageConfig = SURVIVAL_STAGES.find(s => s.stage === existing.currentStage)!;
                if (stageConfig.botCount > 1) {
                  const bots = game.players.filter(p => p.isBot);
                  assignBotPersonalities(game.id, bots.map((b, i) => ({
                    userId: b.userId,
                    personality: stageConfig.personalities[i] ?? stageConfig.personalities[0],
                  })));
                } else {
                  setBotPersonality(game.id, stageConfig.personalities[0]);
                }
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

      // Validate balance
      const user = await User.findById(userId).select('walletBalance');
      if (!user) return socket.emit('survival:error', 'User not found');
      if ((user.walletBalance ?? 0) < entryRupees) {
        return socket.emit('survival:error', `Insufficient balance. Need ₹${entryRupees} (${tierCfg.entryPoints} pts) to enter.`);
      }

      // Deduct entry fee
      await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryRupees } });

      let roomCode: string | undefined;
      let survival: any;
      try {
        roomCode = await createSurvivalRoom(userId, username, avatar, socket.id, 1);

        survival = await SurvivalTournament.create({
          userId,
          tier,
          currentStage: 1,
          entryPoints: tierCfg.entryPoints,
          currentRoomCode: roomCode,
        });

        await Transaction.create({
          userId,
          type: 'entry_fee',
          amount: entryRupees,
          status: 'completed',
          description: `Survival Championship entry (${tierCfg.label})`,
          metadata: { survivalTournamentId: survival.id },
        });

        await socket.join(roomCode);
        socket.data.roomCode = roomCode;
        await startRoomGame(io, roomCode);

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
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryRupees } });
        if (roomCode) await Room.deleteOne({ code: roomCode }).catch(() => {});
        if (survival?.id) await SurvivalTournament.deleteOne({ _id: survival.id }).catch(() => {});
        socket.emit('survival:error', 'Failed to start tournament. Please try again.');
      }
    } catch (err) {
      console.error('[Survival] Start error:', err);
      socket.emit('survival:error', 'Failed to start tournament. Please try again.');
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
          const stageConfig = SURVIVAL_STAGES.find(s => s.stage === survival.currentStage)!;
          if (stageConfig.botCount > 1) {
            const bots = game.players.filter(p => p.isBot);
            assignBotPersonalities(game.id, bots.map((b, i) => ({
              userId: b.userId,
              personality: stageConfig.personalities[i] ?? stageConfig.personalities[0],
            })));
          } else {
            setBotPersonality(game.id, stageConfig.personalities[0]);
          }
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
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryRupees } });
        await Transaction.create({
          userId,
          type: 'refund',
          amount: entryRupees,
          status: 'completed',
          description: `Survival Championship refund — quit before playing (${s.tier})`,
          metadata: { survivalTournamentId: s.id },
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
