/**
 * Multiplayer context factory.
 * Creates isolated browser contexts for each simulated player.
 */
import { Browser, BrowserContext, Page } from '@playwright/test';
import { ENV } from '../config/env';

export interface PlayerContext {
  context: BrowserContext;
  page: Page;
  username: string;
  token?: string;
  userId?: string;
}

export interface MultiplayerSession {
  players: PlayerContext[];
  cleanup: () => Promise<void>;
}

const STORAGE_STATE_PATH = (n: number) => `playwright/.auth/player${n}.json`;

/**
 * Create N isolated browser contexts (one per simulated player).
 * Each context has its own localStorage, cookies, and WebSocket connections.
 */
export async function createMultiplayerSession(
  browser: Browser,
  playerCount: number,
  options: { viewport?: { width: number; height: number } } = {},
): Promise<MultiplayerSession> {
  const players: PlayerContext[] = [];

  for (let i = 0; i < playerCount; i++) {
    const context = await browser.newContext({
      baseURL: ENV.BASE_URL,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    players.push({ context, page, username: '' });
  }

  return {
    players,
    cleanup: async () => {
      for (const p of players) {
        await p.context.close();
      }
    },
  };
}

/**
 * Perform guest login for a player context via the UI.
 */
export async function loginPlayer(
  player: PlayerContext,
  username: string,
): Promise<PlayerContext> {
  const { page } = player;

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: /play as guest/i }).click();
  await page.getByPlaceholder(/your display name/i).fill(username);
  await page.getByRole('button', { name: /start playing/i }).click();
  await page.waitForURL('**/lobby', { timeout: 20_000 });

  const token = await page.evaluate(() => localStorage.getItem('token') ?? '');
  const userId = await page.evaluate(() => {
    try {
      const t = localStorage.getItem('token') ?? '';
      if (!t) return '';
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.userId ?? '';
    } catch { return ''; }
  });

  return { ...player, username, token, userId };
}

/**
 * Login all players in a multiplayer session.
 * Usernames default to Player1, Player2, …
 */
export async function loginAllPlayers(
  session: MultiplayerSession,
  usernames?: string[],
): Promise<void> {
  const stamp = Date.now();
  for (let i = 0; i < session.players.length; i++) {
    const name = usernames?.[i] ?? `Player${i + 1}_${stamp}`;
    const updated = await loginPlayer(session.players[i], name);
    session.players[i] = updated;
  }
}

/**
 * Wait for all players to be on the specified URL pattern.
 */
export async function waitForAllPlayers(
  session: MultiplayerSession,
  urlPattern: string | RegExp,
  timeout = 30_000,
): Promise<void> {
  await Promise.all(
    session.players.map(p => p.page.waitForURL(urlPattern, { timeout })),
  );
}

/**
 * Run an action concurrently across all player pages.
 */
export async function allPlayers(
  session: MultiplayerSession,
  action: (page: Page, index: number) => Promise<void>,
): Promise<void> {
  await Promise.all(session.players.map((p, i) => action(p.page, i)));
}
