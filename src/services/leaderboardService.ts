import { invokePlatformApi } from '@/lib/platformApi';
import type { LeaderboardRow } from '@/types/leaderboard';

export type LeaderboardPeriod = 'global' | 'friends' | 'weekly' | 'monthly';

export async function getLeaderboard(period: LeaderboardPeriod, limit = 100): Promise<LeaderboardRow[]> {
  const result = await invokePlatformApi<{ rows: LeaderboardRow[] }>('leaderboard.list', { period, limit });
  return result.rows;
}

export const getGlobalLeaderboard = (limit = 100) => getLeaderboard('global', limit);
export const getWeeklyLeaderboard = (limit = 100) => getLeaderboard('weekly', limit);
export const getMonthlyLeaderboard = (limit = 100) => getLeaderboard('monthly', limit);
export const getFriendsLeaderboard = (limit = 100) => getLeaderboard('friends', limit);

export async function getUserRank(): Promise<number | null> {
  const result = await invokePlatformApi<{ rank: number | null }>('leaderboard.rank');
  return result.rank;
}
