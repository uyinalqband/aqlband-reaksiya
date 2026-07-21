import { formatMs } from '@/features/game/logic';
import type { LeaderboardRow } from '@/types/leaderboard';

interface LeaderboardEntryRowProps {
  rank: number;
  row: LeaderboardRow;
  isCurrentUser: boolean;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardEntryRow({ rank, row, isCurrentUser }: LeaderboardEntryRowProps) {
  const displayName = row.username ? `@${row.username}` : row.first_name;
  const initials = row.first_name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        isCurrentUser ? 'bg-violet-600/15' : ''
      }`}
    >
      <span className="w-7 shrink-0 text-center font-mono text-sm font-semibold text-mist-500">
        {MEDAL[rank] ?? rank}
      </span>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isCurrentUser ? 'bg-violet-600 text-mist-100' : 'bg-ink-700 text-mist-300'
        }`}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-mist-100">
        {row.first_name}
        {isCurrentUser && <span className="ml-1.5 text-xs text-violet-300">(siz)</span>}
        {row.username && <span className="block truncate text-xs text-mist-500">{displayName}</span>}
      </span>
      <span className="shrink-0 font-mono text-sm font-semibold text-mist-100">
        {formatMs(row.score)} <span className="text-xs text-mist-500">ms</span>
      </span>
    </div>
  );
}
