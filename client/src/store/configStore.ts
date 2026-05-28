import { create } from 'zustand';
import { configApi } from '../services/api';

interface FeatureFlags {
  leaderboardEnabled: boolean;
  spectatorModeEnabled: boolean;
  publicRoomsEnabled: boolean;
  survivalEnabled: boolean;
  teamArenaEnabled: boolean;
  eventsEnabled: boolean;
  [key: string]: boolean | any;
}

interface ConfigStore {
  flags: FeatureFlags;
  loaded: boolean;
  load: () => Promise<void>;
  update: (featureFlags: Partial<FeatureFlags>) => void;
}

const DEFAULTS: FeatureFlags = {
  leaderboardEnabled: true,
  spectatorModeEnabled: true,
  publicRoomsEnabled: true,
  survivalEnabled: true,
  teamArenaEnabled: true,
  eventsEnabled: true,
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  flags: DEFAULTS,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const r = await configApi.getPublic();
      set({ flags: { ...DEFAULTS, ...r.data.featureFlags }, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  update: (featureFlags) => {
    set(s => ({ flags: { ...s.flags, ...featureFlags } }));
  },
}));
