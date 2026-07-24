import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { getCheckersLeague } from '@/features/checkers/rating';
import { getCheckersLeaderboard } from '@/services/checkersPlatformService';
import { useOnlineStore } from '@/store/onlineStore';
import type { CheckersLeaderboardRow } from '@/types/checkersPlatform';

function RatingRow({
  row,
  current = false,
}: {
  row: CheckersLeaderboardRow;
  current?: boolean;
}) {
  const league = getCheckersLeague(row.rating);
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
        current
          ? 'border-gold-300/40 bg-gold-500/10'
          : 'border-mist-400/10 bg-ink-800/65'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black ${
        row.rank <= 3 ? 'bg-gold-500/15 text-gold-300' : 'bg-ink-700 text-mist-400'
      }`}>
        {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-extrabold text-mist-100">
          {row.displayName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-mist-600">
          {row.username ? `@${row.username}` : `${row.games} games`}
        </p>
        <p className="mt-1 text-[10px] font-bold text-mist-400">
          {league.emoji} {league.name}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-xl font-black tabular-nums text-gold-300">
          {row.rating}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-mist-600">ELO</p>
      </div>
    </div>
  );
}

export function LeaderboardScreen() {
  const { t } = useTranslation();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const [rows, setRows] = useState<CheckersLeaderboardRow[]>([]);
  const [current, setCurrent] = useState<CheckersLeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCheckersLeaderboard(50);
      setRows(result.rows);
      setCurrent(result.currentUser);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen className="pb-28">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">
          {t('v2.officialRanking')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">
          🏆 {t('v2.checkersLeaderboard')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-mist-500">
          {t('v2.leaderboardDescription')}
        </p>
      </header>

      <Card className="mt-5 border-violet-400/20 bg-gradient-to-br from-violet-600/20 to-ink-800/80">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-mono text-xl font-black text-mist-100">1200</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-mist-600">
              {t('v2.startRating')}
            </p>
          </div>
          <div>
            <p className="font-mono text-xl font-black text-emerald-300">+ELO</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-mist-600">
              {t('v2.win')}
            </p>
          </div>
          <div>
            <p className="font-mono text-xl font-black text-red-300">−ELO</p>
            <p className="mt-1 text-[9px] uppercase tracking-wider text-mist-600">
              {t('v2.loss')}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-5 space-y-2">
        {loading ? (
          Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="h-[76px] animate-pulse rounded-2xl border border-mist-400/10 bg-ink-800/60"
            />
          ))
        ) : error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="w-full rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </button>
        ) : rows.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-mist-500">{t('leaderboard.empty')}</p>
          </Card>
        ) : (
          rows.map((row) => (
            <RatingRow
              key={row.userId}
              row={row}
              current={row.userId === appUserId}
            />
          ))
        )}
      </div>

      {current ? (
        <div className="sticky bottom-[6.2rem] z-20 mt-4 rounded-3xl border border-gold-300/35 bg-[#0D1725]/95 p-3 shadow-goldGlow backdrop-blur-xl">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
            {t('leaderboard.yourPosition')}
          </p>
          <RatingRow row={current} current />
        </div>
      ) : null}
    </Screen>
  );
}
