import { RankBadge } from '@/components/progression/RankBadge';
import { getXpRank } from '@/features/progression/ranks';
import type { LeaderboardRow } from '@/types/leaderboard';

interface LeaderboardEntryRowProps {
  rank: number;
  row: LeaderboardRow;
  isCurrentUser: boolean;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const numberFormatter = new Intl.NumberFormat('uz-UZ');

export function LeaderboardEntryRow({ rank, row, isCurrentUser }: LeaderboardEntryRowProps) {
  const initials = row.first_name.slice(0, 2).toUpperCase();
  const xpRank = getXpRank(row.totalXp);

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isCurrentUser ? 'bg-violet-600/15' : ''}`}>
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

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-mist-100">
          {row.first_name}
          {isCurrentUser && <span className="ml-1.5 text-xs text-violet-300">(siz)</span>}
        </p>

        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {row.username && <span className="truncate text-xs text-mist-500">@{row.username}</span>}
          <RankBadge rank={xpRank} compact />
        </div>
      </div>

      <span className="shrink-0 text-right">
        <span className="block font-mono text-sm font-bold tabular-nums text-gold-400">
          {numberFormatter.format(row.xp)} XP
        </span>
        {row.xp !== row.totalXp && (
          <span className="block text-[10px] text-mist-500">
            jami {numberFormatter.format(row.totalXp)} XP
          </span>
        )}
      </span>
    </div>
  );
}
