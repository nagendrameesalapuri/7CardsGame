/**
 * WebSocket / Socket.io monitoring utilities for tests.
 * Intercepts socket events via the browser's WebSocket API.
 */
import { Page } from '@playwright/test';

export interface SocketEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

/**
 * Inject a listener into the page that captures all incoming Socket.io events.
 * Returns a function that returns the captured events so far.
 *
 * Call this BEFORE navigating to the page that establishes the socket connection.
 */
export async function captureSocketEvents(page: Page): Promise<() => Promise<SocketEvent[]>> {
  await page.addInitScript(() => {
    (window as any).__socketEvents = [];
    const origWebSocket = window.WebSocket;
    window.WebSocket = class extends origWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener('message', (ev) => {
          try {
            // Socket.io binary frames start with a number — parse engine.io
            const raw = ev.data as string;
            if (typeof raw !== 'string') return;
            // Engine.io message: starts with "4" (socket.io namespace + data)
            if (!raw.startsWith('42')) return;
            const json = JSON.parse(raw.slice(2));
            if (Array.isArray(json) && json.length >= 1) {
              (window as any).__socketEvents.push({
                event: json[0],
                data: json[1] ?? null,
                timestamp: Date.now(),
              });
            }
          } catch { /* ignore non-json frames */ }
        });
      }
    };
  });

  return () => page.evaluate(() => (window as any).__socketEvents ?? []) as Promise<SocketEvent[]>;
}

/**
 * Wait until a specific socket event has been received on the page.
 */
export async function waitForSocketEvent(
  page: Page,
  eventName: string,
  timeout = 15_000,
): Promise<SocketEvent> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const events: SocketEvent[] = await page.evaluate(
      (name) => ((window as any).__socketEvents ?? []).filter((e: SocketEvent) => e.event === name),
      eventName,
    );
    if (events.length > 0) return events[events.length - 1];
    await page.waitForTimeout(200);
  }

  throw new Error(`Socket event "${eventName}" not received within ${timeout}ms`);
}

/**
 * Clear captured socket events (reset the buffer).
 */
export async function clearSocketEvents(page: Page): Promise<void> {
  await page.evaluate(() => { (window as any).__socketEvents = []; });
}

/**
 * Simulate a network disconnect by blocking socket.io connections briefly.
 * Re-enables after `durationMs`.
 */
export async function simulateSocketDisconnect(page: Page, durationMs = 3_000): Promise<void> {
  // Block all WS connections temporarily
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.waitForTimeout(durationMs);
  await page.unroute('**/socket.io/**');
}
