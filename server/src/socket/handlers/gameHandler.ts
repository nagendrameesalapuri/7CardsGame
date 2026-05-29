/**
 * gameHandler — Wires socket events to the GameEngine.
 *
 * State is kept in memory (Map) for low latency; persisted to MongoDB at round end.
 * The server is authoritative — clients only send intent, server validates + broadcasts.
 */

import { Server, Socket } from "socket.io";
import { Room } from "../../models/Room";
import { cancelPendingAbandon, lockEntryHold } from "./roomHandler";
import { Game } from "../../models/Game";
import { User } from "../../models/User";
import { PlayerProgress } from "../../models/PlayerProgress";
import { Transaction } from "../../models/Transaction";
import { GameEngine, GameConfig } from "../../engine/GameEngine";
import {
  BotPlayer,
  BotPersonality,
  OpponentProfile,
} from "../../engine/BotPlayer";
import { ScoreEngine } from "../../engine/ScoreEngine";
import {
  GameState,
  ClientGameState,
  DrawSource,
  MatchResult,
} from "../../../../shared/src/types";
import { v4 as uuidv4 } from "uuid";
import { broadcastToSpectators } from "./spectatorHandler";
import {
  handleSurvivalMatchEnd,
  handleSurvivalForceEnd,
} from "./survivalHandler";
import { awardXp } from "../../utils/progressionService";
import {
  XP_REWARDS,
  calculateBotDifficultyBoost,
  estimatePlayerStyle,
} from "../../utils/progression";
import { getBadge } from "../../utils/badgeCache";
import { recordEvent } from "../../utils/gameAnalytics";
import { notifyWinStreak } from "../../services/notificationTriggers";
import { getOnlineUserIds } from "../index";
import { teamArenaAugment, isTeamArenaGame } from "../../engine/TeamArenaCoordinator";

// In-memory game state store  (gameId → GameState)
const activeGames = new Map<string, GameState>();
// Room code → gameId
const roomToGame = new Map<string, string>();
// Turn timers (gameId → NodeJS.Timeout)
const turnTimers = new Map<string, NodeJS.Timeout>();
// Per-game tournament timeout counts (gameId → userId → count)
const gameTimeoutCounts = new Map<string, Record<string, number>>();
// Ready-for-next-round tracking: gameId → Set of userIds who have clicked "Play Next Round"
const roundReadyPlayers = new Map<string, Set<string>>();
// Auto-advance timers: if not all humans click "Next Round" within 20 s, advance anyway
const roundAutoAdvanceTimers = new Map<string, NodeJS.Timeout>();
// Survival bot personality per game (gameId → personality, shared fallback)
const gameBotPersonality = new Map<string, BotPersonality>();
// Per-bot personality override (gameId → botUserId → personality) for multi-bot stages
const gameBotPersonalitiesMap = new Map<string, Map<string, BotPersonality>>();
const gameDifficultyBoost = new Map<string, number>();
// In-match behavior tracking for opponent modeling
const gameBehavior = new Map<
  string,
  Map<
    string,
    {
      draws: number;
      cuts: number;
      showAttempts: number;
      attackThrows: number;
      attackTakes: number;
      handCountHistory: number[];
    }
  >
>();

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveGame(roomCode: string): GameState | undefined {
  const gid = roomToGame.get(roomCode);
  return gid ? activeGames.get(gid) : undefined;
}

// Used by team survival handler to force a fixed high difficulty for enemy bots.
// Does NOT affect solo/individual tournament games.
export function overrideGameDifficultyBoost(roomCode: string, boost: number): void {
  const gid = roomToGame.get(roomCode);
  if (gid) gameDifficultyBoost.set(gid, Math.min(0.35, Math.max(0, boost)));
}

export function getActiveGameByUserId(
  userId: string,
): { game: GameState; roomCode: string } | undefined {
  for (const [roomCode, gameId] of roomToGame.entries()) {
    const game = activeGames.get(gameId);
    if (
      game &&
      game.players.some((p) => p.userId === userId && !p.isEliminated)
    ) {
      return { game, roomCode };
    }
  }
  return undefined;
}

export function getAllActiveGamesByUserId(
  userId: string,
): Array<{ game: GameState; roomCode: string }> {
  const results: Array<{ game: GameState; roomCode: string }> = [];
  for (const [roomCode, gameId] of roomToGame.entries()) {
    const game = activeGames.get(gameId);
    if (game && game.players.some((p) => p.userId === userId && !p.isEliminated)) {
      results.push({ game, roomCode });
    }
  }
  return results;
}

export function getAllActiveRoomInfos() {
  const result: {
    roomCode: string;
    name: string;
    status: string;
    playerCount: number;
    maxPlayers: number;
    roundNumber: number;
    roundCount: number;
    players: { username: string; userId: string; isBot: boolean }[];
  }[] = [];
  for (const [roomCode, gameId] of roomToGame.entries()) {
    const game = activeGames.get(gameId);
    if (!game) continue;
    result.push({
      roomCode,
      name: roomCode,
      status: game.status,
      playerCount: game.players.filter((p) => !p.isEliminated).length,
      maxPlayers: game.players.length,
      roundNumber: game.roundNumber,
      roundCount: game.roundCount,
      players: game.players.map((p) => ({
        username: p.username,
        userId: p.userId,
        isBot: p.isBot,
      })),
    });
  }
  return result;
}

export function setBotPersonality(gameId: string, personality: BotPersonality) {
  gameBotPersonality.set(gameId, personality);
}

// Assign distinct personalities to individual bots (for multi-bot stages)
export function assignBotPersonalities(
  gameId: string,
  assignments: Array<{ userId: string; personality: BotPersonality }>,
) {
  const map = new Map<string, BotPersonality>();
  for (const a of assignments) map.set(a.userId, a.personality);
  gameBotPersonalitiesMap.set(gameId, map);
  // Also set shared fallback to the first personality
  if (assignments[0]) gameBotPersonality.set(gameId, assignments[0].personality);
}

// Resolve personality for a specific bot in a game
function getBotPersonality(state: GameState, botPlayerId: string): BotPersonality {
  const bot = state.players.find((p) => p.id === botPlayerId);
  if (bot) {
    const perBot = gameBotPersonalitiesMap.get(state.id);
    if (perBot) {
      const p = perBot.get(bot.userId);
      if (p) return p;
    }
  }
  return gameBotPersonality.get(state.id) ?? "smart";
}

async function initGameDifficultyBoost(gameState: GameState) {
  const humanIds = gameState.players
    .filter((p) => !p.isBot && p.userId)
    .map((p) => p.userId);

  if (humanIds.length === 0) {
    gameDifficultyBoost.set(gameState.id, 0);
    return;
  }

  const progresses = await PlayerProgress.find({ userId: { $in: humanIds } });
  const boost = progresses.reduce((maxBoost, p) => {
    const current = calculateBotDifficultyBoost({
      botGamesThisHour: p.botGamesThisHour,
      winStreak: p.winStreak,
      recentOpponentTypes: p.recentOpponentTypes,
      recentPlayerStyles: p.recentPlayerStyles,
      totalWins: p.totalWins,
      totalGames: p.totalGames,
    });
    return Math.max(maxBoost, current);
  }, 0);
  gameDifficultyBoost.set(gameState.id, boost);
}

function getBehaviorTracker(gameId: string, userId: string) {
  const behaviors = gameBehavior.get(gameId) ?? new Map<string, any>();
  if (!gameBehavior.has(gameId)) gameBehavior.set(gameId, behaviors);
  if (!behaviors.has(userId)) {
    behaviors.set(userId, {
      draws: 0,
      cuts: 0,
      showAttempts: 0,
      attackThrows: 0,
      attackTakes: 0,
      handCountHistory: [],
    });
  }
  return behaviors.get(userId)!;
}

function recordPlayerAction(
  gameId: string,
  userId: string,
  update: Partial<ReturnType<typeof getBehaviorTracker>>,
) {
  const tracker = getBehaviorTracker(gameId, userId);
  Object.assign(tracker, {
    draws:
      update.draws !== undefined ? tracker.draws + update.draws : tracker.draws,
    cuts: update.cuts !== undefined ? tracker.cuts + update.cuts : tracker.cuts,
    showAttempts:
      update.showAttempts !== undefined
        ? tracker.showAttempts + update.showAttempts
        : tracker.showAttempts,
    attackThrows:
      update.attackThrows !== undefined
        ? tracker.attackThrows + update.attackThrows
        : tracker.attackThrows,
    attackTakes:
      update.attackTakes !== undefined
        ? tracker.attackTakes + update.attackTakes
        : tracker.attackTakes,
  });
  if (update.handCountHistory !== undefined) {
    tracker.handCountHistory.push(update.handCountHistory);
    if (tracker.handCountHistory.length > 12) tracker.handCountHistory.shift();
  }
}

function buildOpponentProfiles(state: GameState): OpponentProfile[] {
  const behaviors = gameBehavior.get(state.id) ?? new Map<string, any>();
  return state.players
    .filter((p) => !p.isBot && !p.isEliminated)
    .map((p) => {
      const tracker = behaviors.get(p.userId) ?? {
        draws: 0,
        cuts: 0,
        showAttempts: 0,
        attackThrows: 0,
        attackTakes: 0,
        handCountHistory: [],
      };
      return {
        userId: p.userId,
        handCount: p.handCount,
        archetype: estimatePlayerStyle(tracker),
        recentDraws: tracker.draws,
        recentCuts: tracker.cuts,
        recentShows: tracker.showAttempts,
        recentAttackThrows: tracker.attackThrows,
        recentAttackTakes: tracker.attackTakes,
        handCountHistory: tracker.handCountHistory,
      };
    });
}

async function persistPlayerStyles(state: GameState) {
  const behaviors = gameBehavior.get(state.id);
  if (!behaviors) return;

  for (const player of state.players.filter((p) => !p.isBot)) {
    const tracker = behaviors.get(player.userId);
    if (!tracker) continue;
    const style = estimatePlayerStyle(tracker);
    await PlayerProgress.findOneAndUpdate(
      { userId: player.userId },
      { $push: { recentPlayerStyles: { $each: [style], $slice: -10 } } },
      { upsert: true, new: true },
    ).catch(console.error);
  }
}

export function forceEndGame(io: Server, roomCode: string): boolean {
  const gameId = roomToGame.get(roomCode);
  if (!gameId) return false;
  const state = activeGames.get(gameId);
  if (!state) return false;

  io.to(roomCode).emit("game:force_ended", {
    message: "Game was ended by an admin",
  });

  activeGames.delete(gameId);
  roomToGame.delete(roomCode);
  roundReadyPlayers.delete(gameId);
  const rat = roundAutoAdvanceTimers.get(gameId);
  if (rat) { clearTimeout(rat); roundAutoAdvanceTimers.delete(gameId); }
  gameDifficultyBoost.delete(gameId);
  gameBotPersonality.delete(gameId);
  gameBotPersonalitiesMap.delete(gameId);
  gameTimeoutCounts.delete(gameId);
  if (state) state.players.filter(p => p.isBot).forEach(b => BotPlayer.cleanupBotContext(b.id));
  cancelTurnTimer(gameId);

  Room.findOneAndUpdate({ code: roomCode }, { status: "finished" }).catch(
    console.error,
  );
  handleSurvivalForceEnd(io, roomCode).catch(console.error);
  return true;
}

// ── Shared game initializer (used by room:start and tournament handler) ─────────

export async function startRoomGame(
  io: Server,
  roomCode: string,
  options?: { disableElimination?: boolean },
): Promise<void> {
  const room = await Room.findOne({ code: roomCode });
  if (!room) return;

  const botNamesConfig: string[] = (room.config as any).botNames ?? [];
  const botPersonalitiesConfig: BotPersonality[] = (room.config as any).botPersonalities ?? [];
  const singleBotPersonality: string = (room.config as any).botPersonality ?? '';

  const PERSONALITY_NAMES: Record<string, string> = {
    safe: 'Safe Bot', aggressive: 'Aggressive Bot', bluff: 'Bluff Bot', smart: 'Smart AI', boss: 'Boss AI',
  };

  const botPlayers = Array.from({ length: room.config.botCount }, (_, i) => {
    const personality = botPersonalitiesConfig[i] ?? (i === 0 && singleBotPersonality ? singleBotPersonality : 'smart');
    return {
      userId: `bot_${uuidv4().slice(0, 6)}`,
      username: botNamesConfig[i]
        ?? (botPersonalitiesConfig[i] ? PERSONALITY_NAMES[botPersonalitiesConfig[i]] : undefined)
        ?? (i === 0 && singleBotPersonality ? PERSONALITY_NAMES[singleBotPersonality] : undefined)
        ?? `Bot ${i + 1}`,
      avatar: `bot_${personality}`,
      isBot: true,
    };
  });

  const allPlayers = [
    ...room.players.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      isBot: p.isBot,
    })),
    ...botPlayers,
  ].map((p) => ({ ...p, id: uuidv4() }));

  const config: GameConfig = {
    roomId: room.code,
    players: allPlayers,
    roundCount: room.config.roundCount,
    turnTimeLimit: room.config.turnTimeLimit,
    disableElimination: options?.disableElimination ?? false,
  };

  const gameState = GameEngine.initializeGame(config);
  activeGames.set(gameState.id, gameState);
  gameDifficultyBoost.set(gameState.id, 0);
  await initGameDifficultyBoost(gameState);
  roomToGame.set(room.code, gameState.id);

  // Apply per-bot personalities (multi-bot stages) or shared personality (single-bot)
  if (botPersonalitiesConfig.length > 0) {
    const bots = gameState.players.filter((p) => p.isBot);
    assignBotPersonalities(gameState.id, bots.map((b, i) => ({
      userId: b.userId,
      personality: botPersonalitiesConfig[i] ?? botPersonalitiesConfig[0],
    })));
  } else {
    const personality = (room.config as any).botPersonality ?? "smart";
    setBotPersonality(gameState.id, personality);
  }

  // ── ENTRY LOCK for tournament-launched rooms ────────────────────────────
  const roomEntryFee = (room.config as any).entryFee ?? 0;
  if (roomEntryFee > 0 && room.heldPlayerIds?.length) {
    const lockedIds: string[] = [];
    for (const pid of room.heldPlayerIds) {
      const ok = await lockEntryHold(pid, roomEntryFee, room.code);
      if (ok) lockedIds.push(pid);
    }
    room.paidPlayerIds = lockedIds;
    room.heldPlayerIds = [];
  }

  room.status = "playing";
  room.matchState = "live";
  room.gameId = gameState.id;
  await room.save();

  await Game.create({
    roomId: room.code,
    players: allPlayers.map((p) => ({
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      totalScore: 0,
      isBot: p.isBot,
    })),
    roundCount: config.roundCount,
    entryFee: roomEntryFee,
    status: "playing",
  });

  recordEvent({
    type: "game_started",
    gameId: gameState.id,
    botCount: gameState.players.filter((p) => p.isBot).length,
    humanCount: gameState.players.filter((p) => !p.isBot).length,
    botPersonality: gameBotPersonality.get(gameState.id) ?? "smart",
    difficultyBoost: gameDifficultyBoost.get(gameState.id) ?? 0,
  });

  // v3: Eagerly initialise bot contexts so match modifier is ready for the intro
  const gameBots = gameState.players.filter((p) => p.isBot);
  for (const bot of gameBots) BotPlayer.initBotContext(bot.id);

  broadcastGameState(io, gameState);

  // v3: Emit AI intro flavor text after game state so the UI can display it
  if (gameBots.length > 0) {
    const introPersonality = gameBotPersonality.get(gameState.id) ?? "smart";
    const introText = BotPlayer.getMatchIntroForBot(gameBots[0].id, introPersonality as BotPersonality);
    io.to(room.code).emit("game:ai_intro", { text: introText, personality: introPersonality });
  }

  startTurnTimer(io, gameState.id);
  scheduleBotTurnIfNeeded(io, gameState);
}

export function kickPlayerFromGame(
  io: Server,
  roomCode: string,
  userId: string,
): boolean {
  const game = getActiveGame(roomCode);
  if (!game) return false;
  const player = game.players.find((p) => p.userId === userId);
  if (!player) return false;
  player.isEliminated = true;
  player.isConnected = false;
  io.to(roomCode).emit("game:action", {
    type: "system",
    playerId: player.id,
    message: `${player.username} was removed by admin`,
    timestamp: new Date().toISOString(),
  });
  broadcastGameState(io, game);
  return true;
}

export function registerGameHandlers(io: Server, socket: Socket) {
  const userId: string = (socket as any).userId;

  // Host starts the game
  socket.on("room:start", async () => {
    try {
      // Atomic claim: transition waiting→starting so concurrent events can't double-start
      const room = await Room.findOneAndUpdate(
        { code: socket.data.roomCode, hostId: userId, status: "waiting" },
        { $set: { status: "starting" } },
        { new: true },
      );
      if (!room) {
        // Either not found, not host, or already started/starting
        const existing = await Room.findOne({ code: socket.data.roomCode }).select('hostId status').lean() as any;
        if (!existing) return socket.emit("room:error", "Room not found");
        if (existing.hostId !== userId) return socket.emit("game:error", "Only the host can start");
        return socket.emit("game:error", "Game already started");
      }

      const humans = room.players.filter((p) => !p.isBot);
      if (humans.length < 2 && room.config.botCount === 0) {
        return socket.emit("game:error", "Need at least 2 players to start");
      }

      // Double deck: 113 usable cards, 7 per player → max 10 players (70 dealt, 43 remain for draw pile)
      const totalPlayers = room.players.length + room.config.botCount;
      if (totalPlayers > 10) {
        return socket.emit(
          "game:error",
          `Too many players (max 10, got ${totalPlayers}). Reduce bot count.`,
        );
      }

      // Build player list (humans + bots)
      const roomBotNames: string[] = (room.config as any).botNames ?? [];
      const roomBotPersonalities: BotPersonality[] = (room.config as any).botPersonalities ?? [];

      const botPlayers = Array.from(
        { length: room.config.botCount },
        (_, i) => {
          const p = roomBotPersonalities[i] ?? 'smart';
          return {
            userId: `bot_${uuidv4().slice(0, 6)}`,
            username: roomBotNames[i] ?? `Bot ${i + 1}`,
            avatar: `bot_${p}`,
            isBot: true,
          };
        },
      );

      const allPlayers = [
        ...room.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          avatar: p.avatar,
          isBot: p.isBot,
        })),
        ...botPlayers,
      ].map((p) => ({ ...p, id: uuidv4() }));

      const config: GameConfig = {
        roomId: room.code,
        players: allPlayers,
        roundCount: room.config.roundCount,
        turnTimeLimit: room.config.turnTimeLimit,
      };

      const gameState = GameEngine.initializeGame(config);
      activeGames.set(gameState.id, gameState);
      gameDifficultyBoost.set(gameState.id, 0);
      await initGameDifficultyBoost(gameState);
      roomToGame.set(room.code, gameState.id);

      // Apply per-bot personalities or shared personality from room config
      if (roomBotPersonalities.length > 0) {
        const bots = gameState.players.filter((p) => p.isBot);
        assignBotPersonalities(gameState.id, bots.map((b, i) => ({
          userId: b.userId,
          personality: roomBotPersonalities[i] ?? roomBotPersonalities[0],
        })));
      } else {
        const roomPersonality = (room.config as any).botPersonality ?? "smart";
        setBotPersonality(gameState.id, roomPersonality);
      }

      // ── ENTRY LOCK: convert holds → locked entries when match goes LIVE ────
      const entryFeeAtStart = (room.config as any).entryFee ?? 0;
      if (entryFeeAtStart > 0 && room.heldPlayerIds?.length) {
        const lockedIds: string[] = [];
        for (const pid of room.heldPlayerIds) {
          const ok = await lockEntryHold(pid, entryFeeAtStart, room.code);
          if (ok) lockedIds.push(pid);
        }
        room.paidPlayerIds = lockedIds;
        room.heldPlayerIds = [];
        console.log(`[Hold] Locked entries for ${lockedIds.length} players in room ${room.code}`);
      }

      room.status = "playing";
      room.matchState = "live";
      room.gameId = gameState.id;
      await room.save();

      // Save initial game record
      await Game.create({
        roomId: room.code,
        players: allPlayers.map((p) => ({
          userId: p.userId,
          username: p.username,
          avatar: p.avatar,
          totalScore: 0,
          isBot: p.isBot,
        })),
        roundCount: config.roundCount,
        entryFee: entryFeeAtStart,
        status: "playing",
      });

      recordEvent({
        type: "game_started",
        gameId: gameState.id,
        botCount: gameState.players.filter((p) => p.isBot).length,
        humanCount: gameState.players.filter((p) => !p.isBot).length,
        botPersonality: gameBotPersonality.get(gameState.id) ?? "smart",
        difficultyBoost: gameDifficultyBoost.get(gameState.id) ?? 0,
      });

      // Broadcast personalised game state to each socket in the room
      broadcastGameState(io, gameState);

      // Start turn timer
      startTurnTimer(io, gameState.id);

      // If first player is a bot, schedule bot action
      scheduleBotTurnIfNeeded(io, gameState);
    } catch (err) {
      console.error("room:start error", err);
      socket.emit("game:error", "Failed to start game");
    }
  });

  // Player draws a card
  socket.on("game:draw", (source: DrawSource) => {
    handlePlayerAction(
      io,
      socket,
      userId,
      (state) => {
        const playerId = findPlayerIdByUserId(state, userId);
        if (!playerId)
          return {
            success: false,
            error: "Not in this game",
            state,
            actions: [],
          };
        return GameEngine.processDrawCard(state, playerId, source);
      },
      false,
      (resultState) => {
        recordPlayerAction(resultState.id, userId, {
          draws: 1,
          handCountHistory:
            resultState.players.find((p) => p.userId === userId)?.handCount ??
            0,
        });
      },
    );
  });

  // Player discards card(s)
  socket.on("game:discard", (cardIds: string[]) => {
    const previousState = getActiveGame(socket.data.roomCode);
    const previousTop =
      previousState?.discardPile[previousState.discardPile.length - 1];
    const isCut = Boolean(
      previousTop &&
      cardIds.length > 0 &&
      !previousState?.hasDrawnThisTurn &&
      cardIds.every((id) => {
        const player = previousState?.players.find((p) => p.userId === userId);
        const card = player?.hand.find((c) => c.id === id);
        return (
          card?.rank === previousTop.rank &&
          !card?.isJoker &&
          card.rank !== "7" &&
          card.rank !== "J"
        );
      }),
    );

    // Detect Jack play for analytics
    const discardingPlayer = previousState?.players.find((p) => p.userId === userId);
    const jackCount = cardIds.filter((id) => {
      const card = discardingPlayer?.hand.find((c) => c.id === id);
      return card?.rank === "J" && !card?.isJoker;
    }).length;

    handlePlayerAction(
      io,
      socket,
      userId,
      (state) => {
        const playerId = findPlayerIdByUserId(state, userId);
        if (!playerId)
          return {
            success: false,
            error: "Not in this game",
            state,
            actions: [],
          };
        return GameEngine.processDiscard(state, playerId, cardIds);
      },
      true,
      (resultState) => {
        recordPlayerAction(resultState.id, userId, {
          cuts: isCut ? 1 : 0,
          handCountHistory:
            resultState.players.find((p) => p.userId === userId)?.handCount ??
            0,
        });
        if (jackCount > 0 && previousState) {
          // Find the skipped player's hand count to determine if show was denied
          const currentPlayerIdx = previousState.players.findIndex((p) => p.userId === userId);
          const skippedIdx = (currentPlayerIdx + 1) % previousState.players.length;
          const skippedPlayer = previousState.players[skippedIdx];
          const skippedHandCount = skippedPlayer?.handCount ?? 99;
          const deniedShow = skippedHandCount <= 3;
          recordEvent({
            type: "jack_skip",
            gameId: resultState.id,
            userId,
            isBot: false,
            targetHandCount: skippedHandCount,
            deniedShow,
          });
        }
      },
    );
  });

  // Player calls SHOW
  socket.on("game:show", () => {
    const preShowState = getActiveGame(socket.data.roomCode);
    const preShowPlayer = preShowState?.players.find((p) => p.userId === userId);
    const handTotalBefore = preShowPlayer?.hand.reduce((s, c) => s + (c.isJoker ? 0 : (c.value)), 0) ?? 0;

    handlePlayerAction(
      io,
      socket,
      userId,
      (state) => {
        const playerId = findPlayerIdByUserId(state, userId);
        if (!playerId)
          return {
            success: false,
            error: "Not in this game",
            state,
            actions: [],
          };
        return GameEngine.processShow(state, playerId);
      },
      true,
      (resultState) => {
        recordPlayerAction(resultState.id, userId, {
          showAttempts: 1,
          handCountHistory:
            resultState.players.find((p) => p.userId === userId)?.handCount ??
            0,
        });
        const showSuccess = resultState.roundResult?.showPlayerWon ?? false;
        recordEvent({
          type: "show_attempt",
          gameId: resultState.id,
          userId,
          isBot: false,
          handTotal: handTotalBefore,
          success: showSuccess,
          personality: gameBotPersonality.get(resultState.id),
        });
      },
    );
  });

  // Player responds to 7 attack
  socket.on(
    "game:attack:respond",
    (data: { action: "throw" | "take"; cardIds?: string[] }) => {
      handlePlayerAction(
        io,
        socket,
        userId,
        (state) => {
          const playerId = findPlayerIdByUserId(state, userId);
          if (!playerId)
            return {
              success: false,
              error: "Not in this game",
              state,
              actions: [],
            };
          return GameEngine.processAttackResponse(
            state,
            playerId,
            data.action,
            data.cardIds,
          );
        },
        true,
        (resultState) => {
          recordPlayerAction(resultState.id, userId, {
            attackThrows: data.action === "throw" ? 1 : 0,
            attackTakes: data.action === "take" ? 1 : 0,
            handCountHistory:
              resultState.players.find((p) => p.userId === userId)?.handCount ??
              0,
          });
          if (data.action === "throw" && data.cardIds?.length) {
            recordEvent({
              type: "attack_chain",
              gameId: resultState.id,
              attackerId: userId,
              isBot: false,
              cardsThrown: data.cardIds.length,
              targetTook: false,
            });
          } else if (data.action === "take") {
            recordEvent({
              type: "attack_chain",
              gameId: resultState.id,
              attackerId: userId,
              isBot: false,
              cardsThrown: 0,
              targetTook: true,
            });
          }
        },
      );
    },
  );

  // Player clicks "Play Next Round"
  socket.on("game:round_ready", () => {
    // Fallback: recover roomCode if socket.data lost it (e.g. reconnection race)
    if (!socket.data.roomCode) {
      const found = getActiveGameByUserId(userId);
      if (found) socket.data.roomCode = found.roomCode;
    }
    const gameState = getActiveGame(socket.data.roomCode);
    if (
      !gameState ||
      gameState.status !== "show_called" ||
      !gameState.roundResult
    )
      return;

    // Don't handle if this is actually a match-end round
    if (ScoreEngine.checkMatchOver(gameState)) return;

    const readySet = roundReadyPlayers.get(gameState.id) ?? new Set<string>();
    readySet.add(userId);
    roundReadyPlayers.set(gameState.id, readySet);

    const humanPlayers = gameState.players.filter(
      (p) => !p.isBot && !p.isEliminated,
    );
    emitRoundReadyUpdate(io, gameState, readySet, humanPlayers.length);

    // Only require connected humans — disconnected players must not block progression
    const connectedHumans = humanPlayers.filter((p) => p.isConnected !== false);
    if (connectedHumans.length === 0 || connectedHumans.every((p) => readySet.has(p.userId))) {
      startNextRound(io, gameState);
    }
  });
}

// ── Core action handler ───────────────────────────────────────────────────────

type ActionFn = (
  state: GameState,
) => ReturnType<typeof GameEngine.processDrawCard>;

type AfterActionCallback = (state: GameState) => void;

function handlePlayerAction(
  io: Server,
  socket: Socket,
  userId: string,
  actionFn: ActionFn,
  resetTimer = false,
  afterSuccess?: AfterActionCallback,
) {
  const gameState = getActiveGame(socket.data.roomCode);
  if (!gameState) {
    // socket.data.roomCode is not set yet (reconnect race) — silently drop, not a real error
    if (socket.data.roomCode) socket.emit("game:error", "No active game");
    return;
  }

  const result = actionFn(gameState);

  if (!result.success) {
    socket.emit("game:error", result.error);
    return;
  }

  // Reset consecutive timeout count for the acting player
  const actingPlayerId = findPlayerIdByUserId(result.state, userId);
  const stateAfterReset = actingPlayerId
    ? GameEngine.resetTimeouts(result.state, actingPlayerId)
    : result.state;

  activeGames.set(stateAfterReset.id, stateAfterReset);
  (result as any).state = stateAfterReset;

  if (afterSuccess) afterSuccess(stateAfterReset);

  // Broadcast action to all players in room
  for (const action of result.actions) {
    io.to(socket.data.roomCode).emit("game:action", action);
  }

  // Handle special states
  if (result.state.status === "show_called") {
    cancelTurnTimer(result.state.id);
    handleRoundEnd(io, result.state);
    return;
  }

  if (result.state.status === "match_end") {
    cancelTurnTimer(result.state.id);
    handleMatchEnd(io, result.state);
    return;
  }

  broadcastGameState(io, result.state);

  if (resetTimer) {
    cancelTurnTimer(result.state.id);
    startTurnTimer(io, result.state.id);
  }

  // Schedule bot turn if next player is a bot
  scheduleBotTurnIfNeeded(io, result.state);
}

// ── Round End ─────────────────────────────────────────────────────────────────

function handleRoundEnd(io: Server, state: GameState) {
  if (!state.roundResult) return;
  broadcastGameState(io, state);

  // Analytics: record round outcome
  const winnerPlayer = state.players.find((p) => p.id === state.roundResult!.winnerId);
  const loserResult = state.roundResult.playerResults.reduce((worst, pr) =>
    pr.roundPoints > worst.roundPoints ? pr : worst, state.roundResult.playerResults[0]);
  recordEvent({
    type: "round_end",
    gameId: state.id,
    winnerIsBot: winnerPlayer?.isBot ?? false,
    durationMs: Date.now() - new Date(state.turnStartTime ?? Date.now()).getTime(),
    roundNumber: state.roundNumber,
    botPersonality: gameBotPersonality.get(state.id),
    loserTotal: loserResult?.roundPoints ?? 0,
  });

  // Analytics: detect farming patterns in human players
  const behaviors = gameBehavior.get(state.id);
  if (behaviors) {
    for (const [uid, tracker] of behaviors.entries()) {
      const player = state.players.find((p) => p.userId === uid && !p.isBot);
      if (!player) continue;
      const farmingScore = (tracker.cuts > 5 ? 2 : 0) + (tracker.draws > 10 && tracker.showAttempts === 0 ? 3 : 0);
      if (farmingScore >= 3) {
        recordEvent({
          type: "farming_signal",
          gameId: state.id,
          userId: uid,
          indicator: farmingScore,
          details: `cuts=${tracker.cuts} draws=${tracker.draws} shows=${tracker.showAttempts}`,
        });
      }
    }
  }

  // Persist round results
  Game.findOneAndUpdate(
    { roomId: state.roomId, status: "playing" },
    {
      $push: {
        rounds: {
          roundNumber: state.roundNumber,
          jokerRank: state.jokerRank,
          showPlayerId: state.roundResult.showPlayerId,
          showPlayerWon: state.roundResult.showPlayerWon,
          winnerId: state.roundResult.winnerId,
          playerResults: state.roundResult.playerResults,
          endedAt: new Date(),
        },
      },
    },
  ).catch(console.error);

  const matchResult = ScoreEngine.checkMatchOver(state);
  if (matchResult) {
    // 15 seconds: ShowDeclaredOverlay runs 3s, then ScoreBoard visible for ~12s before winner screen
    setTimeout(() => handleMatchEnd(io, state), 15000);
    return;
  }

  // Auto-ready all bots; wait for human players to click "Play Next Round"
  const readySet = new Set<string>();
  for (const p of state.players.filter((p) => p.isBot && !p.isEliminated)) {
    readySet.add(p.userId);
  }
  roundReadyPlayers.set(state.id, readySet);

  const humanPlayers = state.players.filter((p) => !p.isBot && !p.isEliminated);
  emitRoundReadyUpdate(io, state, readySet, humanPlayers.length);

  // Only connected humans need to click — disconnected players must not block progression
  const connectedHumans = humanPlayers.filter((p) => p.isConnected !== false);
  if (humanPlayers.length === 0 || connectedHumans.length === 0) {
    startNextRound(io, state);
    return;
  }

  // Auto-advance after 20 s — handles lost events, slow taps, or disconnected players
  const gameId = state.id;
  const timer = setTimeout(() => {
    roundAutoAdvanceTimers.delete(gameId);
    const currentState = activeGames.get(gameId);
    if (currentState && currentState.status === "show_called" && roundReadyPlayers.has(gameId)) {
      console.log(`[Game] Auto-advancing round for game ${gameId} after timeout`);
      startNextRound(io, currentState);
    }
  }, 20_000);
  roundAutoAdvanceTimers.set(gameId, timer);
}

function emitRoundReadyUpdate(
  io: Server,
  state: GameState,
  readySet: Set<string>,
  totalHumans: number,
) {
  io.to(state.roomId).emit("game:round_ready_update", {
    readyUserIds: [...readySet],
    total: totalHumans,
  });
}

function startNextRound(io: Server, state: GameState) {
  // Cancel auto-advance timer if the round starts normally (all players clicked)
  const t = roundAutoAdvanceTimers.get(state.id);
  if (t) { clearTimeout(t); roundAutoAdvanceTimers.delete(state.id); }

  roundReadyPlayers.delete(state.id);
  const freshState = GameEngine.startNewRound(state, state.roundResult!);
  activeGames.set(freshState.id, freshState);
  roomToGame.set(freshState.roomId, freshState.id);
  broadcastGameState(io, freshState);
  startTurnTimer(io, freshState.id);
  scheduleBotTurnIfNeeded(io, freshState);
}

// Idempotency guard: prevents double prize payout when handleMatchEnd is
// triggered concurrently by a direct action and the turn-timer fallback.
const handledMatchEnds = new Set<string>();

async function handleMatchEnd(io: Server, state: GameState) {
  if (handledMatchEnds.has(state.id)) {
    console.warn(`[Match] handleMatchEnd called twice for game ${state.id} — skipping duplicate`);
    return;
  }
  handledMatchEnds.add(state.id);
  // Keep the guard alive for 60 s to block any delayed re-entry, then clean up.
  setTimeout(() => handledMatchEnds.delete(state.id), 60_000);

  const matchResult = ScoreEngine.checkMatchOver(state) ?? {
    winnerId: state.players[0].id,
    winnerUsername: state.players[0].username,
    finalScores: state.players.map((p) => ({
      playerId: p.id,
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      isBot: p.isBot,
      totalScore: p.totalScore,
    })),
  };

  // Atomically read-and-clear paidPlayerIds before emitting match_end.
  // This prevents the race where both players disconnect immediately after receiving
  // game:match_end, causing handleLeave to delete the room before distributePrize
  // can read paidPlayerIds — which resulted in the winner never being credited.
  // { new: false } returns the pre-update document so we capture the original paid list.
  const roomForPrize = await Room.findOneAndUpdate(
    { code: state.roomId },
    { $set: { paidPlayerIds: [] } },
    { new: false },
  ).lean().catch(() => null);
  const entryFeeForResult: number = roomForPrize
    ? ((roomForPrize.config as any).entryFee ?? 0)
    : 0;
  const capturedPaidIds: string[] = (roomForPrize as any)?.paidPlayerIds ?? [];
  const prizePoolForResult = entryFeeForResult * capturedPaidIds.length;
  const winnerCountForResult = (matchResult.winnerIds ?? [matchResult.winnerId]).length;
  const matchResultWithPrize = {
    ...matchResult,
    ...(prizePoolForResult > 0
      ? {
          prizePool: prizePoolForResult,
          prizePerWinner: Math.floor(
            prizePoolForResult / Math.max(1, winnerCountForResult),
          ),
        }
      : {}),
  };

  io.to(state.roomId).emit("game:match_end", matchResultWithPrize);

  // Persist final result with player scores.
  // Use roundResult.playerResults when available — state.players[].totalScore
  // hasn't been updated yet for the last round at the time handleMatchEnd is called.
  const playerScoreUpdates: Record<string, number> = {};
  if (state.roundResult) {
    for (const pr of state.roundResult.playerResults) {
      const player = state.players.find((p) => p.id === pr.playerId);
      if (player) playerScoreUpdates[player.userId] = pr.totalScore;
    }
  } else {
    for (const p of state.players) {
      playerScoreUpdates[p.userId] = p.totalScore;
    }
  }

  // Resolve in-game UUID → userId for the winner
  const winnerPlayer = state.players.find((p) => p.id === matchResult.winnerId);
  const winnerUserId = winnerPlayer?.userId ?? matchResult.winnerId;

  Game.findOne({ roomId: state.roomId, status: "playing" })
    .then((game) => {
      if (!game) return;
      game.status = "finished";
      game.winnerId = winnerUserId;
      game.winnerUsername = matchResult.winnerUsername;
      game.endedAt = new Date();
      for (const player of game.players) {
        if (playerScoreUpdates[player.userId] !== undefined) {
          player.totalScore = playerScoreUpdates[player.userId];
        }
      }
      return game.save();
    })
    .catch(console.error);

  // Cancel any grace-period abandon timer — game finished normally before timeout.
  cancelPendingAbandon(state.roomId);

  // Await the status update FIRST so any concurrent handleLeave sees 'finished'
  // and does NOT trigger the abandon-refund path (race-condition fix).
  await Room.findOneAndUpdate(
    { code: state.roomId },
    { status: "finished", matchState: "completed" },
  ).catch(console.error);

  // Cash game prize distribution — await so prize is settled before cleanup runs
  await distributePrize(io, state, matchResult, entryFeeForResult, capturedPaidIds).catch(
    console.error,
  );

  // Update user stats for all human players
  const humanPlayers = state.players.filter((p) => !p.isBot);
  const roundsInMatch = state.roundNumber;
  const hasBots = state.players.some((p) => p.isBot);

  // Derive AI mode for point rewards
  const botCount = state.players.filter((p) => p.isBot).length;
  const botPersonality = gameBotPersonality.get(state.id) ?? 'smart';
  const AI_MODE_POINTS: Record<string, { id: string; label: string; points: number }> = {
    boss_rush:      { id: 'boss_rush',      label: 'Boss Rush',      points: 250 },
    casual_duel:    { id: 'casual_duel',    label: 'Casual Duel',    points: 50  },
    survival_clash: { id: 'survival_clash', label: 'Survival Clash', points: 100 },
    chaos_arena:    { id: 'chaos_arena',    label: 'Chaos Arena',    points: 150 },
  };
  const aiModeKey = hasBots
    ? botPersonality === 'boss' ? 'boss_rush'
    : botCount === 3 ? 'chaos_arena'
    : botCount === 2 ? 'survival_clash'
    : 'casual_duel'
    : null;
  const aiModeInfo = aiModeKey ? AI_MODE_POINTS[aiModeKey] : null;

  for (const p of humanPlayers) {
    const isWinner = p.id === matchResult.winnerId;
    User.findByIdAndUpdate(p.userId, {
      $inc: {
        "stats.gamesPlayed": 1,
        "stats.gamesWon": isWinner ? 1 : 0,
        "stats.roundsPlayed": roundsInMatch,
        ...(hasBots && isWinner && aiModeInfo ? { aiPoints: aiModeInfo.points } : {}),
      },
    }).catch(console.error);

    // Award AI points and notify winner
    if (hasBots && isWinner && aiModeInfo) {
      User.findById(p.userId).select('aiPoints').lean().then((u: any) => {
        const newTotal = (u?.aiPoints ?? 0) + aiModeInfo.points;
        const winnerSocketId = getOnlineUserIds().get(p.userId);
        if (winnerSocketId) {
          io.to(winnerSocketId).emit('ai:points_earned', {
            points: aiModeInfo.points,
            total: newTotal,
            modeId: aiModeInfo.id,
            modeLabel: aiModeInfo.label,
          });
        }
      }).catch(console.error);
    }

    // Award XP (non-blocking)
    const baseXp = isWinner
      ? hasBots
        ? XP_REWARDS.WIN_VS_BOT
        : XP_REWARDS.WIN_GAME
      : XP_REWARDS.LOSE_GAME;
    awardXp(io, {
      userId: p.userId,
      baseXp,
      isBot: hasBots,
      won: isWinner,
    }).then((prog: any) => {
      // Notify on win-streak milestones (non-blocking)
      if (isWinner && prog?.winStreak) notifyWinStreak(p.userId, prog.winStreak);
    }).catch(console.error);
  }

  // Capture and clear timeout counts before cleanup
  const timeoutCounts = gameTimeoutCounts.get(state.id) ?? {};
  gameTimeoutCounts.delete(state.id);

  activeGames.delete(state.id);
  roomToGame.delete(state.roomId);
  roundReadyPlayers.delete(state.id);
  const rat2 = roundAutoAdvanceTimers.get(state.id);
  if (rat2) { clearTimeout(rat2); roundAutoAdvanceTimers.delete(state.id); }
  gameDifficultyBoost.delete(state.id);
  cancelTurnTimer(state.id);

  // Notify lobby so the finished room disappears from the public list
  io.emit("lobby:rooms_updated");

  // Notify spectators the game is over
  io.to(`spectate:${state.roomId}`).emit("spectate:game_ended", {
    message: "The match has ended",
    winner: matchResult.winnerUsername,
  });

  gameBotPersonality.delete(state.id);
  gameBotPersonalitiesMap.delete(state.id);

  // v3: Finalize cross-match memory so rivalry/conditioning persists across matches
  if (hasBots) {
    const endPersonality = (botPersonality ?? "smart") as BotPersonality;
    for (const p of humanPlayers) {
      const playerWon =
        p.id === matchResult.winnerId ||
        ((matchResult as any).winnerIds ?? []).includes(p.id);
      BotPlayer.finalizeMatchMemory(p.userId, playerWon, null, "balanced", endPersonality);
    }
  }

  state.players.filter(p => p.isBot).forEach(b => BotPlayer.cleanupBotContext(b.id));

  // Tournament hooks — run async, non-blocking
  handleSurvivalMatchEnd(io, state, matchResult).catch(console.error);

}


// ── Prize Distribution ────────────────────────────────────────────────────────

async function distributePrize(
  io: Server,
  state: GameState,
  matchResult: any,
  entryFee: number,
  paidIds: string[],
) {
  try {
    // entryFee and paidIds were atomically captured (and cleared in DB) in handleMatchEnd,
    // so this function is immune to the room-deletion race in handleLeave.
    if (entryFee <= 0) return;
    const pot = entryFee * paidIds.length;
    if (pot <= 0) return;

    // Collect all winner IDs (supports ties). Filter to human paid players only —
    // bots never receive prize money regardless of whether they won or tied.
    const winnerIds: string[] = matchResult.winnerIds ?? (matchResult.winnerId ? [matchResult.winnerId] : []);
    let winnerPlayerIds = state.players
      .filter((p) => winnerIds.includes(p.id) && !p.isBot && paidIds.includes(p.userId))
      .map((p) => p.userId);

    // Bot won the match: fall back to the best-performing human paid player(s).
    // Without this the pot is lost forever — nobody credited, nobody refunded.
    if (winnerPlayerIds.length === 0) {
      const humanPaid = state.players.filter((p) => !p.isBot && paidIds.includes(p.userId));
      if (humanPaid.length === 0) {
        console.error(
          `[Prize] CRITICAL: no paid human players found. room=${state.roomId} paidIds=${JSON.stringify(paidIds)} ` +
          `players=${JSON.stringify(state.players.map(p => ({ id: p.id, userId: p.userId, isBot: p.isBot })))}`
        );
        return;
      }
      const scores: Array<{ playerId: string; totalScore: number }> =
        matchResult.finalScores ?? state.players.map((p: any) => ({ playerId: p.id, totalScore: p.totalScore }));
      const humanScored = humanPaid.map((p) => ({
        userId: p.userId,
        score: scores.find((s) => s.playerId === p.id)?.totalScore ?? p.totalScore,
      }));
      const minScore = Math.min(...humanScored.map((h) => h.score));
      winnerPlayerIds = humanScored.filter((h) => h.score === minScore).map((h) => h.userId);
      if (winnerPlayerIds.length === 0) return;
      console.warn(`[Prize] Bot won room ${state.roomId} — awarding pot ₹${pot} to best human(s): ${JSON.stringify(winnerPlayerIds)}`);
    }

    // Distribute evenly; give any remainder (from floor division) to the first winner
    const share = Math.floor(pot / winnerPlayerIds.length);
    const remainder = pot - share * winnerPlayerIds.length;

    for (let i = 0; i < winnerPlayerIds.length; i++) {
      const uid = winnerPlayerIds[i];
      const payout = i === 0 ? share + remainder : share;

      // Capture balance BEFORE update for audit trail
      const userBefore = await User.findById(uid).select("walletBalance").lean() as any;
      const balanceBefore: number = userBefore?.walletBalance ?? 0;

      const updated = await User.findByIdAndUpdate(
        uid,
        { $inc: { walletBalance: payout } },
        { new: true },
      );

      // Guard: if user was not found the wallet was NOT updated — mark as failed
      // and do NOT notify the client with a fake balance.
      if (!updated) {
        console.error(
          `[Prize] CRITICAL: User ${uid} not found — ₹${payout} NOT credited. room=${state.roomId}. ` +
          `Storing failed transaction for admin review.`
        );
        await Transaction.create({
          userId: uid,
          type: "match_settlement",
          amount: payout,
          status: "failed",
          description: `FAILED: Match settlement ₹${payout} for room ${state.roomId} — user not found`,
          balanceBefore: 0,
          balanceAfter: 0,
          heldBefore: 0,
          heldAfter: 0,
          metadata: { roomCode: state.roomId, failReason: "user_not_found" },
        }).catch(console.error);
        continue;
      }

      await Transaction.create({
        userId: uid,
        type: "match_settlement",
        amount: payout,
        status: "completed",
        description: `Match settlement — room ${state.roomId}${winnerPlayerIds.length > 1 ? " (split)" : ""}`,
        balanceBefore,
        balanceAfter: updated.walletBalance,
        heldBefore: 0,
        heldAfter: 0,
        metadata: { roomCode: state.roomId, matchState: 'completed' },
      });

      console.log(
        `[Prize] ₹${payout} awarded to ${uid} for room ${state.roomId}. ` +
        `Balance: ₹${balanceBefore} → ₹${updated.walletBalance}`
      );

      // Notify winner via their personal socket room (joined on auth)
      io.to(`user:${uid}`).emit("wallet:prize_won", {
        amount: payout,
        balance: updated.walletBalance,
      });
    }
  } catch (err) {
    console.error("[Prize] Distribution error:", err);
  }
}

// ── Turn Timer ────────────────────────────────────────────────────────────────

function startTurnTimer(io: Server, gameId: string) {
  const state = activeGames.get(gameId);
  if (!state) return;

  const timer = setTimeout(() => {
    const current = activeGames.get(gameId);
    if (!current) return;

    // Track tournament timeout strikes for human players
    const timedOutPlayer = current.players[current.currentPlayerIndex];
    if (timedOutPlayer && !timedOutPlayer.isBot) {
      const counts = gameTimeoutCounts.get(gameId) ?? {};
      counts[timedOutPlayer.userId] = (counts[timedOutPlayer.userId] ?? 0) + 1;
      gameTimeoutCounts.set(gameId, counts);
    }

    const result = GameEngine.processTimeout(current);
    activeGames.set(gameId, result.state);

    for (const a of result.actions)
      io.to(result.state.roomId).emit("game:action", a);

    if (result.state.status === "show_called") {
      handleRoundEnd(io, result.state);
      return;
    }

    if (result.state.status === "match_end") {
      handleMatchEnd(io, result.state);
      return;
    }

    broadcastGameState(io, result.state);
    startTurnTimer(io, gameId);
    scheduleBotTurnIfNeeded(io, result.state);
  }, state.turnTimeLimit * 1000);

  turnTimers.set(gameId, timer);
}

function cancelTurnTimer(gameId: string) {
  const t = turnTimers.get(gameId);
  if (t) {
    clearTimeout(t);
    turnTimers.delete(gameId);
  }
}

// ── Bot turns ─────────────────────────────────────────────────────────────────

function scheduleBotTurnIfNeeded(io: Server, state: GameState) {
  const current = state.players[state.currentPlayerIndex];
  if (!current?.isBot) return;

  const personality = getBotPersonality(state, current.id);
  const delay = BotPlayer.getThinkDelay(
    personality,
    gameDifficultyBoost.get(state.id) ?? 0,
    current.id,
  );

  setTimeout(() => {
    const freshState = activeGames.get(state.id);
    if (!freshState || freshState.status !== "playing") return;
    if (freshState.players[freshState.currentPlayerIndex]?.id !== current.id)
      return;

    executeBotTurn(io, freshState, current.id);
  }, delay);
}

function botFallbackAction(io: Server, state: GameState, botPlayerId: string) {
  const personality = getBotPersonality(state, botPlayerId);
  const boost = gameDifficultyBoost.get(state.id) ?? 0;
  const opponents = buildOpponentProfiles(state);

  // Safe fallback when any primary bot action fails: draw from deck, then discard worst card
  if (!state.hasDrawnThisTurn) {
    const drawResult = GameEngine.processDrawCard(state, botPlayerId, "deck");
    if (drawResult.success) {
      activeGames.set(drawResult.state.id, drawResult.state);
      for (const a of drawResult.actions)
        io.to(state.roomId).emit("game:action", a);
      broadcastGameState(io, drawResult.state);
      setTimeout(() => {
        const s2 = activeGames.get(state.id);
        if (!s2) return;
        const discardIds = BotPlayer.decideDiscard(
          s2, botPlayerId, personality, boost, buildOpponentProfiles(s2),
        );
        const discardResult = GameEngine.processDiscard(s2, botPlayerId, discardIds);
        if (discardResult.success) applyBotResult(io, discardResult);
        else {
          // Last resort: discard the first card in hand
          const bot2 = s2.players.find((p) => p.id === botPlayerId);
          if (bot2?.hand[0]) {
            const lastResort = GameEngine.processDiscard(s2, botPlayerId, [bot2.hand[0].id]);
            if (lastResort.success) applyBotResult(io, lastResort);
          }
        }
      }, 600);
    }
  } else {
    // Already drew — just discard worst card
    const discardIds = BotPlayer.decideDiscard(
      state, botPlayerId, personality, boost, opponents,
    );
    const discardResult = GameEngine.processDiscard(state, botPlayerId, discardIds);
    if (discardResult.success) {
      applyBotResult(io, discardResult);
    } else {
      const bot = state.players.find((p) => p.id === botPlayerId);
      if (bot?.hand[0]) {
        const lastResort = GameEngine.processDiscard(state, botPlayerId, [bot.hand[0].id]);
        if (lastResort.success) applyBotResult(io, lastResort);
      }
    }
  }
}

function executeBotTurn(io: Server, state: GameState, botPlayerId: string) {
  const personality = getBotPersonality(state, botPlayerId);
  const boost = gameDifficultyBoost.get(state.id) ?? 0;
  const opponents = buildOpponentProfiles(state);

  // ── Team Arena coordination layer — only activates when state.teamGroups present ──
  // Solo AI Tournament is 100% unaffected: teamArenaAugment() returns null when
  // isTeamArenaGame() is false, preserving all existing Solo behavior exactly.
  const botUsername = state.players.find(p => p.id === botPlayerId)?.username;
  const teamAug = teamArenaAugment(state, botPlayerId, personality, boost, opponents, botUsername);
  const effPersonality = teamAug?.effectivePersonality ?? personality;
  const effBoost       = teamAug?.effectiveBoost       ?? boost;
  const effOpponents   = teamAug?.augmentedOpponents   ?? opponents;

  const decision = teamAug?.forceDecision
    ?? BotPlayer.decide(state, botPlayerId, effPersonality, effBoost, effOpponents);
  let result: ReturnType<typeof GameEngine.processDrawCard> | null = null;

  switch (decision.action) {
    case "draw":
      result = GameEngine.processDrawCard(
        state, botPlayerId, decision.source ?? "deck",
      );
      // Fallback to deck if discard-pile draw fails
      if (!result.success && decision.source === "discard") {
        result = GameEngine.processDrawCard(state, botPlayerId, "deck");
      }
      break;
    case "discard":
      if (!state.hasDrawnThisTurn) {
        // Try as a cut first (discard without drawing — valid when cards match top of discard)
        if (decision.cardIds?.length) {
          const cutAttempt = GameEngine.processDiscard(state, botPlayerId, decision.cardIds);
          if (cutAttempt.success) {
            result = cutAttempt;
            break;
          }
        }
        // Not a valid cut — draw first, then discard
        const drawResult = GameEngine.processDrawCard(
          state, botPlayerId,
          BotPlayer.decideDrawSource(state, botPlayerId, effBoost, effOpponents),
        );
        if (drawResult.success) {
          activeGames.set(drawResult.state.id, drawResult.state);
          for (const a of drawResult.actions)
            io.to(state.roomId).emit("game:action", a);
          broadcastGameState(io, drawResult.state);
          setTimeout(() => {
            const s2 = activeGames.get(state.id);
            if (!s2) return;
            const discardIds = BotPlayer.decideDiscard(
              s2, botPlayerId, effPersonality, effBoost, buildOpponentProfiles(s2),
            );
            const discardResult = GameEngine.processDiscard(s2, botPlayerId, discardIds);
            if (discardResult.success) applyBotResult(io, discardResult);
            else botFallbackAction(io, s2, botPlayerId);
          }, 800);
          return;
        }
        // Draw also failed — use fallback
        botFallbackAction(io, state, botPlayerId);
        return;
      } else {
        const discardIds =
          decision.cardIds ??
          BotPlayer.decideDiscard(state, botPlayerId, effPersonality, effBoost, effOpponents);
        result = GameEngine.processDiscard(state, botPlayerId, discardIds);
      }
      break;
    case "show": {
      const botShowPlayer = state.players.find((p) => p.id === botPlayerId);
      const botHandTotal = botShowPlayer?.hand.reduce((s, c) => s + (c.isJoker ? 0 : (c.value)), 0) ?? 0;
      result = GameEngine.processShow(state, botPlayerId);
      if (!result.success) {
        recordEvent({ type: "show_attempt", gameId: state.id, userId: botPlayerId, isBot: true, handTotal: botHandTotal, success: false, personality });
        // Show rejected (e.g. threshold mismatch) — fall back to normal draw/discard
        botFallbackAction(io, state, botPlayerId);
        return;
      }
      recordEvent({ type: "show_attempt", gameId: state.id, userId: botPlayerId, isBot: true, handTotal: botHandTotal, success: true, personality });
      break;
    }
    case "attack_throw":
      result = GameEngine.processAttackResponse(
        state,
        botPlayerId,
        "throw",
        decision.cardIds,
      );
      if (!result.success) {
        // Countering failed — take the cards instead
        result = GameEngine.processAttackResponse(state, botPlayerId, "take");
        if (result.success) {
          recordEvent({ type: "attack_chain", gameId: state.id, attackerId: botPlayerId, isBot: true, cardsThrown: 0, targetTook: true });
        }
      } else if (decision.cardIds?.length) {
        recordEvent({ type: "attack_chain", gameId: state.id, attackerId: botPlayerId, isBot: true, cardsThrown: decision.cardIds.length, targetTook: false });
      }
      break;
    case "attack_take":
      result = GameEngine.processAttackResponse(state, botPlayerId, "take");
      if (result?.success) {
        recordEvent({ type: "attack_chain", gameId: state.id, attackerId: botPlayerId, isBot: true, cardsThrown: 0, targetTook: true });
      }
      break;
  }

  if (result?.success) {
    applyBotResult(io, result);
  } else if (result && !result.success) {
    // Primary action failed — use safe fallback
    botFallbackAction(io, state, botPlayerId);
  }
}

function applyBotResult(
  io: Server,
  result: ReturnType<typeof GameEngine.processDrawCard>,
) {
  if (!result.success) {
    console.warn(
      "[Bot] applyBotResult: action failed —",
      (result as any).error ?? "unknown",
    );
    return;
  }

  activeGames.set(result.state.id, result.state);
  for (const a of result.actions)
    io.to(result.state.roomId).emit("game:action", a);

  if (result.state.status === "show_called") {
    cancelTurnTimer(result.state.id);
    handleRoundEnd(io, result.state);
    return;
  }

  broadcastGameState(io, result.state);
  cancelTurnTimer(result.state.id);
  startTurnTimer(io, result.state.id);
  scheduleBotTurnIfNeeded(io, result.state);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a client-safe view of the game state for a specific player. */
function buildClientState(state: GameState, userId: string): ClientGameState {
  const myPlayer = state.players.find((p) => p.userId === userId);

  return {
    id: state.id,
    roomId: state.roomId,
    status: state.status,
    players: state.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      avatar: p.avatar,
      handCount: p.handCount,
      totalScore: p.totalScore,
      roundScore: p.roundScore,
      isConnected: p.isConnected,
      isEliminated: p.isEliminated,
      seatIndex: p.seatIndex,
      isBot: p.isBot,
      badge: p.isBot ? undefined : getBadge(p.userId),
    })),
    discardPile: state.discardPile,
    deckCount: state.deck.length,
    jokerRank: state.jokerRank,
    jokerCard: state.jokerCard,
    currentPlayerIndex: state.currentPlayerIndex,
    turnNumber: state.turnNumber,
    turnStartTime: state.turnStartTime,
    turnTimeLimit: state.turnTimeLimit,
    attackChain: state.attackChain,
    roundCount: state.roundCount,
    roundNumber: state.roundNumber,
    hasDrawnThisTurn: state.hasDrawnThisTurn,
    showPlayerId: state.showPlayerId,
    roundResult: state.roundResult,
    chatMessages: state.chatMessages,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? "",
  };
}

/** Broadcast personalised game state to every human socket in the room.
 *  Uses io.sockets.sockets (sync Map) instead of fetchSockets() (async) so
 *  all players receive their update in the same event-loop tick — no staggered delay.
 */
function broadcastGameState(io: Server, state: GameState) {
  for (const [, s] of io.sockets.sockets) {
    if (s.data.roomCode !== state.roomId) continue;
    if ((s as any).isSpectator) continue;
    const uid = (s as any).userId as string;
    const clientState = buildClientState(state, uid);
    s.emit("game:state", clientState);
  }

  // Re-emit ready state whenever game state is pushed during round-end phase
  if (state.status === "show_called") {
    const readySet = roundReadyPlayers.get(state.id);
    if (readySet) {
      const humanPlayers = state.players.filter(
        (p) => !p.isBot && !p.isEliminated,
      );
      emitRoundReadyUpdate(io, state, readySet, humanPlayers.length);
    }
  }

  // Broadcast sanitised state to spectators
  broadcastToSpectators(io, state);
}

function findPlayerIdByUserId(
  state: GameState,
  userId: string,
): string | undefined {
  return state.players.find((p) => p.userId === userId)?.id;
}
