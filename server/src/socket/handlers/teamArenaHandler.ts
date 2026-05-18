import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { Room } from "../../models/Room";
import { User } from "../../models/User";
import { Transaction } from "../../models/Transaction";
import {
  TeamArenaTournament,
  TEAM_ARENA_STAGES,
  TEAM_ARENA_ENTRY_POINTS,
  TEAM_ARENA_STAGE_REWARDS,
  AI_TEAMMATE_PROFILES,
  BotPersonality,
  TeammateType,
  EntryMode,
} from "../../models/TeamArenaTournament";
import {
  startRoomGame,
  getActiveGame,
  assignBotPersonalities,
} from "./gameHandler";
import { GameState } from "../../../../shared/src/types";
import { awardXp } from "../../utils/progressionService";
import { XP_REWARDS } from "../../utils/progression";
import { getBadge } from "../../utils/badgeCache";

const POINTS_PER_RUPEE = 100;
const TOTAL_STAGES = 5;

function pointsToRupees(points: number): number {
  return points / POINTS_PER_RUPEE;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Find the socket for a given userId
function findSocket(io: Server, userId: string): Socket | undefined {
  return [...io.sockets.sockets.values()].find(
    (s) => (s as any).userId === userId,
  ) as Socket | undefined;
}

// Emit full game state to a single socket
function emitGameState(socket: Socket, roomCode: string, userId: string) {
  const game = getActiveGame(roomCode);
  if (!game) return;
  const myPlayer = game.players.find((p) => p.userId === userId);
  socket.emit("game:state", {
    id: game.id,
    roomId: game.roomId,
    status: game.status,
    players: game.players.map((p) => ({
      id: p.id, userId: p.userId, username: p.username, avatar: p.avatar,
      handCount: p.handCount, totalScore: p.totalScore, roundScore: p.roundScore,
      isConnected: p.isConnected, isEliminated: p.isEliminated,
      seatIndex: p.seatIndex, isBot: p.isBot,
      badge: p.isBot ? undefined : getBadge(p.userId),
    })),
    discardPile: game.discardPile,
    deckCount: game.deck.length,
    jokerRank: game.jokerRank,
    jokerCard: game.jokerCard,
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    turnStartTime: game.turnStartTime,
    turnTimeLimit: game.turnTimeLimit,
    attackChain: game.attackChain,
    roundCount: game.roundCount,
    roundNumber: game.roundNumber,
    hasDrawnThisTurn: game.hasDrawnThisTurn,
    showPlayerId: game.showPlayerId,
    roundResult: game.roundResult,
    chatMessages: game.chatMessages,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? "",
  });
}

// ── Room creation ──────────────────────────────────────────────────────────────

async function createTeamArenaRoom(params: {
  hostUserId: string;
  hostUsername: string;
  hostAvatar: string;
  hostSocketId: string;
  stage: number;
  teammateType: TeammateType;
  aiTeammatePersonality: BotPersonality | null;
  teammateName: string;
  existingRoomCode?: string;
}): Promise<string> {
  const {
    hostUserId, hostUsername, hostAvatar, hostSocketId,
    stage, teammateType, aiTeammatePersonality, teammateName,
  } = params;

  const stageConfig = TEAM_ARENA_STAGES.find((s) => s.stage === stage)!;
  const secondaryPersonality = pickRandom(stageConfig.secondaryPool);

  let code: string;
  let attempts = 0;
  do {
    code = generateRoomCode();
    attempts++;
  } while ((await Room.exists({ code })) && attempts < 10);

  if (teammateType === "ai") {
    // 4-player game: host + 3 bots (enemy1, ai-teammate, enemy2)
    // Seating order: Host(0) → Enemy(1) → AITeammate(2) → Enemy(3) = alternating ✓
    const teammateBotPersonality = aiTeammatePersonality ?? "smart";

    await Room.create({
      code,
      name: `Team Arena S${stage} — ${hostUsername}`.slice(0, 30),
      hostId: hostUserId,
      players: [
        { userId: hostUserId, username: hostUsername, avatar: hostAvatar, isReady: true, isHost: true, isBot: false, socketId: hostSocketId },
      ],
      config: {
        maxPlayers: 4,
        roundCount: 3,
        isPrivate: true,
        turnTimeLimit: 30,
        allowBots: true,
        botCount: 3,
        entryFee: 0,
        // Bot insertion order defines seating: index 0 → seat 1 (enemy), index 1 → seat 2 (teammate), index 2 → seat 3 (enemy)
        botNames: [stageConfig.enemyBotNames[0], teammateName, stageConfig.enemyBotNames[1]],
        botPersonalities: [stageConfig.mainPersonality, teammateBotPersonality, secondaryPersonality],
      },
      paidPlayerIds: [],
      status: "waiting",
    });
  } else {
    // Human teammate: 4-player game: host + teammate + 2 enemy bots
    // Seating: Host(0) → Teammate(1) → Enemy(2) → Enemy(3)
    await Room.create({
      code,
      name: `Team Arena S${stage} — ${hostUsername}`.slice(0, 30),
      hostId: hostUserId,
      players: [
        { userId: hostUserId, username: hostUsername, avatar: hostAvatar, isReady: true, isHost: true, isBot: false, socketId: hostSocketId },
      ],
      config: {
        maxPlayers: 4,
        roundCount: 3,
        isPrivate: true,
        turnTimeLimit: 30,
        allowBots: true,
        botCount: 2,
        entryFee: 0,
        botNames: stageConfig.enemyBotNames,
        botPersonalities: [stageConfig.mainPersonality, secondaryPersonality],
      },
      paidPlayerIds: [],
      status: "waiting",
    });
  }

  return code!;
}

// ── Team score calculation ─────────────────────────────────────────────────────

function getPlayerScore(state: GameState, playerId: string): number {
  if (state.roundResult) {
    const pr = state.roundResult.playerResults.find((r) => r.playerId === playerId);
    if (pr) return pr.totalScore;
  }
  return state.players.find((p) => p.id === playerId)?.totalScore ?? 999;
}

function computeTeamScores(
  state: GameState,
  teammateType: TeammateType,
): { teamATotal: number; teamBTotal: number; scoreboard: any[] } {
  // Team A = seat indices 0 and 2 (host + ally)
  // Team B = seat indices 1 and 3 (enemies)
  // For human teammate mode, teammate is at seat 1 → Team B indices shift to 2,3 and Team A is 0,1
  const isAIMode = teammateType === "ai";

  const teamAIndices = isAIMode ? [0, 2] : [0, 1];
  const teamBIndices = isAIMode ? [1, 3] : [2, 3];

  const teamAPlayers = state.players.filter((p) => teamAIndices.includes(p.seatIndex));
  const teamBPlayers = state.players.filter((p) => teamBIndices.includes(p.seatIndex));

  const teamATotal = teamAPlayers.reduce((sum, p) => sum + getPlayerScore(state, p.id), 0);
  const teamBTotal = teamBPlayers.reduce((sum, p) => sum + getPlayerScore(state, p.id), 0);

  const scoreboard = [
    ...teamAPlayers.map((p) => ({
      name: p.username, score: getPlayerScore(state, p.id),
      isHuman: !p.isBot, team: "A",
    })),
    ...teamBPlayers.map((p) => ({
      name: p.username, score: getPlayerScore(state, p.id),
      isHuman: false, team: "B",
    })),
  ];

  return { teamATotal, teamBTotal, scoreboard };
}

// ── Match end hook (called by gameHandler) ─────────────────────────────────────

export async function handleTeamArenaMatchEnd(
  io: Server,
  state: GameState,
  _matchResult: any,
) {
  const tournament = await TeamArenaTournament.findOne({
    currentRoomCode: state.roomId,
    status: "active",
  });
  if (!tournament) return;

  const stageIdx = tournament.currentStage - 1;
  const stageConfig = TEAM_ARENA_STAGES.find((s) => s.stage === tournament.currentStage)!;
  const stageReward = TEAM_ARENA_STAGE_REWARDS[stageIdx] ?? 0;
  const secondaryPersonality = pickRandom(stageConfig.secondaryPool);

  const { teamATotal, teamBTotal, scoreboard } = computeTeamScores(state, tournament.teammateType);

  // Lower total score wins (same as 7-card rule)
  const teamAWon = teamATotal < teamBTotal;
  const isDraw    = teamATotal === teamBTotal;
  const resolvedWon = isDraw ? false : teamAWon;  // draw = loss for human team

  tournament.roundsPlayed = (tournament.roundsPlayed ?? 0) + state.roundNumber;
  tournament.teamAScore += teamATotal;
  tournament.teamBScore += teamBTotal;

  tournament.stageResults.push({
    stage:                tournament.currentStage,
    mainPersonality:      stageConfig.mainPersonality,
    secondaryPersonality,
    enemyBotNames:        stageConfig.enemyBotNames,
    teamAScore:           teamATotal,
    teamBScore:           teamBTotal,
    teamAWon:             resolvedWon,
    pointsEarned:         resolvedWon ? stageReward : 0,
  });

  const basePayload = {
    stage:               tournament.currentStage,
    totalStages:         TOTAL_STAGES,
    stageName:           stageConfig.name,
    stageSubtitle:       stageConfig.subtitle,
    teamAScore:          teamATotal,
    teamBScore:          teamBTotal,
    teamAWon:            resolvedWon,
    isDraw:              isDraw && !resolvedWon,
    scoreboard,
    pointsEarned:        resolvedWon ? stageReward : 0,
    stageResults:        tournament.stageResults,
    enemyBotNames:       stageConfig.enemyBotNames,
    teammateName:        tournament.teammateName,
  };

  if (!resolvedWon) {
    // Human team eliminated
    tournament.status = "lost";
    tournament.currentRoomCode = null;
    tournament.completedAt = new Date();
    await tournament.save();

    const payload = {
      ...basePayload,
      tournamentOver: true,
      won: false,
      totalPointsEarned: tournament.totalPointsEarned,
    };
    awardXp(io, { userId: tournament.hostUserId, baseXp: XP_REWARDS.LOSE_GAME, isBot: true, won: false }).catch(console.error);

    const hostSocket = findSocket(io, tournament.hostUserId);
    if (hostSocket) hostSocket.emit("team-arena:stage_result", payload);
    if (tournament.teammateUserId) {
      const teammateSocket = findSocket(io, tournament.teammateUserId);
      if (teammateSocket) teammateSocket.emit("team-arena:stage_result", payload);
    }
    return;
  }

  // Stage cleared — credit reward to host (and teammate if human)
  const rupees = pointsToRupees(stageReward);
  await User.findByIdAndUpdate(tournament.hostUserId, { $inc: { walletBalance: rupees } });
  await Transaction.create({
    userId: tournament.hostUserId,
    type: "winning",
    amount: rupees,
    status: "completed",
    description: `Team Arena Stage ${tournament.currentStage} cleared (${stageConfig.name})`,
    metadata: { teamArenaTournamentId: tournament.id, stage: tournament.currentStage },
  });

  if (tournament.teammateUserId) {
    await User.findByIdAndUpdate(tournament.teammateUserId, { $inc: { walletBalance: rupees } });
    await Transaction.create({
      userId: tournament.teammateUserId,
      type: "winning",
      amount: rupees,
      status: "completed",
      description: `Team Arena Stage ${tournament.currentStage} cleared (${stageConfig.name}) — teammate reward`,
      metadata: { teamArenaTournamentId: tournament.id, stage: tournament.currentStage },
    });
  }

  tournament.totalPointsEarned += stageReward;

  const newWalletBalance = (await User.findById(tournament.hostUserId).select("walletBalance").lean())?.walletBalance ?? 0;

  awardXp(io, {
    userId: tournament.hostUserId,
    baseXp: tournament.currentStage === 5 ? XP_REWARDS.WIN_SURVIVAL_BOSS : XP_REWARDS.WIN_SURVIVAL_STAGE,
    isBot: true, won: true,
    isSurvivalStage: true,
    isSurvivalBoss: tournament.currentStage === 5,
    stageClearedNum: tournament.currentStage,
  }).catch(console.error);

  if (tournament.currentStage >= TOTAL_STAGES) {
    // Tournament won!
    tournament.status = "won";
    tournament.currentRoomCode = null;
    tournament.completedAt = new Date();
    await tournament.save();

    const payload = {
      ...basePayload,
      tournamentOver: true,
      won: true,
      totalPointsEarned: tournament.totalPointsEarned,
      newWalletBalance,
    };

    const hostSocket = findSocket(io, tournament.hostUserId);
    if (hostSocket) hostSocket.emit("team-arena:stage_result", payload);
    if (tournament.teammateUserId) {
      const teammateSocket = findSocket(io, tournament.teammateUserId);
      if (teammateSocket) teammateSocket.emit("team-arena:stage_result", payload);
    }
    return;
  }

  // Advance to next stage
  const nextStage = tournament.currentStage + 1;
  const hostUser = await User.findById(tournament.hostUserId).select("username avatar");
  if (!hostUser) { await tournament.save(); return; }

  let nextCode: string;
  let att = 0;
  do {
    nextCode = generateRoomCode();
    att++;
  } while ((await Room.exists({ code: nextCode })) && att < 10);

  const nextStageConfig = TEAM_ARENA_STAGES.find((s) => s.stage === nextStage)!;
  const nextSecondary = pickRandom(nextStageConfig.secondaryPool);

  if (tournament.teammateType === "ai") {
    const teammateBotPersonality = tournament.teamAiPersonality ?? "smart";
    await Room.create({
      code: nextCode,
      name: `Team Arena S${nextStage} — ${hostUser.username}`.slice(0, 30),
      hostId: tournament.hostUserId,
      players: [{
        userId: tournament.hostUserId, username: hostUser.username,
        avatar: hostUser.avatar, isReady: true, isHost: true, isBot: false,
      }],
      config: {
        maxPlayers: 4,
        roundCount: 3,
        isPrivate: true,
        turnTimeLimit: 30,
        allowBots: true,
        botCount: 3,
        entryFee: 0,
        botNames: [nextStageConfig.enemyBotNames[0], tournament.teammateName, nextStageConfig.enemyBotNames[1]],
        botPersonalities: [nextStageConfig.mainPersonality, teammateBotPersonality, nextSecondary],
      },
      paidPlayerIds: [],
      status: "waiting",
    });
  } else {
    // Human teammate — create room and send invite
    await Room.create({
      code: nextCode,
      name: `Team Arena S${nextStage} — ${hostUser.username}`.slice(0, 30),
      hostId: tournament.hostUserId,
      players: [{
        userId: tournament.hostUserId, username: hostUser.username,
        avatar: hostUser.avatar, isReady: true, isHost: true, isBot: false,
      }],
      config: {
        maxPlayers: 4,
        roundCount: 3,
        isPrivate: true,
        turnTimeLimit: 30,
        allowBots: true,
        botCount: 2,
        entryFee: 0,
        botNames: nextStageConfig.enemyBotNames,
        botPersonalities: [nextStageConfig.mainPersonality, nextSecondary],
      },
      paidPlayerIds: [],
      status: "waiting",
    });
  }

  tournament.currentStage = nextStage;
  tournament.currentRoomCode = nextCode;
  await tournament.save();

  const payload = {
    ...basePayload,
    tournamentOver: false,
    nextStage,
    nextStageName: nextStageConfig.name,
    nextStageSubtitle: nextStageConfig.subtitle,
    nextStageConfig,
    nextRoomCode: nextCode,
    totalPointsEarned: tournament.totalPointsEarned,
    newWalletBalance,
  };

  const hostSocket = findSocket(io, tournament.hostUserId);
  if (hostSocket) hostSocket.emit("team-arena:stage_result", payload);
  if (tournament.teammateUserId) {
    const teammateSocket = findSocket(io, tournament.teammateUserId);
    if (teammateSocket) teammateSocket.emit("team-arena:stage_result", payload);
  }
}

// ── Force-end hook (called by admin handler) ──────────────────────────────────

export async function handleTeamArenaForceEnd(io: Server, roomCode: string) {
  try {
    const t = await TeamArenaTournament.findOne({ currentRoomCode: roomCode, status: "active" });
    if (!t) return;
    t.status = "abandoned";
    t.currentRoomCode = null;
    t.completedAt = new Date();
    await t.save();

    const payload = { totalPointsEarned: t.totalPointsEarned, refunded: false, forcedByAdmin: true };
    const hostSocket = findSocket(io, t.hostUserId);
    if (hostSocket) hostSocket.emit("team-arena:abandoned", payload);
    if (t.teammateUserId) {
      const ts = findSocket(io, t.teammateUserId);
      if (ts) ts.emit("team-arena:abandoned", payload);
    }
  } catch (err) {
    console.error("[TeamArena] Force-end error:", err);
  }
}

// ── Socket handler registration ────────────────────────────────────────────────

export function registerTeamArenaHandlers(io: Server, socket: Socket) {
  const userId: string   = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string   = (socket as any).avatar;
  const isGuest: boolean = (socket as any).isGuest;

  // ── Start tournament ───────────────────────────────────────────────────────

  socket.on("team-arena:start", async (data: {
    teammateType: TeammateType;
    aiPersonality?: BotPersonality;
    entryMode: EntryMode;
  }) => {
    try {
      if (isGuest) return socket.emit("team-arena:error", "Guests cannot join tournaments. Please sign in.");

      const { teammateType, aiPersonality, entryMode } = data;

      // Block if active survival or team arena already running
      const existingTA = await TeamArenaTournament.findOne({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["waiting_teammate", "active"] },
      });
      if (existingTA) {
        return socket.emit("team-arena:error", "You already have an active Team Arena tournament. Abandon it first.");
      }

      // Entry fee logic
      const entryPoints = teammateType === "ai"
        ? TEAM_ARENA_ENTRY_POINTS * 2        // AI teammate = double entry
        : TEAM_ARENA_ENTRY_POINTS;           // Human teammate = normal (split or host pays)

      const hostPays = teammateType === "ai" || entryMode === "host_pays"
        ? entryPoints
        : Math.ceil(entryPoints / 2);       // split: host pays half

      const entryRupees = pointsToRupees(hostPays);
      const user = await User.findById(userId).select("walletBalance");
      if (!user) return socket.emit("team-arena:error", "User not found");
      if ((user.walletBalance ?? 0) < entryRupees) {
        return socket.emit("team-arena:error",
          `Insufficient balance. Need ₹${entryRupees.toFixed(2)} (${hostPays} pts) to enter.`);
      }

      // Determine teammate name
      const aiProfile = AI_TEAMMATE_PROFILES.find((p) => p.personality === aiPersonality);
      const teammateName = teammateType === "ai"
        ? (aiProfile?.name ?? "Oracle")
        : "Teammate";  // will be updated when human joins

      // Deduct entry fee
      await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryRupees } });

      let roomCode: string | undefined;
      let tournament: any;
      let inviteCode: string;

      try {
        // Generate unique invite code for human teammate
        let invAttempts = 0;
        do {
          inviteCode = generateInviteCode();
          invAttempts++;
        } while ((await TeamArenaTournament.exists({ inviteCode })) && invAttempts < 10);

        roomCode = await createTeamArenaRoom({
          hostUserId: userId,
          hostUsername: username,
          hostAvatar: avatar,
          hostSocketId: socket.id,
          stage: 1,
          teammateType,
          aiTeammatePersonality: aiPersonality ?? null,
          teammateName,
        });

        tournament = await TeamArenaTournament.create({
          hostUserId: userId,
          teammateType,
          entryMode: teammateType === "ai" ? "host_pays" : entryMode,
          teamAiPersonality: aiPersonality ?? null,
          teammateName,
          teammateUserId: null,
          status: teammateType === "ai" ? "active" : "waiting_teammate",
          currentStage: 1,
          entryPoints,
          currentRoomCode: roomCode,
          inviteCode: inviteCode!,
          paidUserIds: [userId],
        });

        await Transaction.create({
          userId,
          type: "entry_fee",
          amount: entryRupees,
          status: "completed",
          description: `Team Arena entry${teammateType === "ai" ? " (with AI teammate)" : " (host pays)"}`,
          metadata: { teamArenaTournamentId: tournament.id },
        });

        await socket.join(roomCode);
        socket.data.roomCode = roomCode;

        if (teammateType === "ai") {
          // AI teammate: start immediately
          await startRoomGame(io, roomCode);
          const game = getActiveGame(roomCode);
          if (game) {
            const teammateBotPersonality = aiPersonality ?? "smart";
            const stageConfig = TEAM_ARENA_STAGES[0];
            const secondaryPersonality = pickRandom(stageConfig.secondaryPool);
            const bots = game.players.filter((p) => p.isBot);
            // bots[0]=enemy1(seat1), bots[1]=aiTeammate(seat2), bots[2]=enemy2(seat3)
            assignBotPersonalities(game.id, [
              { userId: bots[0]?.userId, personality: stageConfig.mainPersonality },
              { userId: bots[1]?.userId, personality: teammateBotPersonality },
              { userId: bots[2]?.userId, personality: secondaryPersonality },
            ].filter((x) => x.userId));
          }
          emitGameState(socket, roomCode, userId);
        }

        socket.emit("team-arena:started", {
          tournamentId:     tournament.id,
          inviteCode:       inviteCode!,
          teammateType,
          teammateName,
          aiPersonality:    aiPersonality ?? null,
          entryPoints,
          currentStage:     1,
          totalStages:      TOTAL_STAGES,
          roomCode:         teammateType === "ai" ? roomCode : undefined,
          stageConfig:      TEAM_ARENA_STAGES[0],
          waitingForTeammate: teammateType === "human",
        });

      } catch (err) {
        console.error("[TeamArena] Setup error:", err);
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: entryRupees } });
        if (roomCode) await Room.deleteOne({ code: roomCode }).catch(() => {});
        if (tournament?.id) await TeamArenaTournament.deleteOne({ _id: tournament.id }).catch(() => {});
        socket.emit("team-arena:error", "Failed to start tournament. Please try again.");
      }
    } catch (err) {
      console.error("[TeamArena] Start error:", err);
      socket.emit("team-arena:error", "Failed to start tournament. Please try again.");
    }
  });

  // ── Human teammate joins via invite code ───────────────────────────────────

  socket.on("team-arena:join_as_teammate", async (data: { inviteCode: string }) => {
    try {
      if (isGuest) return socket.emit("team-arena:error", "Guests cannot join tournaments. Please sign in.");

      const tournament = await TeamArenaTournament.findOne({
        inviteCode: data.inviteCode,
        status: "waiting_teammate",
      });
      if (!tournament) return socket.emit("team-arena:error", "Invalid or expired invite code.");
      if (tournament.hostUserId === userId) return socket.emit("team-arena:error", "You cannot join your own team as teammate.");

      // Check if teammate already has active tournament
      const existingTA = await TeamArenaTournament.findOne({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["waiting_teammate", "active"] },
        _id: { $ne: tournament.id },
      });
      if (existingTA) return socket.emit("team-arena:error", "You already have an active Team Arena tournament.");

      // Handle split payment
      let teammatePays = 0;
      if (tournament.entryMode === "split") {
        teammatePays = Math.floor(tournament.entryPoints / 2);
        const entryRupees = pointsToRupees(teammatePays);
        const user = await User.findById(userId).select("walletBalance");
        if (!user) return socket.emit("team-arena:error", "User not found");
        if ((user.walletBalance ?? 0) < entryRupees) {
          return socket.emit("team-arena:error",
            `Insufficient balance. Need ₹${entryRupees.toFixed(2)} (${teammatePays} pts) to join.`);
        }
        await User.findByIdAndUpdate(userId, { $inc: { walletBalance: -entryRupees } });
        await Transaction.create({
          userId,
          type: "entry_fee",
          amount: entryRupees,
          status: "completed",
          description: "Team Arena entry (split — teammate share)",
          metadata: { teamArenaTournamentId: tournament.id },
        });
      }

      // Update tournament with teammate info
      tournament.teammateUserId = userId;
      tournament.teammateName   = username;
      tournament.status         = "active";
      if (!tournament.paidUserIds.includes(userId)) tournament.paidUserIds.push(userId);
      await tournament.save();

      // Add teammate to the room
      if (tournament.currentRoomCode) {
        await Room.findOneAndUpdate(
          { code: tournament.currentRoomCode },
          {
            $push: {
              players: {
                userId, username, avatar,
                isReady: true, isHost: false, isBot: false,
                socketId: socket.id,
              },
            },
          },
        );
        await socket.join(tournament.currentRoomCode);
        socket.data.roomCode = tournament.currentRoomCode;

        // Check if game is already running (shouldn't be for human mode)
        if (!getActiveGame(tournament.currentRoomCode)) {
          await startRoomGame(io, tournament.currentRoomCode);
          const game = getActiveGame(tournament.currentRoomCode);
          if (game) {
            const stageConfig = TEAM_ARENA_STAGES[0];
            const secondaryPersonality = pickRandom(stageConfig.secondaryPool);
            const bots = game.players.filter((p) => p.isBot);
            assignBotPersonalities(game.id, bots.map((b, i) => ({
              userId: b.userId,
              personality: i === 0 ? stageConfig.mainPersonality : secondaryPersonality,
            })));
          }
        }
      }

      // Notify host their teammate has joined
      const hostSocket = findSocket(io, tournament.hostUserId);
      if (hostSocket) {
        hostSocket.emit("team-arena:teammate_joined", {
          teammateId: userId, teammateName: username, teammateAvatar: avatar,
          roomCode: tournament.currentRoomCode,
        });
        if (tournament.currentRoomCode) {
          emitGameState(hostSocket, tournament.currentRoomCode, tournament.hostUserId);
        }
      }

      // Send state to teammate
      socket.emit("team-arena:started", {
        tournamentId:  tournament.id,
        inviteCode:    tournament.inviteCode,
        teammateType:  "human",
        teammateName:  tournament.teammateName,
        entryPoints:   tournament.entryPoints,
        currentStage:  tournament.currentStage,
        totalStages:   TOTAL_STAGES,
        roomCode:      tournament.currentRoomCode,
        stageConfig:   TEAM_ARENA_STAGES[0],
        waitingForTeammate: false,
        isTeammate:    true,
      });
      if (tournament.currentRoomCode) {
        emitGameState(socket, tournament.currentRoomCode, userId);
      }
    } catch (err) {
      console.error("[TeamArena] Join as teammate error:", err);
      socket.emit("team-arena:error", "Failed to join tournament.");
    }
  });

  // ── Continue to next stage ─────────────────────────────────────────────────

  socket.on("team-arena:continue", async () => {
    try {
      const tournament = await TeamArenaTournament.findOne({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: "active",
      });
      if (!tournament || !tournament.currentRoomCode) {
        return socket.emit("team-arena:error", "No active Team Arena tournament");
      }

      await socket.join(tournament.currentRoomCode);
      socket.data.roomCode = tournament.currentRoomCode;

      if (!getActiveGame(tournament.currentRoomCode)) {
        await startRoomGame(io, tournament.currentRoomCode);
        const game = getActiveGame(tournament.currentRoomCode);
        if (game && tournament.teammateType === "ai") {
          const stageConfig = TEAM_ARENA_STAGES.find((s) => s.stage === tournament.currentStage)!;
          const secondaryPersonality = pickRandom(stageConfig.secondaryPool);
          const teammateBotPersonality = tournament.teamAiPersonality ?? "smart";
          const bots = game.players.filter((p) => p.isBot);
          assignBotPersonalities(game.id, [
            { userId: bots[0]?.userId, personality: stageConfig.mainPersonality },
            { userId: bots[1]?.userId, personality: teammateBotPersonality },
            { userId: bots[2]?.userId, personality: secondaryPersonality },
          ].filter((x) => x.userId));
        }
      }

      emitGameState(socket, tournament.currentRoomCode, userId);
    } catch (err) {
      console.error("[TeamArena] Continue error:", err);
      socket.emit("team-arena:error", "Failed to load next stage");
    }
  });

  // ── Query status ───────────────────────────────────────────────────────────

  socket.on("team-arena:status", async () => {
    try {
      const t = await TeamArenaTournament.findOne({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["waiting_teammate", "active"] },
      });
      if (!t) return socket.emit("team-arena:status_result", null);

      const hasPlayedRounds = (t.roundsPlayed ?? 0) > 0 || t.stageResults.length > 0;
      socket.emit("team-arena:status_result", {
        tournamentId:   t.id,
        inviteCode:     t.inviteCode,
        teammateType:   t.teammateType,
        teammateName:   t.teammateName,
        entryMode:      t.entryMode,
        status:         t.status,
        currentStage:   t.currentStage,
        totalStages:    TOTAL_STAGES,
        entryPoints:    t.entryPoints,
        totalPointsEarned: t.totalPointsEarned,
        stageResults:   t.stageResults,
        currentRoomCode: t.currentRoomCode,
        hasPlayedRounds,
        isHost:         t.hostUserId === userId,
      });
    } catch { /* ignore */ }
  });

  // ── Abandon tournament ─────────────────────────────────────────────────────

  socket.on("team-arena:abandon", async () => {
    try {
      const t = await TeamArenaTournament.findOne({
        $or: [{ hostUserId: userId }, { teammateUserId: userId }],
        status: { $in: ["waiting_teammate", "active"] },
      });
      if (!t) return socket.emit("team-arena:error", "No active Team Arena tournament");

      const activeGame = t.currentRoomCode ? getActiveGame(t.currentRoomCode) : null;
      const totalRoundsPlayed = (t.roundsPlayed ?? 0) + (activeGame ? activeGame.roundNumber - 1 : 0);
      const giveRefund = totalRoundsPlayed === 0 && t.stageResults.length === 0;

      t.status = "abandoned";
      t.completedAt = new Date();
      t.currentRoomCode = null;
      await t.save();

      if (giveRefund) {
        for (const uid of t.paidUserIds) {
          const share = uid === t.hostUserId
            ? pointsToRupees(t.entryMode === "split" ? Math.ceil(t.entryPoints / 2) : t.entryPoints)
            : pointsToRupees(Math.floor(t.entryPoints / 2));
          await User.findByIdAndUpdate(uid, { $inc: { walletBalance: share } });
          await Transaction.create({
            userId: uid,
            type: "refund",
            amount: share,
            status: "completed",
            description: "Team Arena refund — quit before playing",
            metadata: { teamArenaTournamentId: t.id },
          });
        }
      }

      const abandonPayload = {
        totalPointsEarned: t.totalPointsEarned,
        refunded: giveRefund,
        refundAmount: giveRefund ? t.entryPoints : 0,
      };
      socket.emit("team-arena:abandoned", abandonPayload);

      // Notify teammate if human
      if (t.teammateUserId && t.teammateUserId !== userId) {
        const ts = findSocket(io, t.teammateUserId);
        if (ts) ts.emit("team-arena:abandoned", { ...abandonPayload, hostLeft: true });
      } else if (t.hostUserId !== userId) {
        const hs = findSocket(io, t.hostUserId);
        if (hs) hs.emit("team-arena:abandoned", { ...abandonPayload, teammateLeft: true });
      }
    } catch (err) {
      socket.emit("team-arena:error", "Failed to quit tournament");
    }
  });
}
