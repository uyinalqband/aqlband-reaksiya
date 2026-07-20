import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { UserRow } from '@/types/user';

const TABLE = 'users';

export interface EnsureUserInput {
  telegramId: number;
  username: string | null;
  firstName: string;
}

/**
 * Upserts the current Telegram user into `public.users`, keyed on
 * `telegram_id`. Called once per app launch (see hooks/useEnsureUser.ts in
 * the next step) so the users table always reflects each player's latest
 * known username/first_name — required for friend search to find them.
 */
export async function ensureUser(input: EnsureUserInput): Promise<UserRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        telegram_id: input.telegramId,
        username: input.username,
        first_name: input.firstName,
      },
      { onConflict: 'telegram_id' },
    )
    .select()
    .single();

  if (error) throw new Error(`ensureUser failed: ${error.message}`);
  return data as UserRow;
}

/**
 * Finds a user by their Telegram @username (case-insensitive, leading "@"
 * optional). Only matches players who have opened the Mini App at least
 * once — there is no way to search Telegram's own user directory from here.
 */
export async function searchUserByUsername(rawUsername: string): Promise<UserRow | null> {
  if (!isSupabaseConfigured) return null;

  const username = rawUsername.trim().replace(/^@/, '');
  if (!username) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`searchUserByUsername failed: ${error.message}`);
  return (data as UserRow) ?? null;
}

export async function getUserByTelegramId(telegramId: number): Promise<UserRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.from(TABLE).select('*').eq('telegram_id', telegramId).maybeSingle();

  if (error) throw new Error(`getUserByTelegramId failed: ${error.message}`);
  return (data as UserRow) ?? null;
}
