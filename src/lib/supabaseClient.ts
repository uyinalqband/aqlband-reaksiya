import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🔍 Diagnostika
console.log('SUPABASE URL:', rawUrl);
console.log('SUPABASE KEY:', rawAnonKey ? 'BOR' : "YO'Q");

export const isSupabaseConfigured = Boolean(rawUrl && rawAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'in .env (local dev) or in Cloudflare Pages -> Settings -> Environment variables (production), ' +
      'then redeploy. All online features (leaderboard, friends, score sync) are disabled until then — ' +
      'the offline game itself is unaffected.',
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? (rawUrl as string) : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? (rawAnonKey as string) : 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
    },
  },
);
