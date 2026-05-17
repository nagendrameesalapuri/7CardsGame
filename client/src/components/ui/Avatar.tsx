import React from 'react';
import { clsx } from 'clsx';

const AVATARS = ['🎭', '🦁', '🐯', '🐻', '🦊', '🐺', '🦝', '🐼', '🦄', '🐲'];

// Premium bot avatars keyed by AI personality
const BOT_AVATAR_CFG: Record<string, { emoji: string; bg: string; ring: string; label: string }> = {
  boss:       { emoji: '💀', bg: 'linear-gradient(135deg, #450a0a 0%, #991b1b 100%)', ring: '#ef4444', label: 'BOSS' },
  smart:      { emoji: '🧠', bg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', ring: '#60a5fa', label: 'AI'   },
  aggressive: { emoji: '⚡', bg: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)', ring: '#f59e0b', label: 'AI'   },
  bluff:      { emoji: '🌀', bg: 'linear-gradient(135deg, #3b0764 0%, #7e22ce 100%)', ring: '#c084fc', label: 'AI'   },
  safe:       { emoji: '🛡️', bg: 'linear-gradient(135deg, #052e16 0%, #15803d 100%)', ring: '#22c55e', label: 'AI'   },
};

interface AvatarProps {
  avatar: string;
  username?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
  isBot?: boolean;
  isConnected?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-4xl',
};

const emojiFontSize = { xs: '10px', sm: '13px', md: '16px', lg: '22px', xl: '32px' };

function getEmoji(avatar: string): string {
  if (avatar?.startsWith('http') || avatar?.startsWith('data:')) return '';
  const idx = parseInt(avatar?.replace(/\D/g, '') ?? '0', 10) % AVATARS.length;
  return AVATARS[idx] ?? AVATARS[0];
}

export function Avatar({ avatar, username, size = 'md', className, showName, isBot, isConnected }: AvatarProps) {
  const isUrl  = avatar?.startsWith('http') || avatar?.startsWith('data:');
  const botKey = avatar?.startsWith('bot_') ? avatar.slice(4) : null;
  const botCfg = botKey ? (BOT_AVATAR_CFG[botKey] ?? null) : null;
  const emoji  = botCfg ? botCfg.emoji : getEmoji(avatar);

  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      <div className="relative inline-flex">
        <div
          className={clsx(sizeMap[size], 'rounded-full flex items-center justify-center overflow-hidden')}
          style={botCfg ? {
            background: botCfg.bg,
            boxShadow: `0 0 0 2px ${botCfg.ring}, 0 0 10px ${botCfg.ring}55`,
          } : {
            background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.12)',
          }}
        >
          {isUrl ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontSize: emojiFontSize[size] }}>{emoji}</span>
          )}
        </div>

        {/* Connection dot */}
        {isConnected !== undefined && (
          <span className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-surface',
            isConnected ? 'bg-neon-green' : 'bg-gray-500'
          )} />
        )}

        {/* Bot badge — personality-colored for AI bots */}
        {(isBot || botCfg) && (
          <span
            className="absolute -top-1 -right-1 rounded-full w-4 h-4 flex items-center justify-center text-[7px] font-black"
            style={botCfg
              ? { background: botCfg.ring, color: '#0d1117', boxShadow: `0 0 6px ${botCfg.ring}` }
              : { background: '#3b82f6', color: '#0d1117' }}>
            {botCfg?.label ?? 'AI'}
          </span>
        )}
      </div>

      {showName && username && (
        <span className="text-xs text-dark-muted truncate max-w-[60px]">{username}</span>
      )}
    </div>
  );
}

export { AVATARS };
