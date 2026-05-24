import { ACHIEVEMENTS, getAchievement } from './progression';

export interface CachedBadge {
  emoji: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const RARITY_ORDER: Record<string, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

const cache = new Map<string, CachedBadge>();

export function getBadge(userId: string): CachedBadge | undefined {
  return cache.get(userId);
}

export function computeAndCacheBadge(
  userId: string,
  unlockedIds: string[],
): CachedBadge | undefined {
  let highest: (typeof ACHIEVEMENTS)[number] | undefined;

  for (const id of unlockedIds) {
    const def = getAchievement(id);
    if (!def) continue;
    if (!highest || RARITY_ORDER[def.rarity] > RARITY_ORDER[highest.rarity]) {
      highest = def;
    }
  }

  if (highest) {
    const badge: CachedBadge = { emoji: highest.emoji, name: highest.name, rarity: highest.rarity as CachedBadge['rarity'] };
    cache.set(userId, badge);
    return badge;
  } else {
    cache.delete(userId);
    return undefined;
  }
}
