import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-telegram-init-data',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;
const MAX_HISTORY_BATCH = 250;
const MAX_HISTORY_ROWS = 200;
const DUEL_COUNTDOWN_MS = 5_000;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'bad_request',
  ) {
    super(message);
  }
}

type AuthProvider = 'telegram' | 'google';

interface VerifiedIdentity {
  provider: AuthProvider;
  providerUserId: string;
  displayName: string;
  username: string | null;
  telegramId: number | null;
  authUser: SupabaseAuthUser | null;
}

interface AccountRow {
  id: string;
  provider: AuthProvider;
  provider_user_id: string;
  display_name: string;
  username: string | null;
  created_at: string;
  updated_at: string;
  history_generation: string;
  history_cleared_at: string;
}

interface GameAttemptInput {
  id: string;
  gameId: string;
  metric: string;
  value: number;
  meta?: Record<string, unknown>;
  playedAt: number;
}

interface DuelRow {
  id: string;
  host_user_id: string;
  guest_user_id: string | null;
  host_name: string;
  guest_name: string | null;
  status: 'waiting' | 'ready_check' | 'countdown' | 'finished' | 'expired' | 'cancelled';
  host_ready: boolean;
  guest_ready: boolean;
  countdown_start_at: string | null;
  host_time_ms: number | null;
  guest_time_ms: number | null;
  expires_at: string;
  finished_at: string | null;
  created_at: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(cleaned || fallback).slice(0, maxLength).join('');
}

function cleanUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('Noto‘g‘ri so‘rov.', 400, 'invalid_payload');
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new ApiError(`${field} noto‘g‘ri.`, 400, 'invalid_payload');
  }
  return value.trim();
}

function requireUuid(value: unknown, field: string): string {
  const result = requireString(value, field, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) {
    throw new ApiError(`${field} noto‘g‘ri.`, 400, 'invalid_payload');
  }
  return result;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function hmac(key: ArrayBuffer | string, value: string): Promise<ArrayBuffer> {
  const rawKey = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function verifyTelegramIdentity(initData: string, botToken: string): Promise<VerifiedIdentity> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const rawUser = params.get('user');

  if (!receivedHash || !Number.isFinite(authDate) || !rawUser) {
    throw new ApiError('Telegram ma’lumotlari to‘liq emas.', 401, 'telegram_auth_invalid');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new ApiError('Telegram sessiyasi eskirgan. Ilovani qayta oching.', 401, 'telegram_auth_expired');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash' && key !== 'signature')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmac('WebAppData', botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));
  if (!constantTimeEqual(calculatedHash, receivedHash.toLowerCase())) {
    throw new ApiError('Telegram imzosi tasdiqlanmadi.', 401, 'telegram_auth_invalid');
  }

  let user: Record<string, unknown>;
  try {
    user = requireObject(JSON.parse(rawUser));
  } catch {
    throw new ApiError('Telegram foydalanuvchisi aniqlanmadi.', 401, 'telegram_auth_invalid');
  }

  const telegramId = Number(user.id);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    throw new ApiError('Telegram foydalanuvchisi aniqlanmadi.', 401, 'telegram_auth_invalid');
  }

  return {
    provider: 'telegram',
    providerUserId: String(telegramId),
    displayName: cleanText(user.first_name, 'AqlBand', 64),
    username: cleanUsername(user.username),
    telegramId,
    authUser: null,
  };
}

async function verifyGoogleIdentity(
  authorization: string,
  serviceClient: SupabaseClient,
): Promise<VerifiedIdentity> {
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ApiError('Kirish talab qilinadi.', 401, 'auth_required');

  const { data, error } = await serviceClient.auth.getUser(token);
  if (error || !data.user) throw new ApiError('Google sessiyasi yaroqsiz.', 401, 'google_auth_invalid');

  const authUser = data.user;
  const provider = String(authUser.app_metadata?.provider ?? '');
  if (provider !== 'google') {
    throw new ApiError('Faqat Google akkaunt orqali kirish qo‘llab-quvvatlanadi.', 401, 'provider_not_supported');
  }

  const metadata = authUser.user_metadata ?? {};
  const rawGoogleName = metadata.given_name ?? metadata.name ?? metadata.full_name ?? authUser.email?.split('@')[0];
  const firstNameOnly = typeof rawGoogleName === 'string' ? rawGoogleName.trim().split(/\s+/)[0] : rawGoogleName;
  const displayName = cleanText(firstNameOnly, 'AqlBand', 64);

  return {
    provider: 'google',
    providerUserId: authUser.id,
    displayName,
    username: null,
    telegramId: null,
    authUser,
  };
}

async function authenticate(req: Request, serviceClient: SupabaseClient): Promise<VerifiedIdentity> {
  const telegramInitData = req.headers.get('x-telegram-init-data')?.trim();
  if (telegramInitData) {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new ApiError('Server sozlamasi yetishmayapti.', 500, 'server_config_missing');
    return verifyTelegramIdentity(telegramInitData, botToken);
  }

  const authorization = req.headers.get('authorization');
  if (authorization) return verifyGoogleIdentity(authorization, serviceClient);

  throw new ApiError('Kirish talab qilinadi.', 401, 'auth_required');
}

function publicAccount(row: AccountRow) {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.display_name,
    username: row.username,
    createdAt: new Date(row.created_at).getTime(),
    historyGeneration: row.history_generation,
    historyClearedAt: new Date(row.history_cleared_at).getTime(),
  };
}

async function getAccountOrThrow(serviceClient: SupabaseClient, identity: VerifiedIdentity): Promise<AccountRow> {
  const { data, error } = await serviceClient
    .from('users')
    .select('id,provider,provider_user_id,display_name,username,created_at,updated_at,history_generation,history_cleared_at')
    .eq('provider', identity.provider)
    .eq('provider_user_id', identity.providerUserId)
    .maybeSingle();

  if (error) throw new ApiError('Profilni yuklab bo‘lmadi.', 500, 'profile_load_failed');
  if (!data) throw new ApiError('Akkaunt topilmadi. Ilovani qayta oching.', 401, 'account_not_found');
  return data as AccountRow;
}

async function ensureAccount(serviceClient: SupabaseClient, identity: VerifiedIdentity): Promise<AccountRow> {
  const payload: Record<string, unknown> = {
    provider: identity.provider,
    provider_user_id: identity.providerUserId,
    display_name: identity.displayName,
    username: identity.username,
    updated_at: new Date().toISOString(),
  };


  if (identity.provider === 'telegram' && identity.username) {
    const { error: releaseError } = await serviceClient
      .from('users')
      .update({ username: null })
      .eq('provider', 'telegram')
      .ilike('username', identity.username)
      .neq('provider_user_id', identity.providerUserId);
    if (releaseError) throw new ApiError('Telegram username yangilanmadi.', 500, 'profile_save_failed');
  }

  const { data, error } = await serviceClient
    .from('users')
    .upsert(payload, { onConflict: 'provider,provider_user_id' })
    .select('id,provider,provider_user_id,display_name,username,created_at,updated_at,history_generation,history_cleared_at')
    .single();

  if (error) throw new ApiError('Profilni saqlab bo‘lmadi.', 500, 'profile_save_failed');
  return data as AccountRow;
}

function sanitizeMeta(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) continue;
    if (item === null || typeof item === 'string' || typeof item === 'boolean') {
      output[key] = typeof item === 'string' ? Array.from(item).slice(0, 100).join('') : item;
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      output[key] = Math.round(item * 1000) / 1000;
    }
  }

  return output;
}

function sanitizeAttempt(value: unknown): GameAttemptInput {
  const raw = requireObject(value);
  const id = requireString(raw.id, 'attempt id', 100);
  const gameId = requireString(raw.gameId, 'gameId', 40);
  const metric = requireString(raw.metric, 'metric', 40);
  const numericValue = Number(raw.value);
  const playedAt = Number(raw.playedAt);

  if (!Number.isFinite(numericValue) || !Number.isFinite(playedAt)) {
    throw new ApiError('O‘yin natijasi noto‘g‘ri.', 400, 'invalid_attempt');
  }

  const roundedValue = Math.round(numericValue);
  const now = Date.now();
  if (playedAt > now + 5 * 60_000 || playedAt < now - 365 * 24 * 60 * 60_000) {
    throw new ApiError('O‘yin sanasi noto‘g‘ri.', 400, 'invalid_attempt_date');
  }

  const valid =
    (gameId === 'reaction' && metric === 'duration_ms' && roundedValue >= 80 && roundedValue <= 5_000) ||
    (gameId === 'duel-reaction' && metric === 'duration_ms' && roundedValue >= 80 && roundedValue <= 5_000) ||
    (gameId === 'emoji-find' && metric === 'duration_ms' && roundedValue >= 100 && roundedValue <= 60_000) ||
    (gameId === 'number-memory' && metric === 'correct_count' && roundedValue >= 0 && roundedValue <= 5) ||
    (gameId === 'stroop-test' && metric === 'score' && roundedValue >= 0 && roundedValue <= 20_000);

  if (!valid) throw new ApiError('O‘yin natijasi ruxsat etilgan chegaradan tashqarida.', 400, 'invalid_attempt');

  const rawMeta = sanitizeMeta(raw.meta);
  const allowedMetaKeys: Record<string, string[]> = {
    reaction: ['mode'],
    'emoji-find': ['errors', 'rounds'],
    'number-memory': ['rounds', 'digits'],
    'stroop-test': ['correct', 'errors', 'timeouts', 'averageMs', 'rounds'],
    'duel-reaction': [],
  };
  const meta = Object.fromEntries(
    (allowedMetaKeys[gameId] ?? [])
      .filter((key) => Object.prototype.hasOwnProperty.call(rawMeta, key))
      .map((key) => [key, rawMeta[key]]),
  );

  if (gameId === 'reaction' && meta.mode !== 'solo') meta.mode = 'solo';

  return {
    id,
    gameId,
    metric,
    value: roundedValue,
    meta,
    playedAt: Math.round(playedAt),
  };
}

function mapHistoryRow(row: Record<string, unknown>) {
  return {
    id: String(row.client_attempt_id),
    gameId: String(row.game_id),
    metric: String(row.metric),
    value: Number(row.value),
    meta: (row.meta ?? {}) as Record<string, unknown>,
    playedAt: new Date(String(row.played_at)).getTime(),
  };
}

async function expireDuelIfNeeded(serviceClient: SupabaseClient, duel: DuelRow): Promise<DuelRow> {
  if (duel.status === 'finished' || duel.status === 'cancelled' || duel.status === 'expired') return duel;
  if (new Date(duel.expires_at).getTime() > Date.now()) return duel;

  const { data } = await serviceClient
    .from('duels')
    .update({ status: 'expired' })
    .eq('id', duel.id)
    .neq('status', 'finished')
    .select('*')
    .maybeSingle();

  return (data as DuelRow | null) ?? { ...duel, status: 'expired' };
}

async function getDuelOrThrow(serviceClient: SupabaseClient, duelId: string): Promise<DuelRow> {
  const { data, error } = await serviceClient.from('duels').select('*').eq('id', duelId).maybeSingle();
  if (error || !data) throw new ApiError('Duel topilmadi.', 404, 'duel_not_found');
  return expireDuelIfNeeded(serviceClient, data as DuelRow);
}

function resolveDuelRole(duel: DuelRow, accountId: string): 'host' | 'guest' {
  if (duel.host_user_id === accountId) return 'host';
  if (duel.guest_user_id === accountId) return 'guest';
  throw new ApiError('Bu duel sizga tegishli emas.', 403, 'duel_forbidden');
}

function duelSnapshot(duel: DuelRow) {
  return { duel, serverNow: Date.now() };
}

async function persistFinishedDuelHistory(serviceClient: SupabaseClient, duel: DuelRow): Promise<void> {
  if (
    duel.status !== 'finished' ||
    !duel.guest_user_id ||
    duel.host_time_ms === null ||
    duel.guest_time_ms === null
  ) {
    return;
  }

  const userIds = [duel.host_user_id, duel.guest_user_id];
  const { data: users, error: usersError } = await serviceClient
    .from('users')
    .select('id,history_generation')
    .in('id', userIds);
  if (usersError || !users || users.length !== 2) {
    throw new ApiError('Duel tarixini saqlab bo‘lmadi.', 500, 'duel_history_failed');
  }

  const generations = new Map(users.map((user) => [String(user.id), String(user.history_generation)]));
  const playedAt = duel.finished_at ?? new Date().toISOString();
  const draw = duel.host_time_ms === duel.guest_time_ms;
  const rows = [
    {
      user_id: duel.host_user_id,
      history_generation: generations.get(duel.host_user_id),
      client_attempt_id: `duel-${duel.id}-${duel.host_user_id}`,
      game_id: 'duel-reaction',
      metric: 'duration_ms',
      value: duel.host_time_ms,
      meta: {
        opponentTimeMs: duel.guest_time_ms,
        won: duel.host_time_ms < duel.guest_time_ms,
        draw,
        role: 'host',
      },
      played_at: playedAt,
    },
    {
      user_id: duel.guest_user_id,
      history_generation: generations.get(duel.guest_user_id),
      client_attempt_id: `duel-${duel.id}-${duel.guest_user_id}`,
      game_id: 'duel-reaction',
      metric: 'duration_ms',
      value: duel.guest_time_ms,
      meta: {
        opponentTimeMs: duel.host_time_ms,
        won: duel.guest_time_ms < duel.host_time_ms,
        draw,
        role: 'guest',
      },
      played_at: playedAt,
    },
  ];

  const { error } = await serviceClient
    .from('game_attempts')
    .upsert(rows, { onConflict: 'user_id,client_attempt_id' });
  if (error) throw new ApiError('Duel tarixini saqlab bo‘lmadi.', 500, 'duel_history_failed');
}

async function handleAction(
  action: string,
  payload: Record<string, unknown>,
  identity: VerifiedIdentity,
  account: AccountRow,
  serviceClient: SupabaseClient,
): Promise<unknown> {
  switch (action) {
    case 'profile.ensure':
      return publicAccount(account);

    case 'progression.get': {
      const { data, error } = await serviceClient.rpc('get_progression', { p_user_id: account.id });
      if (error) throw new ApiError('XP ma’lumotini yuklab bo‘lmadi.', 500, 'progression_load_failed');

      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      if (!row) throw new ApiError('XP ma’lumoti topilmadi.', 404, 'progression_not_found');

      return {
        totalXp: Number(row.total_xp ?? 0),
        level: Number(row.level ?? 1),
        currentLevelXp: Number(row.current_level_xp ?? 0),
        nextLevelXp: Number(row.next_level_xp ?? 100),
        todayXp: Number(row.today_xp ?? 0),
        totalRewardedGames: Number(row.total_rewarded_games ?? 0),
        rank: Number(row.xp_rank ?? 1),
      };
    }

    case 'profile.delete': {
      if (identity.provider === 'google' && identity.authUser) {
        const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(identity.authUser.id);
        if (authDeleteError) {
          throw new ApiError('Google akkauntini o‘chirib bo‘lmadi.', 500, 'auth_delete_failed');
        }
        // The auth.users trigger deletes public.users and all related rows.
        const { data: remaining } = await serviceClient.from('users').select('id').eq('id', account.id).maybeSingle();
        if (remaining) {
          const { error: fallbackError } = await serviceClient.from('users').delete().eq('id', account.id);
          if (fallbackError) throw new ApiError('Akkaunt ma’lumotlarini o‘chirib bo‘lmadi.', 500, 'account_delete_failed');
        }
      } else {
        const { error } = await serviceClient.from('users').delete().eq('id', account.id);
        if (error) throw new ApiError('Akkauntni o‘chirib bo‘lmadi.', 500, 'account_delete_failed');
      }
      return { deleted: true };
    }

    case 'history.sync': {
      const rawAttempts = payload.attempts;
      if (!Array.isArray(rawAttempts) || rawAttempts.length > MAX_HISTORY_BATCH) {
        throw new ApiError('Tarix hajmi noto‘g‘ri.', 400, 'invalid_history_batch');
      }

      const clientGeneration = requireString(payload.historyGeneration, 'historyGeneration', 64);
      const generationMatches = clientGeneration === account.history_generation;
      const attempts = generationMatches
        ? rawAttempts.map(sanitizeAttempt).filter((attempt) => attempt.gameId !== 'duel-reaction')
        : [];
      const attemptIds = attempts.map((attempt) => attempt.id);
      let existingIds = new Set<string>();
      if (attemptIds.length > 0) {
        const { data: existing, error: existingError } = await serviceClient
          .from('game_attempts')
          .select('client_attempt_id')
          .eq('user_id', account.id)
          .eq('history_generation', account.history_generation)
          .in('client_attempt_id', attemptIds);
        if (existingError) throw new ApiError('O‘yin tarixini tekshirib bo‘lmadi.', 500, 'history_sync_failed');
        existingIds = new Set((existing ?? []).map((row) => String(row.client_attempt_id)));
      }

      const newAttemptCount = attempts.reduce((count, attempt) => count + (existingIds.has(attempt.id) ? 0 : 1), 0);
      const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { count } = await serviceClient
        .from('game_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', account.id)
        .eq('history_generation', account.history_generation)
        .gte('created_at', oneHourAgo);
      if ((count ?? 0) + newAttemptCount > 300) {
        throw new ApiError('Juda ko‘p natija yuborildi. Biroz kuting.', 429, 'rate_limited');
      }

      if (attempts.length > 0) {
        const rows = attempts.map((attempt) => ({
          user_id: account.id,
          history_generation: account.history_generation,
          client_attempt_id: attempt.id,
          game_id: attempt.gameId,
          metric: attempt.metric,
          value: attempt.value,
          meta: attempt.meta ?? {},
          played_at: new Date(attempt.playedAt).toISOString(),
        }));

        const { error } = await serviceClient
          .from('game_attempts')
          .upsert(rows, { onConflict: 'user_id,client_attempt_id', ignoreDuplicates: true });
        if (error) throw new ApiError('O‘yin tarixini sinxronlab bo‘lmadi.', 500, 'history_sync_failed');
      }

      const { data, error } = await serviceClient
        .from('game_attempts')
        .select('client_attempt_id,game_id,metric,value,meta,played_at')
        .eq('user_id', account.id)
        .eq('history_generation', account.history_generation)
        .order('played_at', { ascending: false })
        .limit(MAX_HISTORY_ROWS);
      if (error) throw new ApiError('O‘yin tarixini yuklab bo‘lmadi.', 500, 'history_load_failed');
      return {
        attempts: (data ?? []).map((row) => mapHistoryRow(row as Record<string, unknown>)),
        historyGeneration: account.history_generation,
        historyClearedAt: new Date(account.history_cleared_at).getTime(),
      };
    }

    case 'history.clear': {
      const nextGeneration = crypto.randomUUID();
      const clearedAt = new Date().toISOString();
      const { error: generationError } = await serviceClient
        .from('users')
        .update({ history_generation: nextGeneration, history_cleared_at: clearedAt })
        .eq('id', account.id);
      if (generationError) throw new ApiError('Tarix holatini yangilab bo‘lmadi.', 500, 'history_clear_failed');

      // Old in-flight syncs retain the previous generation and are ignored by
      // history/leaderboard reads even if they finish after this delete.
      const { error } = await serviceClient.from('game_attempts').delete().eq('user_id', account.id);
      if (error) throw new ApiError('O‘yin tarixini o‘chirib bo‘lmadi.', 500, 'history_clear_failed');
      return { cleared: true, historyGeneration: nextGeneration, historyClearedAt: new Date(clearedAt).getTime() };
    }

    case 'leaderboard.list': {
      const period = ['global', 'weekly', 'monthly', 'friends'].includes(String(payload.period))
        ? String(payload.period)
        : 'global';
      const limit = Math.min(100, Math.max(1, Math.round(Number(payload.limit) || 100)));
      let userIds: string[] | null = null;

      if (period === 'friends') {
        const { data, error } = await serviceClient
          .from('friendships')
          .select('requester_id,addressee_id')
          .eq('status', 'accepted')
          .or(`requester_id.eq.${account.id},addressee_id.eq.${account.id}`);
        if (error) throw new ApiError('Do‘stlar reytingini yuklab bo‘lmadi.', 500, 'leaderboard_failed');

        const ids = new Set<string>([account.id]);
        for (const row of data ?? []) {
          ids.add(row.requester_id === account.id ? row.addressee_id : row.requester_id);
        }
        userIds = [...ids];
      }

      const rpcPeriod = period === 'friends' ? 'global' : period;
      const { data, error } = await serviceClient.rpc('get_reaction_leaderboard', {
        p_period: rpcPeriod,
        p_limit: limit,
        p_user_ids: userIds,
      });
      if (error) throw new ApiError('Reytingni yuklab bo‘lmadi.', 500, 'leaderboard_failed');

      return {
        rows: (data ?? []).map((row: Record<string, unknown>) => ({
          userId: String(row.user_id),
          displayName: String(row.display_name),
          username: row.username ? String(row.username) : null,
          score: Number(row.score),
          playedAt: String(row.played_at),
          rank: Number(row.rank),
        })),
      };
    }

    case 'leaderboard.rank': {
      const { data, error } = await serviceClient.rpc('get_reaction_rank', { p_user_id: account.id });
      if (error) throw new ApiError('Reyting o‘rnini aniqlab bo‘lmadi.', 500, 'rank_failed');
      return { rank: data === null ? null : Number(data) };
    }

    case 'friend.search': {
      const username = cleanUsername(payload.username);
      if (!username) throw new ApiError('Telegram username noto‘g‘ri.', 400, 'invalid_username');

      const { data, error } = await serviceClient
        .from('users')
        .select('id,display_name,username')
        .ilike('username', username)
        .neq('id', account.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new ApiError('Foydalanuvchini qidirib bo‘lmadi.', 500, 'user_search_failed');
      return {
        user: data
          ? { id: data.id, displayName: data.display_name, username: data.username }
          : null,
      };
    }

    case 'friend.list': {
      const { data, error } = await serviceClient
        .from('friendships')
        .select('id,requester_id,addressee_id,status,created_at,responded_at')
        .or(`requester_id.eq.${account.id},addressee_id.eq.${account.id}`)
        .order('created_at', { ascending: false });
      if (error) throw new ApiError('Do‘stlar ro‘yxatini yuklab bo‘lmadi.', 500, 'friends_load_failed');

      const otherIds = [...new Set((data ?? []).map((row) => (row.requester_id === account.id ? row.addressee_id : row.requester_id)))];
      const usersById = new Map<string, { id: string; display_name: string; username: string | null }>();

      if (otherIds.length > 0) {
        const { data: users, error: usersError } = await serviceClient
          .from('users')
          .select('id,display_name,username')
          .in('id', otherIds);
        if (usersError) throw new ApiError('Do‘stlar profilini yuklab bo‘lmadi.', 500, 'friends_load_failed');
        for (const user of users ?? []) usersById.set(user.id, user);
      }

      return {
        entries: (data ?? []).flatMap((row) => {
          const isOutgoing = row.requester_id === account.id;
          const other = usersById.get(isOutgoing ? row.addressee_id : row.requester_id);
          if (!other) return [];
          return [{
            friendshipId: row.id,
            status: row.status,
            isOutgoing,
            user: { id: other.id, displayName: other.display_name, username: other.username },
            createdAt: row.created_at,
          }];
        }),
      };
    }

    case 'friend.request': {
      const targetUserId = requireUuid(payload.targetUserId, 'targetUserId');
      if (targetUserId === account.id) throw new ApiError('O‘zingizga so‘rov yubora olmaysiz.', 400, 'self_friendship');

      const { data: target } = await serviceClient.from('users').select('id').eq('id', targetUserId).maybeSingle();
      if (!target) throw new ApiError('Foydalanuvchi topilmadi.', 404, 'user_not_found');

      const { data: existing, error: existingError } = await serviceClient
        .from('friendships')
        .select('id,status')
        .or(
          `and(requester_id.eq.${account.id},addressee_id.eq.${targetUserId}),` +
          `and(requester_id.eq.${targetUserId},addressee_id.eq.${account.id})`,
        )
        .limit(1)
        .maybeSingle();
      if (existingError) throw new ApiError('Do‘stlik holatini tekshirib bo‘lmadi.', 500, 'friend_request_failed');
      if (existing) {
        throw new ApiError(
          existing.status === 'accepted' ? 'Siz allaqachon do‘stsiz.' : 'So‘rov allaqachon mavjud.',
          409,
          'friendship_exists',
        );
      }

      const { error } = await serviceClient.from('friendships').insert({
        requester_id: account.id,
        addressee_id: targetUserId,
        status: 'pending',
      });
      if (error) throw new ApiError('Do‘stlik so‘rovini yuborib bo‘lmadi.', 500, 'friend_request_failed');
      return { sent: true };
    }

    case 'friend.accept': {
      const friendshipId = requireUuid(payload.friendshipId, 'friendshipId');
      const { data, error } = await serviceClient
        .from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('addressee_id', account.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (error || !data) throw new ApiError('So‘rovni qabul qilib bo‘lmadi.', 403, 'friend_accept_failed');
      return { accepted: true };
    }

    case 'friend.remove': {
      const friendshipId = requireUuid(payload.friendshipId, 'friendshipId');
      const { data, error } = await serviceClient
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .or(`requester_id.eq.${account.id},addressee_id.eq.${account.id}`)
        .select('id')
        .maybeSingle();
      if (error || !data) throw new ApiError('Do‘stlikni o‘chirib bo‘lmadi.', 403, 'friend_remove_failed');
      return { removed: true };
    }

    case 'duel.create': {
      const { data, error } = await serviceClient
        .from('duels')
        .insert({
          host_user_id: account.id,
          host_name: account.display_name,
          expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        })
        .select('*')
        .single();
      if (error) throw new ApiError('Duel yaratib bo‘lmadi.', 500, 'duel_create_failed');
      return duelSnapshot(data as DuelRow);
    }

    case 'duel.get': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const duel = await getDuelOrThrow(serviceClient, duelId);
      const isParticipant = duel.host_user_id === account.id || duel.guest_user_id === account.id;
      const canJoin = duel.status === 'waiting' && duel.guest_user_id === null;
      if (!isParticipant && !canJoin) {
        throw new ApiError('Bu duelga kirish mumkin emas.', 403, 'duel_forbidden');
      }
      return duelSnapshot(duel);
    }

    case 'duel.join': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'expired') throw new ApiError('Duel havolasi eskirgan.', 410, 'duel_expired');
      if (duel.host_user_id === account.id || duel.guest_user_id === account.id) return duelSnapshot(duel);
      if (duel.guest_user_id) throw new ApiError('Duelga boshqa o‘yinchi qo‘shilgan.', 409, 'duel_full');
      if (duel.status !== 'waiting') throw new ApiError('Duelga qo‘shilish vaqti tugagan.', 409, 'duel_not_joinable');

      const { data, error } = await serviceClient
        .from('duels')
        .update({
          guest_user_id: account.id,
          guest_name: account.display_name,
          status: 'ready_check',
        })
        .eq('id', duelId)
        .eq('status', 'waiting')
        .is('guest_user_id', null)
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError('Duelga qo‘shilib bo‘lmadi.', 500, 'duel_join_failed');
      duel = (data as DuelRow | null) ?? (await getDuelOrThrow(serviceClient, duelId));
      if (duel.host_user_id !== account.id && duel.guest_user_id !== account.id) {
        throw new ApiError('Duelga boshqa o‘yinchi qo‘shildi.', 409, 'duel_full');
      }
      return duelSnapshot(duel);
    }

    case 'duel.ready': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'expired') throw new ApiError('Duel havolasi eskirgan.', 410, 'duel_expired');
      const role = resolveDuelRole(duel, account.id);
      if (duel.status !== 'ready_check') return duelSnapshot(duel);

      const readyField = role === 'host' ? 'host_ready' : 'guest_ready';
      const { error } = await serviceClient.from('duels').update({ [readyField]: true }).eq('id', duelId);
      if (error) throw new ApiError('Tayyorlik holatini saqlab bo‘lmadi.', 500, 'duel_ready_failed');

      duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'ready_check' && duel.host_ready && duel.guest_ready) {
        const { data } = await serviceClient
          .from('duels')
          .update({ status: 'countdown', countdown_start_at: new Date().toISOString() })
          .eq('id', duelId)
          .eq('status', 'ready_check')
          .eq('host_ready', true)
          .eq('guest_ready', true)
          .select('*')
          .maybeSingle();
        duel = (data as DuelRow | null) ?? (await getDuelOrThrow(serviceClient, duelId));
      }
      return duelSnapshot(duel);
    }

    case 'duel.submit': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const timeMs = Math.round(Number(payload.timeMs));
      if (!Number.isFinite(timeMs) || timeMs < 80 || timeMs > 5_000) {
        throw new ApiError('Reaksiya vaqti noto‘g‘ri.', 400, 'invalid_duel_time');
      }

      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'expired') throw new ApiError('Duel havolasi eskirgan.', 410, 'duel_expired');
      const role = resolveDuelRole(duel, account.id);
      if (duel.status !== 'countdown' || !duel.countdown_start_at) {
        throw new ApiError('Duel hali boshlanmagan.', 409, 'duel_not_started');
      }

      const goAt = new Date(duel.countdown_start_at).getTime() + DUEL_COUNTDOWN_MS;
      if (Date.now() < goAt - 100) throw new ApiError('Signal chiqishidan oldin bosildi.', 409, 'duel_false_start');

      const timeField = role === 'host' ? 'host_time_ms' : 'guest_time_ms';
      const { error } = await serviceClient
        .from('duels')
        .update({ [timeField]: timeMs })
        .eq('id', duelId)
        .is(timeField, null);
      if (error) throw new ApiError('Duel natijasini saqlab bo‘lmadi.', 500, 'duel_submit_failed');

      duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.host_time_ms !== null && duel.guest_time_ms !== null && duel.status !== 'finished') {
        const { data } = await serviceClient
          .from('duels')
          .update({ status: 'finished', finished_at: new Date().toISOString() })
          .eq('id', duelId)
          .not('host_time_ms', 'is', null)
          .not('guest_time_ms', 'is', null)
          .select('*')
          .maybeSingle();
        duel = (data as DuelRow | null) ?? (await getDuelOrThrow(serviceClient, duelId));
      }
      await persistFinishedDuelHistory(serviceClient, duel);
      return duelSnapshot(duel);
    }

    default:
      throw new ApiError('Noma’lum amal.', 404, 'unknown_action');
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: { code: 'method_not_allowed', message: 'Use POST' } }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new ApiError('Server sozlamasi yetishmayapti.', 500, 'server_config_missing');

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = requireObject(await req.json());
    const action = requireString(body.action, 'action', 80);
    const payload = body.payload === undefined ? {} : requireObject(body.payload);
    const identity = await authenticate(req, serviceClient);
    // Only the explicit profile bootstrap may create an account. Every other
    // action requires an existing row, so an in-flight request cannot recreate
    // an account after the user deletes it.
    const account = action === 'profile.ensure'
      ? await ensureAccount(serviceClient, identity)
      : await getAccountOrThrow(serviceClient, identity);
    const data = await handleAction(action, payload, identity, account, serviceClient);

    return json({ ok: true, data });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError('Serverda kutilmagan xato yuz berdi.', 500, 'internal_error');
    if (!(error instanceof ApiError)) console.error(error);
    return json({ ok: false, error: { code: apiError.code, message: apiError.message } }, apiError.status);
  }
});
