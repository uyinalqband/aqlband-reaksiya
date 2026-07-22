export interface LeaderboardRow {
  userId: string;
  displayName: string;
  username: string | null;
  /** Reaction time in milliseconds. Lower is better. */
  score: number;
  playedAt: string;
  rank: number;
}
