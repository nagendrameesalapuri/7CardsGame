import React from 'react';
import { clsx } from 'clsx';

const AVATARS = ['🎭', '🦁', '🐯', '🐻', '🦊', '🐺', '🦝', '🐼', '🦄', '🐲'];

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

function getEmoji(avatar: string): string {
  // Avatar can be index or google profile URL
  if (avatar?.startsWith('http') || avatar?.startsWith('data:')) return '';
  const idx = parseInt(avatar?.replace(/\D/g, '') ?? '0', 10) % AVATARS.length;
  return AVATARS[idx] ?? AVATARS[0];
}

export function Avatar({ avatar, username, size = 'md', className, showName, isBot, isConnected }: AvatarProps) {
  const emoji = getEmoji(avatar);
  const isUrl = avatar?.startsWith('http') || avatar?.startsWith('data:');

  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      <div className="relative inline-flex">
        <div
          className={clsx(
            sizeMap[size],
            'rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 ring-2 ring-dark-border overflow-hidden'
          )}
        >
          {isUrl ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span>{emoji}</span>
          )}
        </div>

        {/* Connection dot */}
        {isConnected !== undefined && (
          <span className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-dark-surface',
            isConnected ? 'bg-neon-green' : 'bg-gray-500'
          )} />
        )}

        {/* Bot badge */}
        {isBot && (
          <span className="absolute -top-1 -right-1 bg-neon-blue rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold text-dark-bg">
            AI
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
