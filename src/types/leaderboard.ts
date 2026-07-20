/** Row shape of `public.leaderboard`, exactly as stored in Supabase. */
export interface LeaderboardRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  /** Reaction time in milliseconds. Lower is better. */
  score: number;
  created_at: string;
}

/** Payload accepted by saveScore() — everything the DB fills in itself is omitted. */
export interface SaveScoreInput {
  telegramId: number;
  username: string | null;
  firstName: string;
  /** Reaction time in milliseconds. */
  score: number;
}
