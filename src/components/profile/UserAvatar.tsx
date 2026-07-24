import { useAvatarStore } from '@/store/avatarStore';

const OPPONENT_AVATARS = ['🦊', '🐯', '🦉', '🤖', '🚀', '🎯', '🦁', '🐼'] as const;

function stableAvatar(name: string): string {
  let hash = 0;
  for (const character of Array.from(name || 'AqlBand')) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return OPPONENT_AVATARS[hash % OPPONENT_AVATARS.length];
}

export function UserAvatar({
  name = 'AqlBand',
  avatar,
  currentUser = false,
  size = 'md',
  active = false,
  className = '',
}: {
  name?: string;
  avatar?: string | null;
  currentUser?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  active?: boolean;
  className?: string;
}) {
  const localAvatar = useAvatarStore((state) => state.avatar);
  const symbol = avatar || (currentUser ? localAvatar : stableAvatar(name));
  const sizeClass = {
    xs: 'h-7 w-7 text-sm rounded-lg',
    sm: 'h-9 w-9 text-lg rounded-xl',
    md: 'h-11 w-11 text-xl rounded-2xl',
    lg: 'h-14 w-14 text-2xl rounded-2xl',
    xl: 'h-20 w-20 text-4xl rounded-[1.7rem]',
  }[size];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center border bg-gradient-to-br from-[#1E3351] via-[#132238] to-[#0B1421] shadow-[0_12px_28px_-18px_rgba(0,0,0,.95)] ${
        active
          ? 'border-emerald-300/60 ring-2 ring-emerald-300/15'
          : 'border-mist-300/15'
      } ${sizeClass} ${className}`}
      aria-label={name}
      title={name}
    >
      <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,.45)]" aria-hidden="true">
        {symbol}
      </span>
      {active ? (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0B1421] bg-emerald-400" />
      ) : null}
    </span>
  );
}
