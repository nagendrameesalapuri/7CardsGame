/**
 * Test user data factories.
 */

let counter = 0;

export function uniqueUsername(prefix = 'User'): string {
  counter++;
  return `${prefix}_${Date.now()}_${counter}`;
}

export function playerNames(count: number, prefix = 'P'): string[] {
  const stamp = Date.now();
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}_${stamp}`);
}

export const TEST_ADMIN_PASS = process.env.ADMIN_SECRET ?? 'admin-test-123';

export interface GuestUser {
  username: string;
  token?: string;
  userId?: string;
}

export function makeGuestUser(prefix = 'Guest'): GuestUser {
  return { username: uniqueUsername(prefix) };
}
