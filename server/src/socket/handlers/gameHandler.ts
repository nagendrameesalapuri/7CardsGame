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
import { GameEngine, GameConfig } from '../../engine/GameEngine';
import { BotPlayer } from '../../engine/BotPlayer';
import { ScoreEngine } from '../../engine/ScoreEngine';
import { GameState, ClientGameState, DrawSource, MatchResult } from '../../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';

// In-memory game state store  (gameId → GameState)
const activeGames = new Map<string, GameState>();
// Room code → gameId
const roomToGame = new Map<string, string>();
// Turn timers (gameId → NodeJS.Timeout)
const turnTimers = new Map<string, NodeJS.Timeout>();

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
  if (!gameState) return socket.emit('game:error', 'No active game');

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
    setTimeout(() => handleMatchEnd(io, state), state.roundResult!.nextRoundIn);
    return;
  }

  // Schedule next round
  setTimeout(() => {
    const freshState = GameEngine.startNewRound(state, state.roundResult!);
    activeGames.set(freshState.id, freshState);
    roomToGame.set(freshState.roomId, freshState.id);

    broadcastGameState(io, freshState);
    startTurnTimer(io, freshState.id);
    scheduleBotTurnIfNeeded(io, freshState);
  }, state.roundResult!.nextRoundIn);
}

function handleMatchEnd(io: Server, state: GameState) {
  const matchResult = ScoreEngine.checkMatchOver(state) ?? {
    winnerId: state.players[0].id,
    winnerUsername: state.players[0].username,
    finalScores: state.players.map(p => ({ playerId: p.id, username: p.username, totalScore: p.totalScore })),
  };

  io.to(state.roomId).emit('game:match_end', matchResult);

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
  cancelTurnTimer(state.id);
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
        // Bot needs to draw first
        const drawResult = GameEngine.processDrawCard(state, botPlayerId, BotPlayer.decideDrawSource(state, botPlayerId));
        if (drawResult.success) {
          activeGames.set(drawResult.state.id, drawResult.state);
          for (const a of drawResult.actions) io.to(state.roomId).emit('game:action', a);
          broadcastGameState(io, drawResult.state);
          // Schedule discard
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

/** Broadcast personalised game state to every human socket in the room. */
async function broadcastGameState(io: Server, state: GameState) {
  const sockets = await io.in(state.roomId).fetchSockets();

  for (const s of sockets) {
    const uid = (s as any).userId as string;
    const clientState = buildClientState(state, uid);
    s.emit('game:state', clientState);
  }
}

function findPlayerIdByUserId(state: GameState, userId: string): string | undefined {
  return state.players.find(p => p.userId === userId)?.id;
}
