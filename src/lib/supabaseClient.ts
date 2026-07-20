import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at boot rather than silently no-op-ing every query later —
  // a missing env var should never look like "the leaderboard is just empty".
  console.error(
    'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'in .env (local) or in Cloudflare Pages -> Settings -> Environment variables (production).',
  );
}

/**
 * Shared Supabase client. Uses the public "anon" key only — safe to ship in
 * client code. Table access is governed entirely by the RLS policies
 * defined in supabase/migrations/0001_create_leaderboard.sql.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: false, // no Supabase Auth in use — Telegram is the identity source
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
