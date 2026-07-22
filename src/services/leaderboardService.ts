import { invokePlatformApi } from '@/lib/platformApi';
import { useOnlineStore } from '@/store/onlineStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import type { LeaderboardApiRow, LeaderboardRow, SaveScoreInput } from '@/types/leaderboard';

export type LeaderboardPeriod = 'global' | 'friends' | 'weekly' | 'monthly';

function toUiRow(row: LeaderboardApiRow): LeaderboardRow {
  const online = useOnlineStore.getState();
  const currentAccountId = online.account?.id ?? online.appUserId;
  const isCurrentUser = currentAccountId === row.userId;

  return {
    ...row,
    id: row.userId,
    telegram_id: isCurrentUser && online.telegramId !== null ? online.telegramId : -1,
    first_name: row.displayName,
    created_at: row.playedAt,
  };
}

export async function getLeaderboard(period: LeaderboardPeriod, limit = 100): Promise<LeaderboardRow[]> {
  const result = await invokePlatformApi<{ rows: LeaderboardApiRow[] }>('leaderboard.list', { period, limit });
  return result.rows.map(toUiRow);
}

export const getGlobalLeaderboard = (limit = 100) => getLeaderboard('global', limit);
export const getWeeklyLeaderboard = (limit = 100) => getLeaderboard('weekly', limit);
export const getMonthlyLeaderboard = (limit = 100) => getLeaderboard('monthly', limit);
export const getFriendsLeaderboard = (limit = 100) => getLeaderboard('friends', limit);

/** Legacy argument is ignored; the server identifies the verified account. */
export async function getUserRank(_legacyTelegramId?: number): Promise<number | null> {
  const result = await invokePlatformApi<{ rank: number | null }>('leaderboard.rank');
  return result.rank;
}

/**
 * Backward-compatible replacement for the old direct leaderboard insert.
 * The verified unified history is synchronized instead; its DB trigger then
 * updates both reaction ranking and XP safely on the server.
 */
export async function saveScore(input: SaveScoreInput): Promise<LeaderboardRow> {
  const history = useGameHistoryStore.getState();
  const online = useOnlineStore.getState();

  if (online.account && history.hydrated) {
    await invokePlatformApi('history.sync', {
      attempts: history.attempts,
      historyGeneration: online.account.historyGeneration,
    });
  }

  const playedAt = new Date().toISOString();
  return {
    userId: online.account?.id ?? online.appUserId ?? 'current-user',
    displayName: online.account?.displayName ?? input.firstName,
    username: online.account?.username ?? input.username,
    score: Math.round(input.score),
    playedAt,
    rank: 0,
    id: online.account?.id ?? online.appUserId ?? 'current-user',
    telegram_id: online.telegramId ?? input.telegramId,
    first_name: online.account?.displayName ?? input.firstName,
    created_at: playedAt,
  };
}
