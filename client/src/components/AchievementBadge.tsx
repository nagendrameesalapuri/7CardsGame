import React from 'react';
import { PlayerBadge } from '../types';

const RARITY_STYLE: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  legendary: { text: '#fbbf24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.45)', glow: '0 0 8px rgba(251,191,36,0.4)' },
  epic:      { text: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.45)', glow: '0 0 8px rgba(168,85,247,0.35)' },
  rare:      { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)',  glow: '0 0 6px rgba(96,165,250,0.3)'  },
  common:    { text: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', glow: 'none'                          },
};

interface AchievementBadgeProps {
  badge: PlayerBadge;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function AchievementBadge({ badge, size = 'sm', className = '' }: AchievementBadgeProps) {
  const s = RARITY_STYLE[badge.rarity] ?? RARITY_STYLE.common;

  const fontSize  = size === 'xs' ? '8px'  : size === 'sm' ? '9px'  : '11px';
  const emojiSize = size === 'xs' ? '9px'  : size === 'sm' ? '10px' : '13px';
  const padding   = size === 'xs' ? '1px 4px' : size === 'sm' ? '2px 5px' : '3px 8px';

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-bold select-none ${className}`}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: s.glow,
        color: s.text,
        fontSize,
        padding,
        whiteSpace: 'nowrap',
        maxWidth: size === 'xs' ? 68 : size === 'sm' ? 84 : 120,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={`${badge.emoji} ${badge.name} (${badge.rarity})`}
    >
      <span style={{ fontSize: emojiSize }}>{badge.emoji}</span>
      <span className="truncate">{badge.name}</span>
    </span>
  );
}
