import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { getCheckersHistory } from '@/services/checkersPlatformService';
import type { CheckersHistoryRow } from '@/types/checkersPlatform';

type Filter = 'all' | 'win' | 'draw' | 'loss';

function durationLabel(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function CheckersHistoryScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<CheckersHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getCheckersHistory(filter, 75));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const locale = i18n.resolvedLanguage?.startsWith('ru')
    ? 'ru-RU'
    : i18n.resolvedLanguage?.startsWith('en')
      ? 'en-US'
      : 'uz-UZ';

  return (
    <Screen>
      <TopBar title={t('v2.checkersHistory')} onBack={() => navigate(-1)} />

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {(['all', 'win', 'draw', 'loss'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${
              filter === item
                ? 'border-violet-400 bg-violet-500/20 text-violet-200'
                : 'border-mist-400/10 bg-ink-800/70 text-mist-500'
            }`}
          >
            {t(`v2.historyFilters.${item}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-ink-800/65" />
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
            <p className="py-8 text-center text-sm text-mist-500">
              {t('v2.noCheckersHistory')}
            </p>
          </Card>
        ) : (
          rows.map((row) => {
            const outcomeClass =
              row.outcome === 'win'
                ? 'text-emerald-300'
                : row.outcome === 'draw'
                  ? 'text-gold-300'
                  : 'text-red-300';
            return (
              <Card key={`${row.duelId}-${row.playedAt}`} className="overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`font-display text-lg font-extrabold ${outcomeClass}`}>
                      {row.outcome === 'win' ? '🏆' : row.outcome === 'draw' ? '🤝' : '🎯'}{' '}
                      {t(`v2.historyFilters.${row.outcome}`)}
                    </p>
                    <p className="mt-1 text-sm text-mist-300">
                      {t('history.meta.opponent')}: <strong>{row.opponentName}</strong>
                    </p>
                    <p className="mt-1 text-[11px] text-mist-600">
                      {new Date(row.playedAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-xl font-black ${
                      row.ratingDelta > 0
                        ? 'text-emerald-300'
                        : row.ratingDelta < 0
                          ? 'text-red-300'
                          : 'text-mist-400'
                    }`}>
                      {row.mode === 'rated'
                        ? `${row.ratingDelta > 0 ? '+' : ''}${row.ratingDelta}`
                        : '—'}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-mist-600">
                      {row.mode === 'rated' ? 'ELO' : t('v2.friendly')}
                    </p>
                  </div>
                </div>

                {row.mode === 'rated' && row.ratingAfter !== null ? (
                  <div className="mt-4 rounded-xl border border-gold-300/15 bg-gold-500/5 px-3 py-2">
                    <p className="text-xs text-mist-400">
                      🏆 {row.ratingBefore ?? '—'} →{' '}
                      <span className="font-mono font-bold text-gold-300">
                        {row.ratingAfter}
                      </span>
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Stat label={t('checkers.moves')} value={String(row.moves)} />
                  <Stat label={t('checkers.captured')} value={String(row.captured)} />
                  <Stat label={t('checkers.promotions')} value={String(row.promotions)} />
                  <Stat label={t('history.meta.durationMs')} value={durationLabel(row.durationMs)} />
                </div>
                <p className="mt-3 text-xs leading-5 text-mist-500">
                  {t(`checkers.reasons.${row.resultReason}`, {
                    defaultValue: row.resultReason,
                  })}
                </p>
              </Card>
            );
          })
        )}
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-900/55 p-2 text-center">
      <p className="font-mono text-sm font-bold text-mist-100">{value}</p>
      <p className="mt-1 truncate text-[8px] uppercase tracking-wide text-mist-700">
        {label}
      </p>
    </div>
  );
}
