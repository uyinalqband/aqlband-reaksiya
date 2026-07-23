import { invokePlatformApi } from '@/lib/platformApi';
import type { SoloGameId } from '@/features/games/catalog';

export interface GameBestLeaderboardRow {
  userId: string;
  displayName: string;
  username: string | null;
  bestMs: number;
  rank: number;
}

export interface GameBestLeaderboardResponse {
  rows: GameBestLeaderboardRow[];
  currentUser: GameBestLeaderboardRow | null;
}

export async function getGameBestLeaderboard(
  gameId: SoloGameId,
  limit = 30,
): Promise<GameBestLeaderboardResponse> {
  return invokePlatformApi<GameBestLeaderboardResponse>('leaderboard.game', {
    gameId,
    limit,
  });
}
