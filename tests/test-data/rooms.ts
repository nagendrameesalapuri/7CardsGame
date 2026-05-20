/**
 * Room configuration factories for tests.
 */
import { RoomConfig } from '../pages/LobbyPage';

export const FREE_ROOM_2P: RoomConfig = {
  maxPlayers: 2,
  rounds: 1,
  isPrivate: true,
  entryFee: 0,
  botCount: 1,
};

export const FREE_ROOM_4P: RoomConfig = {
  maxPlayers: 4,
  rounds: 1,
  isPrivate: true,
  entryFee: 0,
  botCount: 3,
};

export const WAGER_ROOM_STARTER: RoomConfig = {
  maxPlayers: 2,
  rounds: 1,
  isPrivate: true,
  entryFee: 10,
  botCount: 1,
};

export const WAGER_ROOM_CHAMPION: RoomConfig = {
  maxPlayers: 2,
  rounds: 1,
  isPrivate: true,
  entryFee: 20,
  botCount: 1,
};

export function freeRoomConfig(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return { ...FREE_ROOM_2P, ...overrides };
}

export function wagerRoomConfig(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return { ...WAGER_ROOM_STARTER, ...overrides };
}
