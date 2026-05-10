// ============================================================
// 7 Cards Show — Shared Types
// Used by both server and client
// ============================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type DrawSource = 'deck' | 'discard';
export type GameStatus = 'waiting' | 'dealing' | 'playing' | 'show_called' | 'round_end' | 'match_end';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;   // 0 for jokers, 1 for A, 10 for J/Q/K, face value otherwise
  isJoker: boolean;
}

export interface PlayerState {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  hand: Card[];        // full hand — only sent to the owning player
  handCount: number;   // visible to all players
  totalScore: number;
  roundScore: number | null;
  isConnected: boolean;
  isEliminated: boolean;
  seatIndex: number;
  isBot: boolean;
  isReady: boolean;
}

// Attack chain state when 7s are played
export interface AttackChain {
  sourcePlayerId: string;
  targetPlayerIndex: number;
  sevensCount: number;
  penaltyCards: number; // sevensCount * 2
}

export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  players: PlayerState[];
  deck: Card[];
  discardPile: Card[];
  jokerRank: Rank;
  jokerCard: Card;          // the physical card drawn to determine joker rank
  currentPlayerIndex: number;
  turnNumber: number;
  turnStartTime: string;    // ISO string
  turnTimeLimit: number;    // seconds
  attackChain: AttackChain | null;
  roundCount: number;
  roundNumber: number;
  drawnCard: Card | null;   // card just drawn this turn (before discard)
  hasDrawnThisTurn: boolean;
  showPlayerId: string | null;
  roundResult: RoundResult | null;
  chatMessages: ChatMessage[];
}

export interface RoundResult {
  winnerId: string;
  showPlayerId: string;
  showPlayerWon: boolean;
  playerResults: PlayerRoundResult[];
  nextRoundIn: number; // ms before new round starts
}

export interface PlayerRoundResult {
  playerId: string;
  username: string;
  hand: Card[];
  roundPoints: number;
  totalScore: number;
}

export interface MatchResult {
  winnerId: string;
  winnerUsername: string;
  finalScores: { playerId: string; username: string; totalScore: number }[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  avatar: string;
  message: string;
  type: 'chat' | 'system' | 'reaction';
  timestamp: string;
}

// ---- Room types ----

export interface RoomConfig {
  maxPlayers: number;        // 2–5
  roundCount: number;
  isPrivate: boolean;
  turnTimeLimit: number;     // seconds, 15–60
  allowBots: boolean;
  botCount: number;
}

export interface RoomPlayer {
  userId: string;
  username: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  isBot: boolean;
}

export interface Room {
  id: string;
  code: string;             // 6-char join code
  name: string;
  hostId: string;
  players: RoomPlayer[];
  config: RoomConfig;
  status: 'waiting' | 'playing' | 'finished';
  gameId: string | null;
  createdAt: string;
}

// ---- Client-specific filtered types ----

// Server sends this instead of full GameState — hides other players' hands
export interface ClientGameState {
  id: string;
  roomId: string;
  status: GameStatus;
  players: ClientPlayerState[];
  discardPile: Card[];
  deckCount: number;
  jokerRank: Rank;
  jokerCard: Card;
  currentPlayerIndex: number;
  turnNumber: number;
  turnStartTime: string;
  turnTimeLimit: number;
  attackChain: AttackChain | null;
  roundCount: number;
  roundNumber: number;
  hasDrawnThisTurn: boolean;
  showPlayerId: string | null;
  roundResult: RoundResult | null;
  chatMessages: ChatMessage[];
  myHand: Card[];          // only the requesting player's hand
  myPlayerId: string;
}

export interface ClientPlayerState {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  handCount: number;
  totalScore: number;
  roundScore: number | null;
  isConnected: boolean;
  isEliminated: boolean;
  seatIndex: number;
  isBot: boolean;
}

// ---- Socket event payloads ----

export interface GameAction {
  type: 'draw' | 'discard' | 'skip' | 'attack' | 'show' | 'penalty' | 'system';
  playerId: string;
  cards?: Card[];
  source?: DrawSource;
  targetPlayerIds?: string[];
  penaltyCount?: number;
  message?: string;
  timestamp?: string;
}

// ---- User / Auth ----

export interface User {
  id: string;
  googleId?: string;
  username: string;
  email?: string;
  avatar: string;
  isGuest: boolean;
  stats: UserStats;
  createdAt: string;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  totalPointsEarned: number;
  averageScore: number;
  winRate: number;
  showSuccessRate: number;
}
