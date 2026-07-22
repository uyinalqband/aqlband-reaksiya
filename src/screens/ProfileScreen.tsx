import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { AddFriendBar } from '@/components/friends/AddFriendBar';
import { FriendRequestsList } from '@/components/friends/FriendRequestsList';
import { HistoryIcon, UsersIcon } from '@/components/ui/icons';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { computeUnifiedMsStats, useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getFriendList } from '@/services/friendService';
import { formatMs } from '@/features/game/logic';
import { GameHistoryList } from '@/components/game/GameHistoryList';
import { ProgressionCard } from '@/components/profile/ProgressionCard';
import type { FriendListEntry } from '@/types/friendship';

export function ProfileScreen() {
  const { t } = useTranslation();
  const telegramUser = useTelegramUser();
  const appUserId = useOnlineStore((s) => s.appUserId);

  const attempts = useGameHistoryStore((state) => state.attempts);
  const snapshot = useMemo(() => computeUnifiedMsStats(attempts), [attempts]);

  const [friendEntries, setFriendEntries] = useState<FriendListEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    if (!appUserId || !isSupabaseConfigured) {
      setFriendsLoading(false);
      return;
    }
    setFriendsLoading(true);
    try {
      setFriendEntries(await getFriendList(appUserId));
    } catch (error) {
      console.error('Failed to load friends', error);
    } finally {
      setFriendsLoading(false);
    }
  }, [appUserId]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const initials = telegramUser?.firstName?.slice(0, 2).toUpperCase() ?? 'AB';

  return (
    <Screen>
      <div className="mb-2 flex items-center gap-2">
        <UsersIcon width={18} height={18} className="text-mist-300" />
        <h1 className="font-display text-lg font-semibold text-mist-100">Profil</h1>
      </div>

      {/* Identity — read-only, sourced entirely from Telegram */}
      <Card className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-violet-500/40 bg-ink-700 font-display text-lg font-bold text-mist-100">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold text-mist-100">
            {telegramUser?.firstName ?? 'AqlBand'} {telegramUser?.lastName ?? ''}
          </p>
          {telegramUser?.username && <p className="truncate text-sm text-mist-500">@{telegramUser.username}</p>}
          <p className="mt-0.5 text-xs text-mist-700">ID: {telegramUser?.id ?? '—'}</p>
        </div>
      </Card>

      <ProgressionCard />

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label={t('home.statBest')} value={snapshot.best !== null ? formatMs(snapshot.best) : '—'} accent />
        <StatCard label={t('home.statAverage')} value={snapshot.average !== null ? formatMs(snapshot.average) : '—'} />
        <StatCard label={t('home.statAttempts')} value={String(snapshot.totalAttempts)} />
      </div>

      {/* History */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-mist-300">
          <HistoryIcon width={15} height={15} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('home.historyTitle')}</h2>
        </div>
        {attempts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            {t('home.noStatsYet')}
          </p>
        ) : (
          <GameHistoryList attempts={attempts} limit={8} showDate />
        )}
      </div>

      {/* Friends */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-mist-300">
          <UsersIcon width={15} height={15} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Do'stlar</h2>
        </div>

        {!isSupabaseConfigured ? (
          <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            Onlayn funksiyalar hozircha sozlanmagan.
          </p>
        ) : !appUserId ? (
          <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            Ulanish o'rnatilmoqda...
          </p>
        ) : (
          <>
            <AddFriendBar myUserId={appUserId} onRequestSent={() => void loadFriends()} />
            <div className="mt-5">
              {friendsLoading ? (
                <p className="py-6 text-center text-sm text-mist-500">Yuklanmoqda...</p>
              ) : (
                <FriendRequestsList entries={friendEntries} onChanged={() => void loadFriends()} />
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
