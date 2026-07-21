import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(rawUrl && rawAnonKey);

if (!isSupabaseConfigured) {
  // Fails loudly (in the console) rather than silently no-op-ing every
  // query later — a missing env var should never look like "the
  // leaderboard is just empty" with no explanation.
  console.error(
    'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'in .env (local dev) or in Cloudflare Pages -> Settings -> Environment variables (production), ' +
      'then redeploy. All online features (leaderboard, friends, score sync) are disabled until then — ' +
      'the offline game itself is unaffected.',
  );
}

/**
 * Shared Supabase client. Uses the public "anon" key only — safe to ship in
 * client code. Table access is governed entirely by the RLS policies
 * defined in supabase/migrations/*.sql.
 *
 * IMPORTANT: `createClient` throws synchronously ("supabaseUrl is
 * required.") if given an empty string — and since this runs at module
 * load time (not inside a function), that throw happens before React even
 * mounts, crashing the entire app with a blank screen. To guarantee this
 * can never happen, we always pass a syntactically valid placeholder URL
 * when the real env vars are missing. Every function in services/ already
 * checks `isSupabaseConfigured` before making a real request, so this
 * placeholder client is simply never used for actual network calls.
 */
export const supabase = createClient(
  isSupabaseConfigured ? (rawUrl as string) : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? (rawAnonKey as string) : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false, // no Supabase Auth in use — Telegram is the identity source
    },
  },
);
