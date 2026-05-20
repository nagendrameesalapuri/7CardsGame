/**
 * Multiplayer fixture — provides multiple isolated browser contexts
 * for testing real-time multiplayer scenarios.
 */
import { test as base, Browser, Page } from '@playwright/test';
import { MultiplayerSession, createMultiplayerSession, loginAllPlayers } from '../utils/multiplayer';

export interface MultiplayerFixtures {
  /** Two-player session (host + guest). */
  twoPlayerSession: MultiplayerSession;
  /** Four-player session. */
  fourPlayerSession: MultiplayerSession;
  /** Factory for N-player sessions. */
  nPlayerSession: (n: number, usernames?: string[]) => Promise<MultiplayerSession>;
}

export const test = base.extend<MultiplayerFixtures, { browser: Browser }>({
  twoPlayerSession: async ({ browser }, use) => {
    const session = await createMultiplayerSession(browser, 2);
    await loginAllPlayers(session);
    await use(session);
    await session.cleanup();
  },

  fourPlayerSession: async ({ browser }, use) => {
    const session = await createMultiplayerSession(browser, 4);
    await loginAllPlayers(session);
    await use(session);
    await session.cleanup();
  },

  nPlayerSession: async ({ browser }, use) => {
    const sessions: MultiplayerSession[] = [];
    const fn = async (n: number, usernames?: string[]): Promise<MultiplayerSession> => {
      const session = await createMultiplayerSession(browser, n);
      await loginAllPlayers(session, usernames);
      sessions.push(session);
      return session;
    };
    await use(fn);
    for (const s of sessions) await s.cleanup();
  },
});

export { expect } from '@playwright/test';
