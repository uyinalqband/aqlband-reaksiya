import { invokePlatformApi } from '@/lib/platformApi';
import type {
  CheckersHistoryRow,
  CheckersLeaderboardRow,
  CheckersRatingProfile,
  MatchmakingStatus,
} from '@/types/checkersPlatform';

export function getCheckersProfile(): Promise<CheckersRatingProfile> {
  return invokePlatformApi<CheckersRatingProfile>('checkers.profile');
}

export async function getCheckersLeaderboard(
  limit = 50,
): Promise<{
  rows: CheckersLeaderboardRow[];
  currentUser: CheckersLeaderboardRow | null;
}> {
  return invokePlatformApi('checkers.leaderboard', { limit });
}

export async function getCheckersHistory(
  outcome: 'all' | 'win' | 'draw' | 'loss' = 'all',
  limit = 50,
): Promise<CheckersHistoryRow[]> {
  const result = await invokePlatformApi<{ rows: CheckersHistoryRow[] }>(
    'checkers.history',
    { outcome, limit },
  );
  return result.rows;
}

export function joinRatedCheckersQueue(): Promise<MatchmakingStatus> {
  return invokePlatformApi<MatchmakingStatus>('checkers.queue.join');
}

export function getRatedCheckersQueueStatus(): Promise<MatchmakingStatus> {
  return invokePlatformApi<MatchmakingStatus>('checkers.queue.status');
}

export function leaveRatedCheckersQueue(): Promise<{ left: true }> {
  return invokePlatformApi('checkers.queue.leave');
}
