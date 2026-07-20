import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { LeaderboardTabs, type LeaderboardTabKey } from '@/components/leaderboard/LeaderboardTabs';
import { LeaderboardEntryRow } from '@/components/leaderboard/LeaderboardEntryRow';
import { AddFriendBar } from '@/components/friends/AddFriendBar';
import { FriendRequestsList } from '@/components/friends/FriendRequestsList';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
} from '@/services/leaderboardService';
import { getFriendList, getFriendsLeaderboard } from '@/services/friendService';
import type { LeaderboardRow } from '@/types/leaderboard';
import type { FriendListEntry } from '@/types/friendship';

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const goBack = useCallback(() => navigate(-1), [navigate]);
  useTelegramBackButton(goBack);

  const appUserId = useOnlineStore((s) => s.appUserId);
  const telegramId = useOnlineStore((s) => s.telegramId);

  const [tab, setTab] = useState<LeaderboardTabKey>('global');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [friendEntries, setFriendEntries] = useState<FriendListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTab = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (tab === 'global') {
        setRows(await getGlobalLeaderboard(100));
      } else if (tab === 'weekly') {
        setRows(await getWeeklyLeaderboard(100));
      } else if (tab === 'monthly') {
        setRows(await getMonthlyLeaderboard(100));
      } else if (tab === 'friends') {
        if (!appUserId || telegramId === null) {
          setRows([]);
          setFriendEntries([]);
        } else {
          const [leaderboard, friends] = await Promise.all([
            getFriendsLeaderboard(appUserId, telegramId),
            getFriendList(appUserId),
          ]);
          setRows(leaderboard);
          setFriendEntries(friends);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, [tab, appUserId, telegramId]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  return (
    <Screen>
      <TopBar title="Reyting" onBack={goBack} />

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-500">
          Onlayn reyting hozircha sozlanmagan.
        </p>
      ) : (
        <>
          <LeaderboardTabs active={tab} onChange={setTab} />

          <div className="mt-4">
            {tab === 'friends' && (
              <div className="mb-5">
                {!appUserId ? (
                  <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
                    Ulanish o'rnatilmoqda...
                  </p>
                ) : (
                  <>
                    <AddFriendBar myUserId={appUserId} onRequestSent={() => void loadTab()} />
                    <div className="mt-5">
                      <FriendRequestsList entries={friendEntries} onChanged={() => void loadTab()} />
                    </div>
                  </>
                )}
              </div>
            )}

            {loading ? (
              <p className="py-8 text-center text-sm text-mist-500">Yuklanmoqda...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-signal-early">{error}</p>
            ) : tab === 'friends' && rows.length === 0 ? null : rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-500">
                Bu yerda hali hech kim yo'q.
              </p>
            ) : (
              <>
                {tab === 'friends' && rows.length > 0 && (
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
                    Do'stlar reytingi
                  </h3>
                )}
                <Card padded={false} className="divide-y divide-ink-600/50">
                  {rows.map((row, index) => (
                    <LeaderboardEntryRow
                      key={row.id}
                      rank={index + 1}
                      row={row}
                      isCurrentUser={row.telegram_id === telegramId}
                    />
                  ))}
                </Card>
              </>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
