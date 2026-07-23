import type { XpRank } from '@/features/progression/ranks';

interface RankBadgeProps {
  rank: XpRank;
  compact?: boolean;
  className?: string;
}

export function RankBadge({ rank, compact = false, className = '' }: RankBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        rank.toneClass,
        compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-2.5 py-1 text-xs',
        className,
      ].join(' ')}
      title={`${rank.name} ${rank.division} · ${rank.minXp}+ XP`}
    >
      <span aria-hidden="true">{rank.emoji}</span>
      <span>{rank.name} {rank.division}</span>
    </span>
  );
}
