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

const descriptions: Record<LeaderboardTabKey, string> = {
  global: 'Jami XP bo‘yicha umumiy reyting',
  friends: 'Do‘stlaringiz orasida jami XP bo‘yicha',
  weekly: 'Shu hafta yig‘ilgan XP bo‘yicha',
  monthly: 'Shu oy yig‘ilgan XP bo‘yicha',
};

export function LeaderboardScreen() {
  const appUserId = useOnlineStore((state) => state.appUserId);
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
      if (tab === 'global') setRows(await getGlobalLeaderboard(100));
      else if (tab === 'weekly') setRows(await getWeeklyLeaderboard(100));
      else if (tab === 'monthly') setRows(await getMonthlyLeaderboard(100));
      else setRows(appUserId ? await getFriendsLeaderboard(appUserId) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }, [tab, appUserId]);

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
          <p className="mt-3 text-center text-xs text-mist-500">{descriptions[tab]}</p>

          <div className="mt-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-mist-500">Yuklanmoqda...</p>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-sm text-signal-early">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadTab()}
                  className="mt-3 rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-300"
                >
                  Qayta urinish
                </button>
              </div>
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-mist-500">
                {tab === 'friends'
                  ? "Hali do‘stlaringiz yo‘q. Do‘st qo‘shish uchun Profil bo‘limiga o‘ting."
                  : 'Bu davrda hali XP yig‘ilmagan.'}
              </p>
            ) : (
              <Card padded={false} className="divide-y divide-ink-600/50">
                {rows.map((row) => (
                  <LeaderboardEntryRow
                    key={row.userId}
                    rank={row.rank}
                    row={row}
                    isCurrentUser={row.userId === appUserId}
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
