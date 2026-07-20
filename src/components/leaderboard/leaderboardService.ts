import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { LeaderboardRow, SaveScoreInput } from '@/types/leaderboard';

const TABLE = 'leaderboard';

/**
 * Inserts a single reaction-time result. Every attempt is stored as its own
 * row (append-only) — "personal best" is derived by querying, never stored
 * as a separate mutable field, so it can never drift out of sync.
 *
 * Fire-and-forget by design from the caller's side: network/Supabase issues
 * must never break the local game, so this only throws for the caller to
 * optionally log — it does not need to be awaited to keep the UI responsive.
 */
export async function saveScore(input: SaveScoreInput): Promise<LeaderboardRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      telegram_id: input.telegramId,
      username: input.username,
      first_name: input.firstName,
      score: Math.round(input.score),
    })
    .select()
    .single();

  if (error) throw new Error(`saveScore failed: ${error.message}`);
  return data as LeaderboardRow;
}

/** This player's single best (lowest) reaction time ever recorded online, or null if none. */
export async function getBestScore(telegramId: number): Promise<LeaderboardRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('telegram_id', telegramId)
    .order('score', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getBestScore failed: ${error.message}`);
  return (data as LeaderboardRow) ?? null;
}

/** This player's most recent N attempts, newest first. */
export async function getRecentScores(telegramId: number, limit = 20): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentScores failed: ${error.message}`);
  return (data as LeaderboardRow[]) ?? [];
}

/**
 * Deduplicates a score list to one (best) row per player, preserving the
 * fastest-first order. Shared by every leaderboard query below so "Top N"
 * never lists the same player twice just because they hold several of the
 * fastest individual attempts.
 */
function dedupeBestPerPlayer(rows: LeaderboardRow[], limit: number): LeaderboardRow[] {
  const seen = new Set<number>();
  const best: LeaderboardRow[] = [];
  for (const row of rows) {
    if (seen.has(row.telegram_id)) continue;
    seen.add(row.telegram_id);
    best.push(row);
    if (best.length >= limit) break;
  }
  return best;
}

/**
 * Top N players by best (lowest) all-time reaction time, one row per
 * player. Implemented client-side via a windowed query since a plain
 * `.order('score').limit(n)` on the raw table would return the same player
 * multiple times if they hold several of the fastest rows. Fine at the
 * current scale; swap for a `distinct on` view or RPC if the table grows large.
 */
export async function getGlobalLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('score', { ascending: true })
    .limit(limit * 20);

  if (error) throw new Error(`getGlobalLeaderboard failed: ${error.message}`);
  return dedupeBestPerPlayer((data as LeaderboardRow[]) ?? [], limit);
}

/** @deprecated kept for backward compatibility — use getGlobalLeaderboard(). */
export const getTop10Leaderboard = (limit = 10) => getGlobalLeaderboard(limit);

function startOfWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7; // days since most recent Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString();
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Each player's best time among attempts made since the given ISO timestamp. */
async function getLeaderboardSince(sinceIso: string, limit: number): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('created_at', sinceIso)
    .order('score', { ascending: true })
    .limit(limit * 20);

  if (error) throw new Error(`getLeaderboardSince failed: ${error.message}`);
  return dedupeBestPerPlayer((data as LeaderboardRow[]) ?? [], limit);
}

/** Leaderboard of best times among attempts made since this ISO-week's Monday 00:00 UTC. */
export function getWeeklyLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  return getLeaderboardSince(startOfWeek(), limit);
}

/** Leaderboard of best times among attempts made since the 1st of the current calendar month (UTC). */
export function getMonthlyLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  return getLeaderboardSince(startOfMonth(), limit);
}

/**
 * This player's current global rank (1 = fastest), based on each player's
 * all-time best. Returns null if the player has no recorded score yet.
 *
 * Note: this fetches the full best-per-player ordering client-side, same
 * approach as getGlobalLeaderboard. Acceptable at hundreds/low-thousands of
 * players; replace with a Postgres RPC (`rank() over (...)`) if the player
 * base grows much larger than that.
 */
export async function getUserRank(telegramId: number): Promise<number | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.from(TABLE).select('*').order('score', { ascending: true });

  if (error) throw new Error(`getUserRank failed: ${error.message}`);

  const ranked = dedupeBestPerPlayer((data as LeaderboardRow[]) ?? [], Number.MAX_SAFE_INTEGER);
  const index = ranked.findIndex((row) => row.telegram_id === telegramId);
  return index === -1 ? null : index + 1;
}
