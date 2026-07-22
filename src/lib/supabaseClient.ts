import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = rawUrl as string | undefined;
export const supabaseAnonKey = rawAnonKey as string | undefined;

export const isSupabaseConfigured = Boolean(rawUrl && rawAnonKey);

if (!isSupabaseConfigured && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.warn(
    'Supabase env vars are missing. Online features are disabled until VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY are configured.',
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? (rawUrl as string) : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? (rawAnonKey as string) : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
