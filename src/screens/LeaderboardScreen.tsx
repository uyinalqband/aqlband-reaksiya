import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { LeaderboardTabs, type LeaderboardTabKey } from '@/components/leaderboard/LeaderboardTabs';
import { RankBadge } from '@/components/progression/RankBadge';
import { getXpRank } from '@/features/progression/ranks';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getFriendsLeaderboard,
  getGlobalLeaderboard,
  getMonthlyLeaderboard,
  getUserRank,
  getWeeklyLeaderboard,
} from '@/services/leaderboardService';
import type { LeaderboardRow } from '@/types/leaderboard';

function XpRow({
  row,
  currentUser = false,
}: {
  row: LeaderboardRow;
  currentUser?: boolean;
}) {
  const { t } = useTranslation();
  const rankInfo = getXpRank(row.totalXp);

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${
      currentUser
        ? 'border-violet-400/45 bg-violet-500/15'
        : 'border-ink-600 bg-ink-900/60'
    }`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
        currentUser ? 'bg-violet-500 text-white' : 'bg-ink-700 text-mist-300'
      }`}>
        {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] ?? `#${row.rank}` : `#${row.rank}`}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold text-mist-100">
          {row.displayName}
          {currentUser ? <span className="ml-1 text-sm text-violet-200">({t('common.you')})</span> : null}
        </p>
        <p className="truncate text-xs text-mist-500">
          {row.username ? `@${row.username}` : '—'}
        </p>
        <div className="mt-1">
          <RankBadge rank={rankInfo} compact />
        </div>
      </div>

      <div className="text-right">
        <p className="font-mono text-lg font-bold tabular-nums text-gold-400">
          {row.xp.toLocaleString('en-US')} XP
        </p>
      </div>
    </div>
  );
}

export function LeaderboardScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const updateRank = useOnlineStore((state) => state.updateRank);
  const lastKnownRank = useOnlineStore((state) => state.lastKnownRank);
  const [tab, setTab] = useState<LeaderboardTabKey>('global');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserRow = useMemo(
    () => rows.find((row) => row.userId === appUserId) ?? null,
    [appUserId, rows],
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loader =
        tab === 'friends'
          ? getFriendsLeaderboard
          : tab === 'weekly'
            ? getWeeklyLeaderboard
            : tab === 'monthly'
              ? getMonthlyLeaderboard
              : getGlobalLeaderboard;

      const data = await loader(30);
      setRows(data);

      if (tab === 'global') {
        try {
          const rank = await getUserRank();
          await updateRank(rank);
        } catch {
          // keep cached rank
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t, tab, updateRank]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setRows([]);
      setError(t('leaderboard.notConfigured'));
      return;
    }

    void loadRows();
  }, [loadRows, t]);

  return (
    <Screen>
      <div
        className="fixed inset-0 z-30 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.1rem)' }}
      >
      <Card
        padded={false}
        className="flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden"
      >
        <div className="shrink-0 p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-mist-100">
              {t('nav.leaderboard')}
            </h1>
            <p className="mt-1 text-sm text-mist-500">
              {t(`leaderboard.descriptions.${tab}`)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-ink-700 text-xl text-mist-200 transition-colors active:bg-ink-600"
          >
            ✕
          </button>
          </div>

          <div className="mt-4">
            <LeaderboardTabs active={tab} onChange={setTab} />
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3 pr-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-mist-500">{t('common.loading')}</p>
          ) : error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-200">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-mist-500">{t('leaderboard.empty')}</p>
          ) : (
            rows.map((row) => (
              <XpRow
                key={`${row.userId}-${row.rank}`}
                row={row}
                currentUser={row.userId === appUserId}
              />
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-ink-600/70 bg-ink-800/95 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">
            {t('leaderboard.yourPosition')}
          </p>
          {currentUserRow ? (
            <div className="mt-2">
              <XpRow row={currentUserRow} currentUser />
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-3 text-sm">
              <span className="text-mist-400">{t('leaderboard.notRankedYet')}</span>
              <span className="font-mono text-lg font-bold text-gold-400">
                {tab === 'global' && lastKnownRank ? `#${lastKnownRank}` : '—'}
              </span>
            </div>
          )}
        </div>
      </Card>
      </div>
    </Screen>
  );
}
