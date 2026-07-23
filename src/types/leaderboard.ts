/** Raw provider-neutral XP row returned by the secure Edge Function. */
export interface LeaderboardApiRow {
  userId: string;
  displayName: string;
  username: string | null;
  /** XP earned in the selected period. Global/Friends use total XP. */
  xp: number;
  /** Lifetime XP, used to derive Bronze/Silver/Gold/Crystal/Champion/Legend rank. */
  totalXp: number;
  /**
   * Deprecated numeric level retained only for backward API compatibility.
   * UI rank must be derived from totalXp via features/progression/ranks.ts.
   */
  level: number;
  rank: number;
}

/**
 * UI row. Legacy aliases remain temporarily so old screens and services
 * continue compiling while the ranking itself is fully XP-based.
 */
export interface LeaderboardRow extends LeaderboardApiRow {
  id: string;
  telegram_id: number;
  first_name: string;
  created_at: string;
  /** Legacy alias. It now mirrors XP, not reaction milliseconds. */
  score: number;
}

export interface SaveScoreInput {
  telegramId: number;
  username: string | null;
  firstName: string;
  score: number;
}
