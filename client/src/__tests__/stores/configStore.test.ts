import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  configApi: { getPublic: vi.fn() },
}));

import { useConfigStore } from '../../store/configStore';
import { configApi } from '../../services/api';

const DEFAULTS = {
  leaderboardEnabled: true,
  spectatorModeEnabled: true,
  publicRoomsEnabled: true,
  survivalEnabled: true,
  teamArenaEnabled: true,
  eventsEnabled: true,
};

describe('configStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ flags: DEFAULTS, loaded: false });
  });

  it('starts with all feature flags enabled', () => {
    const { result } = renderHook(() => useConfigStore());
    Object.keys(DEFAULTS).forEach(flag => {
      expect(result.current.flags[flag]).toBe(true);
    });
    expect(result.current.loaded).toBe(false);
  });

  it('loads flags from API and merges with defaults', async () => {
    (configApi.getPublic as any).mockResolvedValue({
      data: { featureFlags: { leaderboardEnabled: false, spectatorModeEnabled: false } },
    });

    const { result } = renderHook(() => useConfigStore());
    await act(async () => { await result.current.load(); });

    expect(result.current.flags.leaderboardEnabled).toBe(false);
    expect(result.current.flags.spectatorModeEnabled).toBe(false);
    expect(result.current.flags.survivalEnabled).toBe(true); // default preserved
    expect(result.current.loaded).toBe(true);
  });

  it('does not call API a second time if already loaded', async () => {
    (configApi.getPublic as any).mockResolvedValue({ data: { featureFlags: {} } });
    useConfigStore.setState({ loaded: true });

    const { result } = renderHook(() => useConfigStore());
    await act(async () => { await result.current.load(); });

    expect(configApi.getPublic).not.toHaveBeenCalled();
  });

  it('sets loaded=true even when API throws', async () => {
    (configApi.getPublic as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConfigStore());
    await act(async () => { await result.current.load(); });

    expect(result.current.loaded).toBe(true);
    expect(result.current.flags.leaderboardEnabled).toBe(true); // defaults intact
  });

  it('update() merges partial flags without touching others', () => {
    const { result } = renderHook(() => useConfigStore());
    act(() => { result.current.update({ leaderboardEnabled: false }); });

    expect(result.current.flags.leaderboardEnabled).toBe(false);
    expect(result.current.flags.survivalEnabled).toBe(true);
    expect(result.current.flags.eventsEnabled).toBe(true);
  });

  it('update() can set multiple flags at once', () => {
    const { result } = renderHook(() => useConfigStore());
    act(() => { result.current.update({ leaderboardEnabled: false, survivalEnabled: false }); });

    expect(result.current.flags.leaderboardEnabled).toBe(false);
    expect(result.current.flags.survivalEnabled).toBe(false);
    expect(result.current.flags.teamArenaEnabled).toBe(true);
  });
});
