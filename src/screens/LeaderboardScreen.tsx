import { useCallback, useEffect, useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { LeaderboardTabs, type LeaderboardTabKey } from '@/components/leaderboard/LeaderboardTabs';
import { LeaderboardEntryRow } from '@/components/leaderboard/LeaderboardEntryRow';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
} from '@/services/leaderboardService';
import { getFriendsLeaderboard } from '@/services/friendService';
import type { LeaderboardRow } from '@/types/leaderboard';

export function LeaderboardScreen() {
  const appUserId = useOnlineStore((s) => s.appUserId);
  const telegramId = useOnlineStore((s) => s.telegramId);

  const [tab, setTab] = useState<LeaderboardTabKey>('global');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
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
        } else {
          setRows(await getFriendsLeaderboard(appUserId, telegramId));
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
      <TopBar title="Reyting" />

      {!isSupabaseConfigured ? (
        <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-500">
          Onlayn reyting hozircha sozlanmagan.
        </p>
      ) : (
        <>
          <LeaderboardTabs active={tab} onChange={setTab} />

          <div className="mt-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-mist-500">Yuklanmoqda...</p>
            ) : error ? (
              <p className="py-8 text-center text-sm text-signal-early">{error}</p>
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-500">
                {tab === 'friends'
                  ? "Hali do'stlaringiz yo'q. Do'st qo'shish uchun Profil bo'limiga o'ting."
                  : "Bu yerda hali hech kim yo'q."}
              </p>
            ) : (
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
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
