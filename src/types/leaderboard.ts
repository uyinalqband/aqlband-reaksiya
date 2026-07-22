/** Raw provider-neutral row returned by the secure Edge Function. */
export interface LeaderboardApiRow {
  userId: string;
  displayName: string;
  username: string | null;
  /** Reaction time in milliseconds. Lower is better. */
  score: number;
  playedAt: string;
  rank: number;
}

/**
 * UI row. New provider-neutral fields and old aliases coexist so existing
 * screens keep working without exposing another user's Telegram/Google ID.
 */
export interface LeaderboardRow extends LeaderboardApiRow {
  id: string;
  telegram_id: number;
  first_name: string;
  created_at: string;
}

export interface SaveScoreInput {
  telegramId: number;
  username: string | null;
  firstName: string;
  score: number;
}
