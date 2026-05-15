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
import { startRoomGame, getActiveGame, setBotPersonality } from './gameHandler';
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

  await Room.create({
    code,
    name: `Survival S${stage} — ${username}`.slice(0, 30),
    hostId: userId,
    players: [{ userId, username, avatar, isReady: true, isHost: true, isBot: false, socketId }],
    config: {
      maxPlayers: 2,
      roundCount: 3,
      isPrivate: true,
      turnTimeLimit: 30,
      allowBots: true,
      botCount: 1,
      entryFee: 0,
      botPersonality: stageConfig.personality,
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
  const stageIdx = survival.currentStage - 1; // 0-based index
  const stageReward = tierCfg.stageRewards[stageIdx] ?? 0;

  // Determine human score vs bot score
  const humanPlayer = state.players.find(p => !p.isBot);
  const botPlayer   = state.players.find(p => p.isBot);

  const getScore = (playerId: string) => {
    if (state.roundResult) {
      const pr = state.roundResult.playerResults.find(r => {
        const p = state.players.find(pl => pl.id === r.playerId);
        return p?.id === playerId;
      });
      if (pr) return pr.totalScore;
    }
    return state.players.find(p => p.id === playerId)?.totalScore ?? 0;
  };

  const humanScore = humanPlayer ? getScore(humanPlayer.id) : 999;
  const botScore   = botPlayer   ? getScore(botPlayer.id)   : 999;
  const isDraw     = humanScore === botScore;
  const playerWon  = humanScore < botScore;

  const stageConfig = SURVIVAL_STAGES.find(s => s.stage === survival.currentStage)!;

  // Persist how many rounds were played in this match (roundNumber = rounds completed when match ends)
  survival.roundsPlayed = (survival.roundsPlayed ?? 0) + state.roundNumber;

  survival.stageResults.push({
    stage:        survival.currentStage,
    personality:  stageConfig.personality,
    playerWon,
    playerScore:  humanScore,
    botScore,
    pointsEarned: playerWon ? stageReward : 0,
  });

  const payload: Record<string, any> = {
    stage:        survival.currentStage,
    totalStages:  5,
    personality:  stageConfig.personality,
    botName:      stageConfig.name,
    playerWon,
    isDraw,
    playerScore:  humanScore,
    botScore,
    pointsEarned: playerWon ? stageReward : 0,
    stageResults: survival.stageResults,
  };

  if (!playerWon) {
    // Tournament lost
    survival.status = 'lost';
    survival.currentRoomCode = null;
    survival.completedAt = new Date();
    await survival.save();
    payload.tournamentOver = true;
    payload.won = false;
    payload.totalPointsEarned = survival.totalPointsEarned;
    // XP for participating (lost)
    awardXp(io, { userId: survival.userId, baseXp: XP_REWARDS.LOSE_GAME, isBot: true, won: false }).catch(console.error);
  } else {
    // Stage cleared — credit reward immediately
    const rupees = pointsToRupees(stageReward);
    await User.findByIdAndUpdate(survival.userId, { $inc: { walletBalance: rupees } });
    await Transaction.create({
      userId: survival.userId,
      type: 'winning',
      amount: rupees,
      status: 'completed',
      description: `Survival Stage ${survival.currentStage} cleared — ${stageReward} pts`,
      metadata: { survivalTournamentId: survival.id, stage: survival.currentStage },
    });

    survival.totalPointsEarned += stageReward;
    payload.newWalletBalance = (await User.findById(survival.userId).select('walletBalance').lean())?.walletBalance ?? 0;

    // XP for stage clear
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
      // All stages cleared — won!
      survival.status = 'won';
      survival.currentRoomCode = null;
      survival.completedAt = new Date();
      await survival.save();
      payload.tournamentOver = true;
      payload.won = true;
      payload.totalPointsEarned = survival.totalPointsEarned;
      // Bonus XP for full championship win
      awardXp(io, {
        userId: survival.userId,
        baseXp: XP_REWARDS.COMPLETE_SURVIVAL,
        isBot: true, won: true,
        isSurvivalWin: true,
      }).catch(console.error);
    } else {
      // Prepare next stage room
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
      await Room.create({
        code: nextCode,
        name: `Survival S${nextStage} — ${humanUser.username}`.slice(0, 30),
        hostId: survival.userId,
        players: [{ userId: survival.userId, username: humanUser.username, avatar: humanUser.avatar, isReady: true, isHost: true, isBot: false }],
        config: { maxPlayers: 2, roundCount: 3, isPrivate: true, turnTimeLimit: 30, allowBots: true, botCount: 1, entryFee: 0, botPersonality: nextStageConfig.personality },
        paidPlayerIds: [],
        status: 'waiting',
      });

      survival.currentStage = nextStage;
      survival.currentRoomCode = nextCode;
      await survival.save();

      payload.tournamentOver = false;
      payload.nextStage = nextStage;
      payload.nextRoomCode = nextCode;
      payload.nextBotName = nextStageConfig.name;
      payload.nextPersonality = nextStageConfig.personality;
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
                setBotPersonality(game.id, stageConfig.personality);
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
        if (game) setBotPersonality(game.id, 'safe');

        emitGameState(socket, roomCode, userId);
        socket.emit('survival:started', {
          survivalId:   survival.id,
          tier,
          currentStage: 1,
          totalStages:  5,
          entryPoints:  tierCfg.entryPoints,
          roomCode,
          botName:      SURVIVAL_STAGES[0].name,
          personality:  SURVIVAL_STAGES[0].personality,
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
          setBotPersonality(game.id, stageConfig.personality);
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
