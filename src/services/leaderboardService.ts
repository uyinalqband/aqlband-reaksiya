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
    created_at: '',
    score: row.xp,
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
 * Backward-compatible replacement for the old direct score insert.
 * The verified unified history is synchronized; PostgreSQL awards XP and
 * refreshes the XP leaderboard on the server.
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

  const userId = online.account?.id ?? online.appUserId ?? 'current-user';
  const displayName = online.account?.displayName ?? input.firstName;
  return {
    userId,
    displayName,
    username: online.account?.username ?? input.username,
    xp: 0,
    totalXp: 0,
    level: 1,
    rank: 0,
    id: userId,
    telegram_id: online.telegramId ?? input.telegramId,
    first_name: displayName,
    created_at: new Date().toISOString(),
    score: 0,
  };
}
