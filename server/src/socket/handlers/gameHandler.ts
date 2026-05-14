/**
 * gameHandler — Wires socket events to the GameEngine.
 *
 * State is kept in memory (Map) for low latency; persisted to MongoDB at round end.
 * The server is authoritative — clients only send intent, server validates + broadcasts.
 */

import { Server, Socket } from 'socket.io';
import { Room } from '../../models/Room';
import { Game } from '../../models/Game';
import { User } from '../../models/User';
import { Transaction } from '../../models/Transaction';
import { Tournament } from '../../models/Tournament';
import { GameEngine, GameConfig } from '../../engine/GameEngine';
import { BotPlayer } from '../../engine/BotPlayer';
import { ScoreEngine } from '../../engine/ScoreEngine';
import { GameState, ClientGameState, DrawSource, MatchResult } from '../../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';
import { broadcastToSpectators } from './spectatorHandler';

// In-memory game state store  (gameId → GameState)
const activeGames = new Map<string, GameState>();
// Room code → gameId
const roomToGame = new Map<string, string>();
// Turn timers (gameId → NodeJS.Timeout)
const turnTimers = new Map<string, NodeJS.Timeout>();
// Ready-for-next-round tracking: gameId → Set of userIds who have clicked "Play Next Round"
const roundReadyPlayers = new Map<string, Set<string>>();

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveGame(roomCode: string): GameState | undefined {
  const gid = roomToGame.get(roomCode);
  return gid ? activeGames.get(gid) : undefined;
}

export function getActiveGameByUserId(userId: string): { game: GameState; roomCode: string } | undefined {
  for (const [roomCode, gameId] of roomToGame.entries()) {
    const game = activeGames.get(gameId);
    if (game && game.players.some(p => p.userId === userId && !p.isEliminated)) {
      return { game, roomCode };
    }
  }
  return undefined;
}

export function getAllActiveRoomInfos() {
  const result: {
    roomCode: string; name: string; status: string;
    playerCount: number; maxPlayers: number;
    roundNumber: number; roundCount: number;
    players: { username: string; userId: string; isBot: boolean }[];
  }[] = [];
  for (const [roomCode, gameId] of roomToGame.entries()) {
    const game = activeGames.get(gameId);
    if (!game) continue;
    result.push({
      roomCode,
      name: roomCode,
      status: game.status,
      playerCount: game.players.filter(p => !p.isEliminated).length,
      maxPlayers: game.players.length,
      roundNumber: game.roundNumber,
      roundCount: game.roundCount,
      players: game.players.map(p => ({ username: p.username, userId: p.userId, isBot: p.isBot })),
    });
  }
  return result;
}

export function forceEndGame(io: Server, roomCode: string): boolean {
  const gameId = roomToGame.get(roomCode);
  if (!gameId) return false;
  const state = activeGames.get(gameId);
  if (!state) return false;

  io.to(roomCode).emit('game:force_ended', { message: 'Game was ended by an admin' });

  activeGames.delete(gameId);
  roomToGame.delete(roomCode);
  roundReadyPlayers.delete(gameId);
  cancelTurnTimer(gameId);

  Room.findOneAndUpdate({ code: roomCode }, { status: 'finished' }).catch(console.error);
  return true;
}

// ── Shared game initializer (used by room:start and tournament handler) ─────────

export async function startRoomGame(io: Server, roomCode: string): Promise<void> {
  const room = await Room.findOne({ code: roomCode });
  if (!room) return;

  const botPlayers = Array.from({ length: room.config.botCount }, (_, i) => ({
    userId: `bot_${uuidv4().slice(0, 6)}`,
    username: `Bot ${i + 1}`,
    avatar: `bot_${i + 1}`,
    isBot: true,
  }));

  const allPlayers = [
    ...room.players.map(p => ({ userId: p.userId, username: p.username, avatar: p.avatar, isBot: p.isBot })),
    ...botPlayers,
  ].map(p => ({ ...p, id: uuidv4() }));

  const config: GameConfig = {
    roomId: room.code,
    players: allPlayers,
    roundCount: room.config.roundCount,
    turnTimeLimit: room.config.turnTimeLimit,
  };

  const gameState = GameEngine.initializeGame(config);
  activeGames.set(gameState.id, gameState);
  roomToGame.set(room.code, gameState.id);

  room.status = 'playing';
  room.gameId = gameState.id;
  await room.save();

  await Game.create({
    roomId: room.code,
    players: allPlayers.map(p => ({ userId: p.userId, username: p.username, avatar: p.avatar, totalScore: 0, isBot: p.isBot })),
    roundCount: config.roundCount,
    status: 'playing',
  });

  broadcastGameState(io, gameState);
  startTurnTimer(io, gameState.id);
  scheduleBotTurnIfNeeded(io, gameState);
}

export function kickPlayerFromGame(io: Server, roomCode: string, userId: string): boolean {
  const game = getActiveGame(roomCode);
  if (!game) return false;
  const player = game.players.find(p => p.userId === userId);
  if (!player) return false;
  player.isEliminated = true;
  player.isConnected = false;
  io.to(roomCode).emit('game:action', {
    type: 'system',
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
  socket.on('room:start', async () => {
    try {
      const room = await Room.findOne({ code: socket.data.roomCode });
      if (!room) return socket.emit('room:error', 'Room not found');
      if (room.hostId !== userId) return socket.emit('game:error', 'Only the host can start');
      if (room.status !== 'waiting') return socket.emit('game:error', 'Game already started');

      const humans = room.players.filter(p => !p.isBot);
      if (humans.length < 2 && room.config.botCount === 0) {
        return socket.emit('game:error', 'Need at least 2 players to start');
      }

      // Double deck: 113 usable cards, 7 per player → max 10 players (70 dealt, 43 remain for draw pile)
      const totalPlayers = room.players.length + room.config.botCount;
      if (totalPlayers > 10) {
        return socket.emit('game:error', `Too many players (max 10, got ${totalPlayers}). Reduce bot count.`);
      }

      // Build player list (humans + bots)
      const botPlayers = Array.from({ length: room.config.botCount }, (_, i) => ({
        userId: `bot_${uuidv4().slice(0, 6)}`,
        username: `Bot ${i + 1}`,
        avatar: `bot_${i + 1}`,
        isBot: true,
      }));

      const allPlayers = [
        ...room.players.map(p => ({ userId: p.userId, username: p.username, avatar: p.avatar, isBot: p.isBot })),
        ...botPlayers,
      ].map(p => ({ ...p, id: uuidv4() }));

      const config: GameConfig = {
        roomId: room.code,
        players: allPlayers,
        roundCount: room.config.roundCount,
        turnTimeLimit: room.config.turnTimeLimit,
      };

      const gameState = GameEngine.initializeGame(config);
      activeGames.set(gameState.id, gameState);
      roomToGame.set(room.code, gameState.id);

      room.status = 'playing';
      room.gameId = gameState.id;
      await room.save();

      // Save initial game record
      await Game.create({
        roomId: room.code,
        players: allPlayers.map(p => ({
          userId: p.userId,
          username: p.username,
          avatar: p.avatar,
          totalScore: 0,
          isBot: p.isBot,
        })),
        roundCount: config.roundCount,
        status: 'playing',
      });

      // Broadcast personalised game state to each socket in the room
      broadcastGameState(io, gameState);

      // Start turn timer
      startTurnTimer(io, gameState.id);

      // If first player is a bot, schedule bot action
      scheduleBotTurnIfNeeded(io, gameState);

    } catch (err) {
      console.error('room:start error', err);
      socket.emit('game:error', 'Failed to start game');
    }
  });

  // Player draws a card
  socket.on('game:draw', (source: DrawSource) => {
    handlePlayerAction(io, socket, userId, state => {
      const playerId = findPlayerIdByUserId(state, userId);
      if (!playerId) return { success: false, error: 'Not in this game', state, actions: [] };
      return GameEngine.processDrawCard(state, playerId, source);
    });
  });

  // Player discards card(s)
  socket.on('game:discard', (cardIds: string[]) => {
    handlePlayerAction(io, socket, userId, state => {
      const playerId = findPlayerIdByUserId(state, userId);
      if (!playerId) return { success: false, error: 'Not in this game', state, actions: [] };
      return GameEngine.processDiscard(state, playerId, cardIds);
    }, true);
  });

  // Player calls SHOW
  socket.on('game:show', () => {
    handlePlayerAction(io, socket, userId, state => {
      const playerId = findPlayerIdByUserId(state, userId);
      if (!playerId) return { success: false, error: 'Not in this game', state, actions: [] };
      return GameEngine.processShow(state, playerId);
    }, true);
  });

  // Player responds to 7 attack
  socket.on('game:attack:respond', (data: { action: 'throw' | 'take'; cardIds?: string[] }) => {
    handlePlayerAction(io, socket, userId, state => {
      const playerId = findPlayerIdByUserId(state, userId);
      if (!playerId) return { success: false, error: 'Not in this game', state, actions: [] };
      return GameEngine.processAttackResponse(state, playerId, data.action, data.cardIds);
    }, true);
  });

  // Player clicks "Play Next Round"
  socket.on('game:round_ready', () => {
    const gameState = getActiveGame(socket.data.roomCode);
    if (!gameState || gameState.status !== 'show_called' || !gameState.roundResult) return;

    // Don't handle if this is actually a match-end round
    if (ScoreEngine.checkMatchOver(gameState)) return;

    const readySet = roundReadyPlayers.get(gameState.id) ?? new Set<string>();
    readySet.add(userId);
    roundReadyPlayers.set(gameState.id, readySet);

    const humanPlayers = gameState.players.filter(p => !p.isBot && !p.isEliminated);
    emitRoundReadyUpdate(io, gameState, readySet, humanPlayers.length);

    // Start next round when every human has clicked
    if (humanPlayers.every(p => readySet.has(p.userId))) {
      startNextRound(io, gameState);
    }
  });
}

// ── Core action handler ───────────────────────────────────────────────────────

type ActionFn = (state: GameState) => ReturnType<typeof GameEngine.processDrawCard>;

function handlePlayerAction(
  io: Server,
  socket: Socket,
  userId: string,
  actionFn: ActionFn,
  resetTimer = false,
) {
  const gameState = getActiveGame(socket.data.roomCode);
  if (!gameState) {
    // socket.data.roomCode is not set yet (reconnect race) — silently drop, not a real error
    if (socket.data.roomCode) socket.emit('game:error', 'No active game');
    return;
  }

  const result = actionFn(gameState);

  if (!result.success) {
    socket.emit('game:error', result.error);
    return;
  }

  // Reset consecutive timeout count for the acting player
  const actingPlayerId = findPlayerIdByUserId(result.state, userId);
  const stateAfterReset = actingPlayerId
    ? GameEngine.resetTimeouts(result.state, actingPlayerId)
    : result.state;

  activeGames.set(stateAfterReset.id, stateAfterReset);
  (result as any).state = stateAfterReset;

  // Broadcast action to all players in room
  for (const action of result.actions) {
    io.to(socket.data.roomCode).emit('game:action', action);
  }

  // Handle special states
  if (result.state.status === 'show_called') {
    cancelTurnTimer(result.state.id);
    handleRoundEnd(io, result.state);
    return;
  }

  if (result.state.status === 'match_end') {
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

  // Persist round results
  Game.findOneAndUpdate(
    { roomId: state.roomId, status: 'playing' },
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
    }
  ).catch(console.error);

  const matchResult = ScoreEngine.checkMatchOver(state);
  if (matchResult) {
    // 15 seconds: ShowDeclaredOverlay runs 3s, then ScoreBoard visible for ~12s before winner screen
    setTimeout(() => handleMatchEnd(io, state), 15000);
    return;
  }

  // Auto-ready all bots; wait for human players to click "Play Next Round"
  const readySet = new Set<string>();
  for (const p of state.players.filter(p => p.isBot && !p.isEliminated)) {
    readySet.add(p.userId);
  }
  roundReadyPlayers.set(state.id, readySet);

  const humanPlayers = state.players.filter(p => !p.isBot && !p.isEliminated);
  emitRoundReadyUpdate(io, state, readySet, humanPlayers.length);

  // Edge case: no human players at all — start immediately
  if (humanPlayers.length === 0) {
    startNextRound(io, state);
  }
}

function emitRoundReadyUpdate(
  io: Server,
  state: GameState,
  readySet: Set<string>,
  totalHumans: number,
) {
  io.to(state.roomId).emit('game:round_ready_update', {
    readyUserIds: [...readySet],
    total: totalHumans,
  });
}

function startNextRound(io: Server, state: GameState) {
  roundReadyPlayers.delete(state.id);
  const freshState = GameEngine.startNewRound(state, state.roundResult!);
  activeGames.set(freshState.id, freshState);
  roomToGame.set(freshState.roomId, freshState.id);
  broadcastGameState(io, freshState);
  startTurnTimer(io, freshState.id);
  scheduleBotTurnIfNeeded(io, freshState);
}

async function handleMatchEnd(io: Server, state: GameState) {
  const matchResult = ScoreEngine.checkMatchOver(state) ?? {
    winnerId: state.players[0].id,
    winnerUsername: state.players[0].username,
    finalScores: state.players.map(p => ({ playerId: p.id, username: p.username, totalScore: p.totalScore })),
  };

  // Attach prize info to match result if this is a cash game
  const roomForPrize = await Room.findOne({ code: state.roomId }).lean().catch(() => null);
  const entryFeeForResult: number = roomForPrize ? ((roomForPrize.config as any).entryFee ?? 0) : 0;
  const paidCountForResult: number = roomForPrize ? ((roomForPrize as any).paidPlayerIds?.length ?? 0) : 0;
  const prizePoolForResult = entryFeeForResult * paidCountForResult;
  const winnerCountForResult = (matchResult.winnerIds ?? [matchResult.winnerId]).length;
  const matchResultWithPrize = {
    ...matchResult,
    ...(prizePoolForResult > 0 ? {
      prizePool: prizePoolForResult,
      prizePerWinner: Math.floor(prizePoolForResult / Math.max(1, winnerCountForResult)),
    } : {}),
  };

  io.to(state.roomId).emit('game:match_end', matchResultWithPrize);

  // Persist final result with player scores.
  // Use roundResult.playerResults when available — state.players[].totalScore
  // hasn't been updated yet for the last round at the time handleMatchEnd is called.
  const playerScoreUpdates: Record<string, number> = {};
  if (state.roundResult) {
    for (const pr of state.roundResult.playerResults) {
      const player = state.players.find(p => p.id === pr.playerId);
      if (player) playerScoreUpdates[player.userId] = pr.totalScore;
    }
  } else {
    for (const p of state.players) {
      playerScoreUpdates[p.userId] = p.totalScore;
    }
  }

  // Resolve in-game UUID → userId for the winner
  const winnerPlayer = state.players.find(p => p.id === matchResult.winnerId);
  const winnerUserId = winnerPlayer?.userId ?? matchResult.winnerId;

  Game.findOne({ roomId: state.roomId, status: 'playing' }).then(game => {
    if (!game) return;
    game.status = 'finished';
    game.winnerId = winnerUserId;
    game.winnerUsername = matchResult.winnerUsername;
    game.endedAt = new Date();
    for (const player of game.players) {
      if (playerScoreUpdates[player.userId] !== undefined) {
        player.totalScore = playerScoreUpdates[player.userId];
      }
    }
    return game.save();
  }).catch(console.error);

  Room.findOneAndUpdate(
    { code: state.roomId },
    { status: 'finished' }
  ).catch(console.error);

  // Cash game prize distribution
  distributePrize(io, state, matchResult, winnerPlayer ?? null).catch(console.error);

  // Update user stats for all human players
  const humanPlayers = state.players.filter(p => !p.isBot);
  const roundsInMatch = state.roundNumber;
  for (const p of humanPlayers) {
    const isWinner = p.id === matchResult.winnerId;
    User.findByIdAndUpdate(p.userId, {
      $inc: {
        'stats.gamesPlayed': 1,
        'stats.gamesWon': isWinner ? 1 : 0,
        'stats.roundsPlayed': roundsInMatch,
      },
    }).catch(console.error);
  }

  activeGames.delete(state.id);
  roomToGame.delete(state.roomId);
  roundReadyPlayers.delete(state.id);
  cancelTurnTimer(state.id);

  // Notify lobby so the finished room disappears from the public list
  io.emit('lobby:rooms_updated');

  // Notify spectators the game is over
  io.to(`spectate:${state.roomId}`).emit('spectate:game_ended', {
    message: 'The match has ended',
    winner: matchResult.winnerUsername,
  });

  // Tournament hook — runs async, non-blocking
  handleTournamentMatchEnd(io, state, matchResult).catch(console.error);
}

// ── Tournament match-end logic ────────────────────────────────────────────────

const TOURNAMENT_PRIZE: Record<number, number> = { 10: 15, 20: 25 };

async function handleTournamentMatchEnd(io: Server, state: GameState, matchResult: any) {
  const tournament = await Tournament.findOne({ currentRoomCode: state.roomId, status: 'active' });
  if (!tournament) return;

  // Use roundResult scores (last-round totals) if available; fall back to in-memory totals
  const getScore = (userId: string) => {
    if (state.roundResult) {
      const pr = state.roundResult.playerResults.find(r => {
        const p = state.players.find(pl => pl.id === r.playerId);
        return p?.userId === userId;
      });
      if (pr) return pr.totalScore;
    }
    return state.players.find(p => p.userId === userId)?.totalScore ?? 0;
  };
  const getBotScore = () => {
    const bots = state.players.filter(p => p.isBot);
    if (state.roundResult) {
      const botTotals = bots.map(b => {
        const pr = state.roundResult!.playerResults.find(r => r.playerId === b.id);
        return pr?.totalScore ?? b.totalScore;
      });
      return Math.min(...botTotals);
    }
    return Math.min(...bots.map(p => p.totalScore));
  };

  const humanScore    = getScore(tournament.userId);
  const bestBotScore  = getBotScore();
  const isDraw        = humanScore === bestBotScore;
  const playerWon     = humanScore < bestBotScore;   // strict: lower score wins, equal = draw

  tournament.gamesPlayed++;
  if (isDraw)       tournament.draws++;
  else if (playerWon) tournament.playerWins++;
  else              tournament.botWins++;

  tournament.gameResults.push({
    gameNumber:  tournament.gamesPlayed,
    playerScore: humanScore,
    botScore:    bestBotScore,
    playerWon,
    isDraw,
  });

  // Tournament ends when someone reaches 2 wins OR all 3 games are played
  const MAX_GAMES    = 3;
  const tournamentOver =
    tournament.playerWins >= 2 ||
    tournament.botWins >= 2 ||
    tournament.gamesPlayed >= MAX_GAMES;

  const payload: Record<string, any> = {
    gameNumber:  tournament.gamesPlayed,
    playerWins:  tournament.playerWins,
    botWins:     tournament.botWins,
    draws:       tournament.draws,
    isDraw,
    playerWon,
    playerScore: humanScore,
    botScore:    bestBotScore,
    tournamentOver,
  };

  if (tournamentOver) {
    tournament.completedAt    = new Date();
    tournament.currentRoomCode = null;

    const overallWon  = tournament.playerWins >= 2 ||
      (tournament.gamesPlayed >= MAX_GAMES && tournament.playerWins > tournament.botWins);
    const overallLost = tournament.botWins >= 2 ||
      (tournament.gamesPlayed >= MAX_GAMES && tournament.botWins > tournament.playerWins);
    const overallDraw = !overallWon && !overallLost;   // playerWins === botWins after 3 games

    if (overallWon) {
      tournament.status = 'won';
      const prize       = TOURNAMENT_PRIZE[tournament.entryFee] ?? 0;
      const totalReturn = tournament.entryFee + prize;
      await User.findByIdAndUpdate(tournament.userId, { $inc: { walletBalance: totalReturn } });
      await Transaction.create({
        userId: tournament.userId,
        type: 'winning',
        amount: totalReturn,
        status: 'completed',
        description: `Tournament won — ₹${prize} prize + ₹${tournament.entryFee} entry back`,
        metadata: { tournamentId: tournament.id },
      });
      payload.won         = true;
      payload.prizeAmount = prize;
      payload.totalReturn = totalReturn;
    } else if (overallDraw) {
      tournament.status = 'draw';
      // Refund entry fee on overall draw — no winner
      await User.findByIdAndUpdate(tournament.userId, { $inc: { walletBalance: tournament.entryFee } });
      await Transaction.create({
        userId: tournament.userId,
        type: 'refund',
        amount: tournament.entryFee,
        status: 'completed',
        description: `Tournament draw — entry fee ₹${tournament.entryFee} refunded`,
        metadata: { tournamentId: tournament.id },
      });
      payload.won        = false;
      payload.overallDraw = true;
      payload.totalReturn = tournament.entryFee;
    } else {
      tournament.status = 'lost';
      payload.won = false;
    }

    await tournament.save();
  } else {
    // Save updated stats first so they're never lost if room creation fails
    await tournament.save();

    // Prepare next game room (game starts only when player explicitly resumes)
    const user = await User.findById(tournament.userId).select('username avatar');
    if (!user) return;

    let nextCode: string;
    let attempts = 0;
    do {
      nextCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      attempts++;
    } while (await Room.exists({ code: nextCode }) && attempts < 10);

    await Room.create({
      code: nextCode,
      name: `Tournament — ${user.username}`.slice(0, 30),
      hostId: tournament.userId,
      players: [{ userId: tournament.userId, username: user.username, avatar: user.avatar, isReady: true, isHost: true, isBot: false }],
      config: { maxPlayers: 2, roundCount: 2, isPrivate: true, turnTimeLimit: 30, allowBots: true, botCount: 1, entryFee: 0 },
      paidPlayerIds: [],
      status: 'waiting',
    });

    tournament.currentRoomCode = nextCode;
    await tournament.save();

    payload.nextGameNumber = tournament.gamesPlayed + 1;
    payload.nextRoomCode   = nextCode;
    // NOTE: we do NOT join the socket or call startRoomGame here.
    // The game starts when the player clicks "Continue" which triggers tournament:start (resume path).
  }

  // Emit result to the player
  const playerSocket = [...io.sockets.sockets.values()].find(s => (s as any).userId === tournament.userId);
  if (playerSocket) playerSocket.emit('tournament:game_result', payload);
}

// ── Prize Distribution ────────────────────────────────────────────────────────

async function distributePrize(io: Server, state: GameState, matchResult: any, winnerPlayer: any) {
  try {
    const room = await Room.findOne({ code: state.roomId }).lean();
    if (!room) return;
    const entryFee: number = (room.config as any).entryFee ?? 0;
    if (entryFee <= 0) return;

    const paidIds: string[] = (room as any).paidPlayerIds ?? [];
    const pot = entryFee * paidIds.length;
    if (pot <= 0 || !winnerPlayer || winnerPlayer.isBot) return;

    // Handle ties — split the pot evenly
    const winnerIds: string[] = matchResult.winnerIds ?? [matchResult.winnerId];
    const winnerPlayerIds = state.players
      .filter(p => winnerIds.includes(p.id) && !p.isBot && paidIds.includes(p.userId))
      .map(p => p.userId);

    if (winnerPlayerIds.length === 0) return;
    const share = Math.floor(pot / winnerPlayerIds.length);

    for (const uid of winnerPlayerIds) {
      const updated = await User.findByIdAndUpdate(uid, { $inc: { walletBalance: share } }, { new: true });
      await Transaction.create({
        userId: uid,
        type: 'winning',
        amount: share,
        status: 'completed',
        description: `Prize won — room ${state.roomId}${winnerPlayerIds.length > 1 ? ' (split)' : ''}`,
        metadata: { roomCode: state.roomId },
      });
      // Notify winner's connected socket
      for (const [, s] of io.sockets.sockets) {
        if ((s as any).userId === uid) {
          s.emit('wallet:prize_won', { amount: share, balance: updated?.walletBalance ?? 0 });
        }
      }
    }
  } catch (err) {
    console.error('[Prize] Distribution error:', err);
  }
}

// ── Turn Timer ────────────────────────────────────────────────────────────────

function startTurnTimer(io: Server, gameId: string) {
  const state = activeGames.get(gameId);
  if (!state) return;

  const timer = setTimeout(() => {
    const current = activeGames.get(gameId);
    if (!current) return;

    const result = GameEngine.processTimeout(current);
    activeGames.set(gameId, result.state);

    for (const a of result.actions) io.to(result.state.roomId).emit('game:action', a);

    if (result.state.status === 'show_called') {
      handleRoundEnd(io, result.state);
      return;
    }

    if (result.state.status === 'match_end') {
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

  const delay = BotPlayer.getThinkDelay();

  setTimeout(() => {
    const freshState = activeGames.get(state.id);
    if (!freshState || freshState.status !== 'playing') return;
    if (freshState.players[freshState.currentPlayerIndex]?.id !== current.id) return;

    executeBotTurn(io, freshState, current.id);
  }, delay);
}

function executeBotTurn(io: Server, state: GameState, botPlayerId: string) {
  const decision = BotPlayer.decide(state, botPlayerId);
  let result: ReturnType<typeof GameEngine.processDrawCard> | null = null;

  switch (decision.action) {
    case 'draw':
      result = GameEngine.processDrawCard(state, botPlayerId, decision.source ?? 'deck');
      break;
    case 'discard':
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
        const drawResult = GameEngine.processDrawCard(state, botPlayerId, BotPlayer.decideDrawSource(state, botPlayerId));
        if (drawResult.success) {
          activeGames.set(drawResult.state.id, drawResult.state);
          for (const a of drawResult.actions) io.to(state.roomId).emit('game:action', a);
          broadcastGameState(io, drawResult.state);
          setTimeout(() => {
            const s2 = activeGames.get(state.id);
            if (!s2) return;
            const discardIds = BotPlayer.decideDiscard(s2, botPlayerId);
            const discardResult = GameEngine.processDiscard(s2, botPlayerId, discardIds);
            if (discardResult.success) applyBotResult(io, discardResult);
          }, 800);
          return;
        }
      } else {
        const discardIds = decision.cardIds ?? BotPlayer.decideDiscard(state, botPlayerId);
        result = GameEngine.processDiscard(state, botPlayerId, discardIds);
      }
      break;
    case 'show':
      result = GameEngine.processShow(state, botPlayerId);
      break;
    case 'attack_throw':
      result = GameEngine.processAttackResponse(state, botPlayerId, 'throw', decision.cardIds);
      break;
    case 'attack_take':
      result = GameEngine.processAttackResponse(state, botPlayerId, 'take');
      break;
  }

  if (result) applyBotResult(io, result);
}

function applyBotResult(io: Server, result: ReturnType<typeof GameEngine.processDrawCard>) {
  if (!result.success) return;

  activeGames.set(result.state.id, result.state);
  for (const a of result.actions) io.to(result.state.roomId).emit('game:action', a);

  if (result.state.status === 'show_called') {
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
  const myPlayer = state.players.find(p => p.userId === userId);

  return {
    id: state.id,
    roomId: state.roomId,
    status: state.status,
    players: state.players.map(p => ({
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
    myPlayerId: myPlayer?.id ?? '',
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
    s.emit('game:state', clientState);
  }

  // Re-emit ready state whenever game state is pushed during round-end phase
  if (state.status === 'show_called') {
    const readySet = roundReadyPlayers.get(state.id);
    if (readySet) {
      const humanPlayers = state.players.filter(p => !p.isBot && !p.isEliminated);
      emitRoundReadyUpdate(io, state, readySet, humanPlayers.length);
    }
  }

  // Broadcast sanitised state to spectators
  broadcastToSpectators(io, state);
}

function findPlayerIdByUserId(state: GameState, userId: string): string | undefined {
  return state.players.find(p => p.userId === userId)?.id;
}
