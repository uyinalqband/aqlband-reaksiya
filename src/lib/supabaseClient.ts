import { createClient } from '@supabase/supabase-js';

/**
 * Public project URL fallback for the Telegram Mini App.
 * The URL is not a secret. Cloudflare VITE_* values override this fallback.
 */
const FALLBACK_SUPABASE_URL = 'https://idocmxdydrwsizametwg.supabase.co';

function cleanEnv(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

const configuredUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const configuredAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabaseUrl = configuredUrl || FALLBACK_SUPABASE_URL;
export const supabaseAnonKey = configuredAnonKey || undefined;

/** Telegram API calls only need the project URL because the Edge Function
 * verifies Telegram initData itself. Google sign-in still requires the real
 * publishable/anon key in VITE_SUPABASE_ANON_KEY.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl);
export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey ?? 'telegram-only-public-client',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
