import { Card } from '@/components/ui/Card';
import { GAME_CATALOG, formatAttemptResult } from '@/features/history/gameCatalog';
import type { GameAttempt } from '@/store/gameHistoryStore';

interface GameHistoryListProps {
  attempts: GameAttempt[];
  limit?: number;
  showDate?: boolean;
}

export function GameHistoryList({ attempts, limit = 5, showDate = false }: GameHistoryListProps) {
  const visible = attempts.slice(0, limit);

  return (
    <Card padded={false} className="divide-y divide-ink-600/50">
      {visible.map((attempt) => {
        const game = GAME_CATALOG[attempt.gameId];
        const date = new Date(attempt.playedAt);
        const timestamp = showDate
          ? date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
          : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        return (
          <div key={attempt.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-lg" aria-hidden="true">
                {game.emoji}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-mist-300">{game.title}</p>
                <p className="text-[10px] text-mist-600">{timestamp}</p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-mist-100">
              {formatAttemptResult(attempt)}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
