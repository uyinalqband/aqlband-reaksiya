// supabase/functions/init-db/index.ts
//
// Purpose: create the `leaderboard` table (and its indexes/policies) at
// runtime, without ever opening the Supabase SQL Editor.
//
// WHY THIS NEEDS A DIRECT POSTGRES CONNECTION, NOT supabase-js:
// PostgREST (what supabase-js talks to, even with the service_role key)
// only exposes CRUD on tables that already exist — it has no endpoint for
// DDL (CREATE TABLE, CREATE INDEX, etc). The only way to run DDL
// programmatically is a direct Postgres connection, which is what this
// function does using the `postgres` driver.
//
// SECURITY: DB_URL below must be the Postgres *connection string* (Settings
// -> Database -> Connection string -> "URI", using the service_role /
// postgres user), stored ONLY as an Edge Function secret. It must NEVER be
// put in client-side code or a VITE_ prefixed env var.
//
// Deploy (one time):
//   npx supabase functions deploy init-db
//   npx supabase secrets set DB_URL="postgres://postgres:[PASSWORD]@[HOST]:5432/postgres"
//
// Run (one time, or as many times as you want — fully idempotent):
//   curl -X POST https://<project-ref>.supabase.co/functions/v1/init-db \
//     -H "Authorization: Bearer <anon-or-service-role-key>"

import postgres from 'npm:postgres@3.4.4';

const DDL = `
  create extension if not exists pgcrypto;

  create table if not exists public.leaderboard (
    id uuid primary key default gen_random_uuid(),
    telegram_id bigint not null,
    username text,
    first_name text not null,
    score integer not null check (score > 0 and score < 5000),
    created_at timestamp with time zone not null default now()
  );

  create index if not exists idx_leaderboard_score
    on public.leaderboard (score asc);

  create index if not exists idx_leaderboard_telegram_id
    on public.leaderboard (telegram_id);

  alter table public.leaderboard enable row level security;

  drop policy if exists "leaderboard is publicly readable" on public.leaderboard;
  create policy "leaderboard is publicly readable"
    on public.leaderboard for select
    using (true);

  drop policy if exists "anyone can insert a score" on public.leaderboard;
  create policy "anyone can insert a score"
    on public.leaderboard for insert
    with check (true);
`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbUrl = Deno.env.get('DB_URL');
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: 'DB_URL secret is not set. Run: supabase secrets set DB_URL="..."' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sql = postgres(dbUrl, { max: 1 });

  try {
    await sql.unsafe(DDL);
    await sql.end({ timeout: 5 });
    return new Response(JSON.stringify({ ok: true, message: 'leaderboard table is ready' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    await sql.end({ timeout: 5 });
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
