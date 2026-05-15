// ============================================================
// 7 Cards Show — Shared Types
// Used by both server and client
// ============================================================

export type Suit = "hearts" | "diamonds" | "clubs" | "spades" | "none";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "Joker";
export type DrawSource = "deck" | "discard";
export type GameStatus =
  | "waiting"
  | "dealing"
  | "playing"
  | "show_called"
  | "round_end"
  | "match_end";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number; // 0 for jokers, 1 for A, 10 for J/Q/K, face value otherwise
  isJoker: boolean;
}

export interface PlayerState {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  hand: Card[]; // full hand — only sent to the owning player
  handCount: number; // visible to all players
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
  jokerCard: Card; // the physical card drawn to determine joker rank
  currentPlayerIndex: number;
  turnNumber: number;
  turnStartTime: string; // ISO string
  turnTimeLimit: number; // seconds
  attackChain: AttackChain | null;
  roundCount: number;
  roundNumber: number;
  drawnCard: Card | null; // card just drawn this turn (before discard)
  hasDrawnThisTurn: boolean;
  showPlayerId: string | null;
  roundResult: RoundResult | null;
  chatMessages: ChatMessage[];
  consecutiveTimeouts: Record<string, number>; // playerId → consecutive timeout count
}

export interface RoundResult {
  winnerId: string; // primary winner (show player when they win; first tied winner otherwise)
  winnerIds: string[]; // all players who tied for lowest — each receives 0 round points
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
  winnerIds?: string[]; // all tied match winners
  winnerUsername: string; // "Player A & Player B" on tie
  finalScores: { playerId: string; username: string; totalScore: number }[];
  prizePool?: number; // total pot for cash games
  prizePerWinner?: number; // amount each winner receives
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  avatar: string;
  message: string;
  type: "chat" | "system" | "reaction";
  timestamp: string;
}

// ---- Room types ----

export interface RoomConfig {
  maxPlayers: number; // 2–5
  roundCount: number;
  isPrivate: boolean;
  turnTimeLimit: number; // seconds, 15–60
  allowBots: boolean;
  botCount: number;
  entryFee: number; // 0 = free game, >0 = cash game
}

// ---- Wallet types ----

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "winning"
  | "entry_fee"
  | "refund";

export interface WalletTransaction {
  _id: string;
  type: TransactionType;
  amount: number;
  status: "pending" | "completed" | "failed";
  description: string;
  createdAt: string;
}

export interface WalletState {
  balance: number;
  isGuest: boolean;
  transactions: WalletTransaction[];
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
  code: string; // 6-char join code
  name: string;
  hostId: string;
  players: RoomPlayer[];
  config: RoomConfig;
  status: "waiting" | "playing" | "finished";
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
  myHand: Card[]; // only the requesting player's hand
  myPlayerId: string;
}

export interface PlayerBadge {
  emoji: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
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
  badge?: PlayerBadge;
}

// ---- Socket event payloads ----

export interface GameAction {
  type: "draw" | "discard" | "skip" | "attack" | "show" | "penalty" | "system";
  playerId: string;
  cards?: Card[];
  source?: DrawSource;
  targetPlayerIds?: string[];
  penaltyCount?: number;
  message?: string;
  timestamp?: string;
}

// ---- Spectator ----

export interface SpectatorGameState {
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
  isSpectatorView: true;
}

// ---- Admin Config ----

export interface AdminFeatureFlags {
  spectatorModeEnabled: boolean;
  publicRoomsEnabled: boolean;
  tournamentBannerEnabled: boolean;
  survivalEnabled: boolean;
  survivalTiers: {
    beginner: boolean;
    pro: boolean;
    elite: boolean;
    boss_arena: boolean;
  };
}

export interface AdminGameConfig {
  minPlayers: number;
  maxPlayers: number;
  minRounds: number;
  maxRounds: number;
  maxSpectators: number;
  maxBots: number;
}

export interface AdminWalletConfig {
  depositEnabled: boolean;
  withdrawEnabled: boolean;
  upiId: string;
  upiName: string;
  qrEnabled: boolean;
  qrCodeUrl: string;
}

export interface AdminSurvivalTierConfig {
  entryPoints: number;
  stageRewards: number[];
}

export interface AdminSurvivalConfig {
  beginner:   AdminSurvivalTierConfig;
  pro:        AdminSurvivalTierConfig;
  elite:      AdminSurvivalTierConfig;
  boss_arena: AdminSurvivalTierConfig;
}

export interface PublicAdminConfig {
  featureFlags: AdminFeatureFlags;
  gameConfig: AdminGameConfig;
  walletConfig: AdminWalletConfig;
  survivalConfig: AdminSurvivalConfig;
}

// ---- User / Auth ----

export interface User {
  id: string;
  googleId?: string;
  username: string;
  email?: string;
  avatar: string;
  isGuest: boolean;
  isBanned?: boolean;
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
