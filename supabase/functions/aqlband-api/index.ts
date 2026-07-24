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
  status: 'waiting' | 'invited' | 'ready_check' | 'countdown' | 'playing' | 'finished' | 'expired' | 'cancelled';
  host_ready: boolean;
  guest_ready: boolean;
  countdown_start_at: string | null;
  game_start_at: string | null;
  ready_deadline_at: string | null;
  host_time_ms: number | null;
  guest_time_ms: number | null;
  game_id: 'reaction' | 'emoji-find' | 'number-memory' | 'stroop-test' | 'ascending-numbers' | 'odd-one-out' | 'pattern-memory' | 'go-no-go' | 'mental-math' | 'sequence-memory' | 'card-memory' | 'time-estimation' | 'peripheral-vision' | 'twenty-four' | 'dual-n-back' | 'fifteen-puzzle' | 'sudoku' | 'tic-tac-toe' | 'checkers';
  round_count: number;
  survival: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'very-hard' | 'progressive';
  game_config: Record<string, unknown> | null;
  expires_at: string;
  finished_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  tic_tac_toe_board: string | null;
  tic_tac_toe_turn: 'host' | 'guest' | null;
  tic_tac_toe_winner: 'host' | 'guest' | 'draw' | null;
  tic_tac_toe_moves: number | null;
  tic_tac_toe_last_move_at: string | null;
  checkers_board: string | null;
  checkers_turn: 'host' | 'guest' | null;
  checkers_winner: 'host' | 'guest' | 'draw' | null;
  checkers_result_reason: string | null;
  checkers_moves: number | null;
  checkers_host_captures: number | null;
  checkers_guest_captures: number | null;
  checkers_host_promotions: number | null;
  checkers_guest_promotions: number | null;
  checkers_forced_from: number | null;
  checkers_turn_deadline_at: string | null;
  checkers_last_move_at: string | null;
  checkers_draw_offer_by: 'host' | 'guest' | null;
  checkers_draw_offer_at: string | null;
  checkers_host_draw_offers: number | null;
  checkers_guest_draw_offers: number | null;
  checkers_no_progress_moves: number | null;
  checkers_position_history: Record<string, number> | null;
  checkers_mode: 'friendly' | 'rated';
  checkers_host_rating_before: number | null;
  checkers_guest_rating_before: number | null;
  checkers_host_rating_after: number | null;
  checkers_guest_rating_after: number | null;
  checkers_host_rating_delta: number | null;
  checkers_guest_rating_delta: number | null;
  checkers_rating_processed_at: string | null;
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
    .filter(([key]) => key !== 'hash')
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
    if (item === null) {
      output[key] = null;
    } else if (typeof item === 'string') {
      output[key] = Array.from(item).slice(0, 100).join('');
    } else if (typeof item === 'boolean') {
      output[key] = item;
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

  const durationGameIds = new Set([
    'reaction', 'emoji-find', 'number-memory', 'stroop-test',
    'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
    'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
    'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku',
  ]);
  const durationMax = gameId === 'reaction'
    ? 10_000
    : gameId === 'sudoku'
      ? 1_800_000
      : 300_000;
  const valid =
    (durationGameIds.has(gameId) && metric === 'duration_ms' && roundedValue >= 1 && roundedValue <= durationMax) ||
    (gameId === 'duel-reaction' && metric === 'duration_ms' && roundedValue >= 80 && roundedValue <= 5_000) ||
    // Legacy local history remains readable/syncable, but current XP rules reward duration_ms only.
    (gameId === 'checkers' && metric === 'correct_count' && roundedValue >= 0 && roundedValue <= 1) ||
    (gameId === 'tic-tac-toe' && metric === 'correct_count' && roundedValue >= 0 && roundedValue <= 1) ||
        (gameId === 'number-memory' && metric === 'correct_count' && roundedValue >= 0 && roundedValue <= 10) ||
    (gameId === 'stroop-test' && metric === 'score' && roundedValue >= 0 && roundedValue <= 100_000);

  if (!valid) throw new ApiError('O‘yin natijasi ruxsat etilgan chegaradan tashqarida.', 400, 'invalid_attempt');

  const rawMeta = sanitizeMeta(raw.meta);
  const commonSoloMeta = [
    'difficulty',
    'rounds',
    'selectedRounds',
    'survival',
    'correct',
    'errors',
    'timeouts',
    'multiplayer',
    'opponent',
    'opponentTimeMs',
    'outcome',
    'won',
    'draw',
    'role',
  ];
  const expandedSoloMeta = [...commonSoloMeta, 'memorySize', 'nBack', 'puzzleShuffle', 'failed'];
  const allowedMetaKeys: Record<string, string[]> = {
    reaction: [...commonSoloMeta, 'mode', 'isNewBest'],
    'emoji-find': commonSoloMeta,
    'number-memory': [...commonSoloMeta, 'digits'],
    'stroop-test': [...commonSoloMeta, 'averageMs'],
    'ascending-numbers': expandedSoloMeta,
    'odd-one-out': expandedSoloMeta,
    'pattern-memory': expandedSoloMeta,
    'go-no-go': expandedSoloMeta,
    'mental-math': expandedSoloMeta,
    'sequence-memory': expandedSoloMeta,
    'card-memory': expandedSoloMeta,
    'time-estimation': expandedSoloMeta,
    'peripheral-vision': expandedSoloMeta,
    'twenty-four': expandedSoloMeta,
    'dual-n-back': expandedSoloMeta,
    'fifteen-puzzle': expandedSoloMeta,
    sudoku: [...expandedSoloMeta, 'mistakes', 'hints', 'clues'],
    checkers: [
      'multiplayer', 'outcome', 'opponent', 'moves', 'captured',
      'opponentCaptured', 'promotions', 'durationMs', 'color',
      'resultReason', 'role', 'won', 'draw'
    ],
    'tic-tac-toe': ['multiplayer', 'outcome', 'opponent', 'moves', 'role', 'won', 'draw'],
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


const DUEL_GAME_IDS = [
  'checkers',
  'tic-tac-toe',
] as const;
const DUEL_DIFFICULTIES = ['easy', 'medium', 'hard', 'very-hard', 'progressive'] as const;

function sanitizeDuelSetup(payload: Record<string, unknown>) {
  const gameId = requireString(payload.gameId, 'gameId', 40);
  if (!(DUEL_GAME_IDS as readonly string[]).includes(gameId)) {
    throw new ApiError('O‘yin turi noto‘g‘ri.', 400, 'invalid_duel_game');
  }

  const difficulty = requireString(payload.difficulty, 'difficulty', 30);
  if (!(DUEL_DIFFICULTIES as readonly string[]).includes(difficulty)) {
    throw new ApiError('Qiyinlik darajasi noto‘g‘ri.', 400, 'invalid_duel_difficulty');
  }

  const survival = payload.rounds === 'survival';
  const roundCount = survival ? 5 : Math.round(Number(payload.rounds));
  if (!survival && (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 10)) {
    throw new ApiError('Raundlar soni noto‘g‘ri.', 400, 'invalid_duel_rounds');
  }

  const rawConfig = payload.gameConfig && typeof payload.gameConfig === 'object' && !Array.isArray(payload.gameConfig)
    ? payload.gameConfig as Record<string, unknown>
    : {};
  const gameConfig: Record<string, number> = {};
  const memorySize = Math.round(Number(rawConfig.memorySize));
  const nBack = Math.round(Number(rawConfig.nBack));
  const puzzleShuffle = Math.round(Number(rawConfig.puzzleShuffle));
  if (Number.isInteger(memorySize) && memorySize >= 3 && memorySize <= 8) gameConfig.memorySize = memorySize;
  if (Number.isInteger(nBack) && nBack >= 1 && nBack <= 3) gameConfig.nBack = nBack;
  if (Number.isInteger(puzzleShuffle) && puzzleShuffle >= 10 && puzzleShuffle <= 120) gameConfig.puzzleShuffle = puzzleShuffle;

  return {
    gameId: gameId as DuelRow['game_id'],
    difficulty: difficulty as DuelRow['difficulty'],
    survival,
    roundCount,
    gameConfig,
  };
}

function isActiveDuelStatus(status: DuelRow['status']): boolean {
  return status === 'invited' || status === 'ready_check' || status === 'countdown' || status === 'playing';
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


type ServerCheckersPiece = '.' | 'w' | 'W' | 'b' | 'B';
type ServerCheckersSide = 'white' | 'black';

interface ServerCheckersMove {
  from: number;
  to: number;
  captured: number | null;
  promotes: boolean;
}

const CHECKERS_INITIAL_BOARD = 'bbbbbbbbbbbb........wwwwwwwwwwww';
const CHECKERS_TURN_MS = 60_000;
const CHECKERS_NO_PROGRESS_LIMIT = 40;
const CHECKERS_MOVE_LIMIT = 120;
const CHECKERS_DRAW_OFFER_LIMIT = 3;
const CHECKERS_DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

function parseServerCheckersBoard(value: string | null | undefined): ServerCheckersPiece[] {
  const safe = typeof value === 'string' && /^[wWbB.]{32}$/.test(value)
    ? value
    : CHECKERS_INITIAL_BOARD;
  return safe.split('') as ServerCheckersPiece[];
}

function serializeServerCheckersBoard(board: readonly ServerCheckersPiece[]): string {
  return board.join('');
}

function serverCheckersIndexToCoordinate(index: number): { row: number; column: number } {
  const row = Math.floor(index / 4);
  const offset = index % 4;
  return {
    row,
    column: row % 2 === 0 ? offset * 2 + 1 : offset * 2,
  };
}

function serverCheckersCoordinateToIndex(row: number, column: number): number | null {
  if (
    row < 0 ||
    row > 7 ||
    column < 0 ||
    column > 7 ||
    (row + column) % 2 === 0
  ) {
    return null;
  }

  return row * 4 + Math.floor(column / 2);
}

function serverCheckersPieceSide(
  piece: ServerCheckersPiece,
): ServerCheckersSide | null {
  if (piece === 'w' || piece === 'W') return 'white';
  if (piece === 'b' || piece === 'B') return 'black';
  return null;
}

function serverCheckersOpponent(side: ServerCheckersSide): ServerCheckersSide {
  return side === 'white' ? 'black' : 'white';
}

function serverCheckersIsKing(piece: ServerCheckersPiece): boolean {
  return piece === 'W' || piece === 'B';
}

function serverCheckersPromotionRow(side: ServerCheckersSide): number {
  return side === 'white' ? 0 : 7;
}

function serverCheckersPieceFor(
  side: ServerCheckersSide,
  king: boolean,
): ServerCheckersPiece {
  if (side === 'white') return king ? 'W' : 'w';
  return king ? 'B' : 'b';
}

function serverCheckersManCaptures(
  board: readonly ServerCheckersPiece[],
  from: number,
  side: ServerCheckersSide,
): ServerCheckersMove[] {
  const origin = serverCheckersIndexToCoordinate(from);
  const moves: ServerCheckersMove[] = [];

  for (const [rowStep, columnStep] of CHECKERS_DIAGONALS) {
    const middle = serverCheckersCoordinateToIndex(
      origin.row + rowStep,
      origin.column + columnStep,
    );
    const landing = serverCheckersCoordinateToIndex(
      origin.row + rowStep * 2,
      origin.column + columnStep * 2,
    );

    if (middle === null || landing === null) continue;
    if (
      serverCheckersPieceSide(board[middle]) === serverCheckersOpponent(side) &&
      board[landing] === '.'
    ) {
      moves.push({
        from,
        to: landing,
        captured: middle,
        promotes:
          serverCheckersIndexToCoordinate(landing).row ===
          serverCheckersPromotionRow(side),
      });
    }
  }

  return moves;
}

function serverCheckersKingCaptures(
  board: readonly ServerCheckersPiece[],
  from: number,
  side: ServerCheckersSide,
): ServerCheckersMove[] {
  const origin = serverCheckersIndexToCoordinate(from);
  const moves: ServerCheckersMove[] = [];

  for (const [rowStep, columnStep] of CHECKERS_DIAGONALS) {
    let row = origin.row + rowStep;
    let column = origin.column + columnStep;
    let captured: number | null = null;

    while (true) {
      const index = serverCheckersCoordinateToIndex(row, column);
      if (index === null) break;
      const piece = board[index];

      if (piece === '.') {
        if (captured !== null) {
          moves.push({
            from,
            to: index,
            captured,
            promotes: false,
          });
        }
      } else if (serverCheckersPieceSide(piece) === side) {
        break;
      } else if (captured !== null) {
        break;
      } else {
        captured = index;
      }

      row += rowStep;
      column += columnStep;
    }
  }

  return moves;
}

function serverCheckersCapturesForPiece(
  board: readonly ServerCheckersPiece[],
  from: number,
): ServerCheckersMove[] {
  const piece = board[from];
  const side = serverCheckersPieceSide(piece);
  if (!side) return [];

  return serverCheckersIsKing(piece)
    ? serverCheckersKingCaptures(board, from, side)
    : serverCheckersManCaptures(board, from, side);
}

function serverCheckersManQuietMoves(
  board: readonly ServerCheckersPiece[],
  from: number,
  side: ServerCheckersSide,
): ServerCheckersMove[] {
  const origin = serverCheckersIndexToCoordinate(from);
  const rowStep = side === 'white' ? -1 : 1;
  const moves: ServerCheckersMove[] = [];

  for (const columnStep of [-1, 1] as const) {
    const to = serverCheckersCoordinateToIndex(
      origin.row + rowStep,
      origin.column + columnStep,
    );
    if (to === null || board[to] !== '.') continue;

    moves.push({
      from,
      to,
      captured: null,
      promotes:
        serverCheckersIndexToCoordinate(to).row ===
        serverCheckersPromotionRow(side),
    });
  }

  return moves;
}

function serverCheckersKingQuietMoves(
  board: readonly ServerCheckersPiece[],
  from: number,
): ServerCheckersMove[] {
  const origin = serverCheckersIndexToCoordinate(from);
  const moves: ServerCheckersMove[] = [];

  for (const [rowStep, columnStep] of CHECKERS_DIAGONALS) {
    let row = origin.row + rowStep;
    let column = origin.column + columnStep;

    while (true) {
      const to = serverCheckersCoordinateToIndex(row, column);
      if (to === null || board[to] !== '.') break;
      moves.push({
        from,
        to,
        captured: null,
        promotes: false,
      });
      row += rowStep;
      column += columnStep;
    }
  }

  return moves;
}

function serverCheckersLegalMoves(
  board: readonly ServerCheckersPiece[],
  side: ServerCheckersSide,
  forcedFrom: number | null,
): ServerCheckersMove[] {
  const eligible = forcedFrom === null
    ? board
        .map((piece, index) => ({ piece, index }))
        .filter(({ piece }) => serverCheckersPieceSide(piece) === side)
        .map(({ index }) => index)
    : [forcedFrom].filter(
        (index) => serverCheckersPieceSide(board[index]) === side,
      );

  const captures = eligible.flatMap((index) =>
    serverCheckersCapturesForPiece(board, index)
  );
  if (captures.length > 0) return captures;
  if (forcedFrom !== null) return [];

  return eligible.flatMap((index) => {
    const piece = board[index];
    return serverCheckersIsKing(piece)
      ? serverCheckersKingQuietMoves(board, index)
      : serverCheckersManQuietMoves(board, index, side);
  });
}

function applyServerCheckersMove(
  board: readonly ServerCheckersPiece[],
  move: ServerCheckersMove,
): {
  board: ServerCheckersPiece[];
  promoted: boolean;
} {
  const next = [...board];
  const movingPiece = next[move.from];
  const side = serverCheckersPieceSide(movingPiece);
  if (!side) return { board: next, promoted: false };

  next[move.from] = '.';
  if (move.captured !== null) next[move.captured] = '.';

  const wasKing = serverCheckersIsKing(movingPiece);
  const destinationRow = serverCheckersIndexToCoordinate(move.to).row;
  const promoted =
    !wasKing && destinationRow === serverCheckersPromotionRow(side);
  next[move.to] = serverCheckersPieceFor(side, wasKing || promoted);

  return { board: next, promoted };
}

function serverCheckersSideForRole(
  role: 'host' | 'guest',
): ServerCheckersSide {
  return role === 'host' ? 'white' : 'black';
}

function serverCheckersCountPieces(
  board: readonly ServerCheckersPiece[],
  side: ServerCheckersSide,
): number {
  return board.filter((piece) => serverCheckersPieceSide(piece) === side).length;
}

async function resolveCheckersTimeoutIfNeeded(
  serviceClient: SupabaseClient,
  duel: DuelRow,
): Promise<DuelRow> {
  if (
    duel.game_id !== 'checkers' ||
    duel.status === 'finished' ||
    duel.status === 'cancelled' ||
    duel.status === 'expired'
  ) {
    return duel;
  }

  const now = Date.now();

  if (
    duel.status === 'playing' &&
    !duel.checkers_turn_deadline_at
  ) {
    const deadline = new Date(now + CHECKERS_TURN_MS).toISOString();
    const { data } = await serviceClient
      .from('duels')
      .update({ checkers_turn_deadline_at: deadline })
      .eq('id', duel.id)
      .eq('status', 'playing')
      .is('checkers_turn_deadline_at', null)
      .select('*')
      .maybeSingle();

    duel = (data as DuelRow | null) ?? {
      ...duel,
      checkers_turn_deadline_at: deadline,
    };
  }

  if (
    duel.status !== 'playing' ||
    !duel.checkers_turn_deadline_at ||
    new Date(duel.checkers_turn_deadline_at).getTime() > now ||
    duel.checkers_winner
  ) {
    return duel;
  }

  const losingRole = duel.checkers_turn ?? 'host';
  const winner = losingRole === 'host' ? 'guest' : 'host';
  const finishedAt = new Date(now).toISOString();

  const { data } = await serviceClient
    .from('duels')
    .update({
      status: 'finished',
      checkers_winner: winner,
      checkers_result_reason: 'timeout',
      finished_at: finishedAt,
      checkers_draw_offer_by: null,
      checkers_draw_offer_at: null,
    })
    .eq('id', duel.id)
    .eq('status', 'playing')
    .is('checkers_winner', null)
    .lte('checkers_turn_deadline_at', finishedAt)
    .select('*')
    .maybeSingle();

  const resolved = (data as DuelRow | null) ?? duel;
  await persistCheckersHistory(serviceClient, resolved);
  return resolved;
}

async function expireDuelIfNeeded(serviceClient: SupabaseClient, duel: DuelRow): Promise<DuelRow> {
  if (duel.status === 'finished' || duel.status === 'cancelled' || duel.status === 'expired') return duel;

  const now = Date.now();
  let nextStatus: DuelRow['status'] | null = null;
  let update: Record<string, unknown> = {};

  if (
    duel.status === 'ready_check' &&
    duel.ready_deadline_at &&
    new Date(duel.ready_deadline_at).getTime() <= now &&
    !(duel.host_ready && duel.guest_ready)
  ) {
    nextStatus = 'cancelled';
    update = { status: 'cancelled', cancelled_at: new Date(now).toISOString() };
  } else if (
    duel.status === 'countdown' &&
    duel.game_start_at &&
    new Date(duel.game_start_at).getTime() <= now
  ) {
    nextStatus = 'playing';
    update = {
      status: 'playing',
      ...(duel.game_id === 'checkers' && !duel.checkers_turn_deadline_at
        ? {
            checkers_turn_deadline_at: new Date(
              new Date(duel.game_start_at).getTime() + CHECKERS_TURN_MS,
            ).toISOString(),
          }
        : {}),
    };
  } else if (new Date(duel.expires_at).getTime() <= now) {
    nextStatus = 'expired';
    update = { status: 'expired' };
  }

  if (!nextStatus) return duel;

  const { data } = await serviceClient
    .from('duels')
    .update(update)
    .eq('id', duel.id)
    .eq('status', duel.status)
    .select('*')
    .maybeSingle();

  return (data as DuelRow | null) ?? { ...duel, ...update, status: nextStatus };
}

async function getDuelOrThrow(serviceClient: SupabaseClient, duelId: string): Promise<DuelRow> {
  const { data, error } = await serviceClient
    .from('duels')
    .select('*')
    .eq('id', duelId)
    .maybeSingle();
  if (error || !data) {
    throw new ApiError('Duel topilmadi.', 404, 'duel_not_found');
  }

  const rawDuel = data as DuelRow;
  if (
    rawDuel.game_id === 'checkers' &&
    rawDuel.status === 'playing'
  ) {
    return resolveCheckersTimeoutIfNeeded(
      serviceClient,
      rawDuel,
    );
  }

  const lifecycleResolved = await expireDuelIfNeeded(
    serviceClient,
    rawDuel,
  );
  return resolveCheckersTimeoutIfNeeded(
    serviceClient,
    lifecycleResolved,
  );
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
  const commonMeta = {
    multiplayer: true,
    difficulty: duel.difficulty,
    rounds: duel.survival ? 0 : duel.round_count,
    selectedRounds: duel.survival ? 0 : duel.round_count,
    survival: duel.survival,
    ...(duel.game_config ?? {}),
  };
  const rows = [
    {
      user_id: duel.host_user_id,
      history_generation: generations.get(duel.host_user_id),
      client_attempt_id: `duel-${duel.id}-${duel.host_user_id}`,
      game_id: duel.game_id,
      metric: 'duration_ms',
      value: duel.host_time_ms,
      meta: {
        ...commonMeta,
        opponent: duel.guest_name ?? 'Player',
        opponentTimeMs: duel.guest_time_ms,
        outcome: draw
          ? 'draw'
          : duel.host_time_ms < duel.guest_time_ms
            ? 'win'
            : 'loss',
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
      game_id: duel.game_id,
      metric: 'duration_ms',
      value: duel.guest_time_ms,
      meta: {
        ...commonMeta,
        opponent: duel.host_name,
        opponentTimeMs: duel.host_time_ms,
        outcome: draw
          ? 'draw'
          : duel.guest_time_ms < duel.host_time_ms
            ? 'win'
            : 'loss',
        won: duel.guest_time_ms < duel.host_time_ms,
        draw,
        role: 'guest',
      },
      played_at: playedAt,
    },
  ];

  const { error } = await serviceClient
    .from('game_attempts')
    .upsert(rows, { onConflict: 'user_id,client_attempt_id', ignoreDuplicates: true });
  if (error) throw new ApiError('Duel tarixini saqlab bo‘lmadi.', 500, 'duel_history_failed');
}

async function persistTicTacToeHistory(
  serviceClient: SupabaseClient,
  duel: DuelRow,
): Promise<void> {
  if (
    duel.game_id !== 'tic-tac-toe' ||
    duel.status !== 'finished' ||
    !duel.guest_user_id ||
    !duel.tic_tac_toe_winner
  ) {
    return;
  }

  const userIds = [duel.host_user_id, duel.guest_user_id];
  const { data: users, error: usersError } = await serviceClient
    .from('users')
    .select('id,history_generation')
    .in('id', userIds);

  if (usersError || !users || users.length !== 2) {
    throw new ApiError('Tic Tac Toe tarixini saqlab bo‘lmadi.', 500, 'duel_history_failed');
  }

  const generations = new Map(
    users.map((user) => [String(user.id), String(user.history_generation)]),
  );
  const winner = duel.tic_tac_toe_winner;
  const playedAt = duel.finished_at ?? new Date().toISOString();
  const draw = winner === 'draw';

  const rows = [
    {
      user_id: duel.host_user_id,
      history_generation: generations.get(duel.host_user_id),
      client_attempt_id: `tic-${duel.id}-${duel.host_user_id}`,
      game_id: 'tic-tac-toe',
      metric: 'correct_count',
      value: winner === 'host' ? 1 : 0,
      meta: {
        multiplayer: true,
        outcome: draw ? 'draw' : winner === 'host' ? 'win' : 'loss',
        opponent: duel.guest_name ?? 'Player',
        moves: duel.tic_tac_toe_moves ?? 0,
        role: 'host',
        won: winner === 'host',
        draw,
      },
      played_at: playedAt,
    },
    {
      user_id: duel.guest_user_id,
      history_generation: generations.get(duel.guest_user_id),
      client_attempt_id: `tic-${duel.id}-${duel.guest_user_id}`,
      game_id: 'tic-tac-toe',
      metric: 'correct_count',
      value: winner === 'guest' ? 1 : 0,
      meta: {
        multiplayer: true,
        outcome: draw ? 'draw' : winner === 'guest' ? 'win' : 'loss',
        opponent: duel.host_name,
        moves: duel.tic_tac_toe_moves ?? 0,
        role: 'guest',
        won: winner === 'guest',
        draw,
      },
      played_at: playedAt,
    },
  ];

  const { error } = await serviceClient
    .from('game_attempts')
    .upsert(rows, {
      onConflict: 'user_id,client_attempt_id',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new ApiError('Tic Tac Toe tarixini saqlab bo‘lmadi.', 500, 'duel_history_failed');
  }
}

async function finalizeRatedCheckersIfNeeded(
  serviceClient: SupabaseClient,
  duel: DuelRow,
): Promise<DuelRow> {
  if (
    duel.game_id !== 'checkers' ||
    duel.checkers_mode !== 'rated' ||
    duel.status !== 'finished' ||
    !duel.checkers_winner ||
    duel.checkers_rating_processed_at
  ) {
    return duel;
  }

  const { data, error } = await serviceClient.rpc(
    'finalize_checkers_rating',
    { p_duel_id: duel.id },
  );
  if (error) {
    throw new ApiError(
      'Shashka reytingini hisoblab bo‘lmadi.',
      500,
      'checkers_rating_failed',
    );
  }

  const finalized = Array.isArray(data) ? data[0] : data;
  return (finalized as DuelRow | null) ?? duel;
}

async function persistCheckersHistory(
  serviceClient: SupabaseClient,
  duel: DuelRow,
): Promise<void> {
  duel = await finalizeRatedCheckersIfNeeded(serviceClient, duel);

  if (
    duel.game_id !== 'checkers' ||
    duel.status !== 'finished' ||
    !duel.guest_user_id ||
    !duel.checkers_winner
  ) {
    return;
  }

  const userIds = [duel.host_user_id, duel.guest_user_id];
  const { data: users, error: usersError } = await serviceClient
    .from('users')
    .select('id,history_generation')
    .in('id', userIds);

  if (usersError || !users || users.length !== 2) {
    throw new ApiError(
      'Shashka tarixini saqlab bo‘lmadi.',
      500,
      'duel_history_failed',
    );
  }

  const generations = new Map(
    users.map((user) => [
      String(user.id),
      String(user.history_generation),
    ]),
  );
  const winner = duel.checkers_winner;
  const draw = winner === 'draw';
  const playedAt = duel.finished_at ?? new Date().toISOString();
  const durationMs =
    duel.game_start_at && duel.finished_at
      ? Math.max(
          0,
          new Date(duel.finished_at).getTime() -
            new Date(duel.game_start_at).getTime(),
        )
      : 0;

  const makeRow = (
    role: 'host' | 'guest',
    userId: string,
    opponent: string,
  ) => {
    const won = winner === role;
    const captured =
      role === 'host'
        ? duel.checkers_host_captures ?? 0
        : duel.checkers_guest_captures ?? 0;
    const opponentCaptured =
      role === 'host'
        ? duel.checkers_guest_captures ?? 0
        : duel.checkers_host_captures ?? 0;
    const promotions =
      role === 'host'
        ? duel.checkers_host_promotions ?? 0
        : duel.checkers_guest_promotions ?? 0;

    return {
      user_id: userId,
      history_generation: generations.get(userId),
      client_attempt_id: `checkers-${duel.id}-${userId}`,
      game_id: 'checkers',
      metric: 'correct_count',
      value: won ? 1 : 0,
      meta: {
        multiplayer: true,
        outcome: draw ? 'draw' : won ? 'win' : 'loss',
        opponent,
        moves: duel.checkers_moves ?? 0,
        captured,
        opponentCaptured,
        promotions,
        durationMs,
        color: role === 'host' ? 'white' : 'black',
        resultReason: duel.checkers_result_reason ?? 'unknown',
        mode: duel.checkers_mode ?? 'friendly',
        ratingBefore:
          role === 'host'
            ? duel.checkers_host_rating_before
            : duel.checkers_guest_rating_before,
        ratingAfter:
          role === 'host'
            ? duel.checkers_host_rating_after
            : duel.checkers_guest_rating_after,
        ratingDelta:
          role === 'host'
            ? duel.checkers_host_rating_delta ?? 0
            : duel.checkers_guest_rating_delta ?? 0,
        role,
        won,
        draw,
      },
      played_at: playedAt,
    };
  };

  const rows = [
    makeRow(
      'host',
      duel.host_user_id,
      duel.guest_name ?? 'Player',
    ),
    makeRow(
      'guest',
      duel.guest_user_id,
      duel.host_name,
    ),
  ];

  const { error } = await serviceClient
    .from('game_attempts')
    .upsert(rows, {
      onConflict: 'user_id,client_attempt_id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new ApiError(
      'Shashka tarixini saqlab bo‘lmadi.',
      500,
      'duel_history_failed',
    );
  }
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

    case 'checkers.profile': {
      const { data: ensured, error: ensureError } = await serviceClient.rpc(
        'ensure_checkers_rating',
        { p_user_id: account.id },
      );
      if (ensureError) {
        throw new ApiError(
          'Shashka profilingizni yuklab bo‘lmadi.',
          500,
          'checkers_profile_failed',
        );
      }

      const ratingRow = (
        Array.isArray(ensured) ? ensured[0] : ensured
      ) as Record<string, unknown>;

      const rating = Number(ratingRow.rating ?? 1200);
      const { count: higherCount } = await serviceClient
        .from('checkers_ratings')
        .select('user_id', { count: 'exact', head: true })
        .gt('rating', rating);

      const { data: activeDuel } = await serviceClient
        .from('duels')
        .select('id,host_user_id,guest_user_id')
        .eq('game_id', 'checkers')
        .in('status', ['invited', 'ready_check', 'countdown', 'playing'])
        .or(
          `host_user_id.eq.${account.id},guest_user_id.eq.${account.id}`,
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        userId: account.id,
        displayName: account.display_name,
        username: account.username,
        rating,
        peakRating: Number(ratingRow.peak_rating ?? rating),
        games: Number(ratingRow.games ?? 0),
        wins: Number(ratingRow.wins ?? 0),
        draws: Number(ratingRow.draws ?? 0),
        losses: Number(ratingRow.losses ?? 0),
        provisionalGames: Number(ratingRow.provisional_games ?? 0),
        rank: (higherCount ?? 0) + 1,
        activeDuelId: activeDuel ? String(activeDuel.id) : null,
        activeRole: activeDuel
          ? String(activeDuel.host_user_id) === account.id
            ? 'host'
            : 'guest'
          : null,
      };
    }

    case 'checkers.leaderboard': {
      const limit = Math.min(
        100,
        Math.max(10, Math.round(Number(payload.limit) || 50)),
      );
      await serviceClient.rpc('ensure_checkers_rating', {
        p_user_id: account.id,
      });

      const { data, error } = await serviceClient
        .from('checkers_ratings')
        .select(
          'user_id,rating,peak_rating,games,wins,draws,losses,users!inner(display_name,username)',
        )
        .order('rating', { ascending: false })
        .order('games', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw new ApiError(
          'Shashka reytingini yuklab bo‘lmadi.',
          500,
          'checkers_leaderboard_failed',
        );
      }

      const rows = (data ?? []).map(
        (raw: Record<string, unknown>, index: number) => {
          const joined = raw.users;
          const user = Array.isArray(joined)
            ? (joined[0] as Record<string, unknown> | undefined)
            : (joined as Record<string, unknown> | undefined);

          return {
            userId: String(raw.user_id),
            displayName: user?.display_name
              ? String(user.display_name)
              : 'Player',
            username: user?.username ? String(user.username) : null,
            rating: Number(raw.rating ?? 1200),
            peakRating: Number(raw.peak_rating ?? raw.rating ?? 1200),
            games: Number(raw.games ?? 0),
            wins: Number(raw.wins ?? 0),
            draws: Number(raw.draws ?? 0),
            losses: Number(raw.losses ?? 0),
            rank: index + 1,
          };
        },
      );

      let currentUser =
        rows.find((row) => row.userId === account.id) ?? null;

      if (!currentUser) {
        const { data: own } = await serviceClient
          .from('checkers_ratings')
          .select(
            'user_id,rating,peak_rating,games,wins,draws,losses',
          )
          .eq('user_id', account.id)
          .maybeSingle();

        if (own) {
          const ownRating = Number(own.rating ?? 1200);
          const { count } = await serviceClient
            .from('checkers_ratings')
            .select('user_id', { count: 'exact', head: true })
            .gt('rating', ownRating);

          currentUser = {
            userId: account.id,
            displayName: account.display_name,
            username: account.username,
            rating: ownRating,
            peakRating: Number(own.peak_rating ?? ownRating),
            games: Number(own.games ?? 0),
            wins: Number(own.wins ?? 0),
            draws: Number(own.draws ?? 0),
            losses: Number(own.losses ?? 0),
            rank: (count ?? 0) + 1,
          };
        }
      }

      return { rows, currentUser };
    }

    case 'checkers.history': {
      const limit = Math.min(
        100,
        Math.max(10, Math.round(Number(payload.limit) || 50)),
      );
      const outcome =
        payload.outcome === 'win' ||
        payload.outcome === 'draw' ||
        payload.outcome === 'loss'
          ? String(payload.outcome)
          : 'all';

      let query = serviceClient
        .from('game_attempts')
        .select('client_attempt_id,meta,played_at')
        .eq('user_id', account.id)
        .eq('game_id', 'checkers')
        .order('played_at', { ascending: false })
        .limit(limit);

      if (outcome !== 'all') {
        query = query.eq('meta->>outcome', outcome);
      }

      const { data, error } = await query;
      if (error) {
        throw new ApiError(
          'Shashka tarixini yuklab bo‘lmadi.',
          500,
          'checkers_history_failed',
        );
      }

      return {
        rows: (data ?? []).map((raw: Record<string, unknown>) => {
          const meta = (raw.meta ?? {}) as Record<string, unknown>;
          const clientId = String(raw.client_attempt_id ?? '');
          return {
            duelId: clientId
              .replace(/^checkers-/, '')
              .replace(`-${account.id}`, ''),
            opponentName: String(meta.opponent ?? 'Player'),
            opponentUsername: meta.opponentUsername
              ? String(meta.opponentUsername)
              : null,
            outcome:
              meta.outcome === 'win' ||
              meta.outcome === 'draw' ||
              meta.outcome === 'loss'
                ? meta.outcome
                : 'loss',
            mode: meta.mode === 'rated' ? 'rated' : 'friendly',
            color: meta.color === 'black' ? 'black' : 'white',
            moves: Number(meta.moves ?? 0),
            durationMs: Number(meta.durationMs ?? 0),
            captured: Number(meta.captured ?? 0),
            opponentCaptured: Number(meta.opponentCaptured ?? 0),
            promotions: Number(meta.promotions ?? 0),
            resultReason: String(meta.resultReason ?? 'unknown'),
            ratingBefore:
              typeof meta.ratingBefore === 'number'
                ? meta.ratingBefore
                : null,
            ratingAfter:
              typeof meta.ratingAfter === 'number'
                ? meta.ratingAfter
                : null,
            ratingDelta: Number(meta.ratingDelta ?? 0),
            playedAt: new Date(String(raw.played_at)).getTime(),
          };
        }),
      };
    }

    case 'checkers.queue.status': {
      const { data } = await serviceClient
        .from('checkers_matchmaking_queue')
        .select('status,duel_id,role,queued_at')
        .eq('user_id', account.id)
        .maybeSingle();

      if (!data) {
        return {
          state: 'idle',
          queuedAt: null,
          expandedRange: 100,
          duelId: null,
          role: null,
          opponentName: null,
        };
      }

      if (data.status === 'matched' && data.duel_id) {
        const duel = await getDuelOrThrow(
          serviceClient,
          String(data.duel_id),
        );
        if (isActiveDuelStatus(duel.status)) {
          return {
            state: 'matched',
            queuedAt: new Date(String(data.queued_at)).getTime(),
            expandedRange: 500,
            duelId: duel.id,
            role: data.role,
            opponentName:
              data.role === 'host'
                ? duel.guest_name
                : duel.host_name,
          };
        }

        await serviceClient
          .from('checkers_matchmaking_queue')
          .delete()
          .eq('user_id', account.id);
        return {
          state: 'idle',
          queuedAt: null,
          expandedRange: 100,
          duelId: null,
          role: null,
          opponentName: null,
        };
      }

      const queuedAt = new Date(String(data.queued_at)).getTime();
      const waitedSeconds = Math.max(
        0,
        Math.floor((Date.now() - queuedAt) / 1000),
      );
      return {
        state: 'searching',
        queuedAt,
        expandedRange: Math.min(
          500,
          100 + Math.floor(waitedSeconds / 15) * 50,
        ),
        duelId: null,
        role: null,
        opponentName: null,
      };
    }

    case 'checkers.queue.leave': {
      await serviceClient
        .from('checkers_matchmaking_queue')
        .delete()
        .eq('user_id', account.id)
        .eq('status', 'waiting');
      return { left: true };
    }

    case 'checkers.queue.join': {
      const { data, error } = await serviceClient.rpc(
        'join_checkers_matchmaking',
        { p_user_id: account.id },
      );

      if (error || !data) {
        throw new ApiError(
          'Reytingli raqib qidiruvini boshlash mumkin emas.',
          500,
          'checkers_queue_failed',
        );
      }

      return data as Record<string, unknown>;
    }

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

    case 'leaderboard.game': {
      const allowedGameIds = [
        'reaction', 'emoji-find', 'number-memory', 'stroop-test',
        'ascending-numbers', 'odd-one-out', 'pattern-memory', 'go-no-go',
        'mental-math', 'sequence-memory', 'card-memory', 'time-estimation',
        'peripheral-vision', 'twenty-four', 'dual-n-back', 'fifteen-puzzle', 'sudoku',
      ];
      const requestedGameId = String(payload.gameId ?? '');
      const gameId = allowedGameIds.includes(requestedGameId)
        ? requestedGameId
        : 'reaction';
      const limit = Math.min(
        100,
        Math.max(1, Math.round(Number(payload.limit) || 30)),
      );

      const { data, error } = await serviceClient.rpc(
        'get_game_best_leaderboard',
        {
          p_game_id: gameId,
          p_limit: limit,
          p_user_id: account.id,
        },
      );

      if (error) {
        throw new ApiError(
          'O‘yin reytingini yuklab bo‘lmadi.',
          500,
          'game_leaderboard_failed',
        );
      }

      const mapped = (data ?? []).map((row: Record<string, unknown>) => ({
        userId: String(row.user_id),
        displayName: String(row.display_name),
        username: row.username ? String(row.username) : null,
        bestMs: Number(row.best_ms ?? 0),
        rank: Number(row.rank ?? 0),
        isCurrent: Boolean(row.is_current),
      }));

      const publicRow = (row: (typeof mapped)[number]) => ({
        userId: row.userId,
        displayName: row.displayName,
        username: row.username,
        bestMs: row.bestMs,
        rank: row.rank,
      });
      const currentEntry = mapped.find((row) => row.isCurrent) ?? null;

      return {
        rows: mapped.filter((row) => row.rank <= limit).map(publicRow),
        currentUser: currentEntry ? publicRow(currentEntry) : null,
      };
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
      const { data, error } = await serviceClient.rpc('get_xp_period_leaderboard', {
        p_period: rpcPeriod,
        p_limit: limit,
        p_user_ids: userIds,
      });
      if (error) throw new ApiError('XP reytingini yuklab bo‘lmadi.', 500, 'leaderboard_failed');

      return {
        rows: (data ?? []).map((row: Record<string, unknown>) => ({
          userId: String(row.user_id),
          displayName: String(row.display_name),
          username: row.username ? String(row.username) : null,
          xp: Number(row.xp ?? 0),
          totalXp: Number(row.total_xp ?? 0),
          level: Number(row.level ?? 1),
          rank: Number(row.rank),
        })),
      };
    }

    case 'leaderboard.rank': {
      const { data, error } = await serviceClient.rpc('get_progression', { p_user_id: account.id });
      if (error) throw new ApiError('XP reytingidagi o‘rinni aniqlab bo‘lmadi.', 500, 'rank_failed');
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      const rank = row?.xp_rank;
      return { rank: rank === null || rank === undefined ? null : Number(rank) };
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

    case 'duel.invite': {
      const targetUserId = requireUuid(payload.targetUserId, 'targetUserId');
      if (targetUserId === account.id) {
        throw new ApiError('O‘zingizni o‘yinga chaqira olmaysiz.', 400, 'duel_self_invite');
      }
      const setup = sanitizeDuelSetup(payload);

      const { data: friendship, error: friendshipError } = await serviceClient
        .from('friendships')
        .select('id')
        .eq('status', 'accepted')
        .or(
          `and(requester_id.eq.${account.id},addressee_id.eq.${targetUserId}),` +
          `and(requester_id.eq.${targetUserId},addressee_id.eq.${account.id})`,
        )
        .limit(1)
        .maybeSingle();
      if (friendshipError) throw new ApiError('Do‘stlik holatini tekshirib bo‘lmadi.', 500, 'duel_invite_failed');
      if (!friendship) throw new ApiError('Faqat do‘stingizni o‘yinga chaqira olasiz.', 403, 'duel_friend_required');

      const { data: target, error: targetError } = await serviceClient
        .from('users')
        .select('id,display_name')
        .eq('id', targetUserId)
        .maybeSingle();
      if (targetError || !target) throw new ApiError('Do‘st topilmadi.', 404, 'user_not_found');

      const { data: active, error: activeError } = await serviceClient
        .from('duels')
        .select('id,status')
        .in('status', ['invited', 'ready_check', 'countdown', 'playing'])
        .gt('expires_at', new Date().toISOString())
        .or(
          `host_user_id.eq.${account.id},guest_user_id.eq.${account.id},` +
          `host_user_id.eq.${targetUserId},guest_user_id.eq.${targetUserId}`,
        )
        .limit(1)
        .maybeSingle();
      if (activeError) throw new ApiError('Faol o‘yinni tekshirib bo‘lmadi.', 500, 'duel_invite_failed');
      if (active) throw new ApiError('Avvalgi do‘stlik o‘yinini yakunlang yoki bekor qiling.', 409, 'duel_already_active');

      const now = Date.now();
      const { data, error } = await serviceClient
        .from('duels')
        .insert({
          host_user_id: account.id,
          guest_user_id: targetUserId,
          host_name: account.display_name,
          guest_name: target.display_name,
          status: 'invited',
          game_id: setup.gameId,
          round_count: setup.roundCount,
          survival: setup.survival,
          difficulty: setup.difficulty,
          game_config: setup.gameConfig,
          checkers_mode:
            setup.gameId === 'checkers'
              ? 'friendly'
              : 'friendly',
          invited_at: new Date(now).toISOString(),
          expires_at: new Date(now + 2 * 60_000).toISOString(),
        })
        .select('*')
        .single();
      if (error) throw new ApiError('Chaqiruv yuborib bo‘lmadi.', 500, 'duel_invite_failed');
      return duelSnapshot(data as DuelRow);
    }

    case 'duel.inbox': {
      const { data, error } = await serviceClient
        .from('duels')
        .select('*')
        .eq('guest_user_id', account.id)
        .eq('status', 'invited')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw new ApiError('Chaqiruvlarni yuklab bo‘lmadi.', 500, 'duel_inbox_failed');

      const invites: Array<{ duel: DuelRow; serverNow: number }> = [];
      for (const row of data ?? []) {
        const duel = await expireDuelIfNeeded(serviceClient, row as DuelRow);
        if (duel.status === 'invited') invites.push(duelSnapshot(duel));
      }
      return { invites };
    }

    case 'duel.respond': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const accept = payload.accept === true;
      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.guest_user_id !== account.id) {
        throw new ApiError('Bu chaqiruv sizga tegishli emas.', 403, 'duel_forbidden');
      }
      if (duel.status !== 'invited') {
        if (isActiveDuelStatus(duel.status) || duel.status === 'cancelled') return duelSnapshot(duel);
        throw new ApiError('Chaqiruv muddati tugagan.', 410, 'duel_expired');
      }

      const now = Date.now();
      const update = accept
        ? {
            status: 'ready_check',
            responded_at: new Date(now).toISOString(),
            ready_deadline_at: new Date(now + 20_000).toISOString(),
            expires_at: new Date(now + 30 * 60_000).toISOString(),
          }
        : {
            status: 'cancelled',
            responded_at: new Date(now).toISOString(),
            cancelled_at: new Date(now).toISOString(),
            cancelled_by: account.id,
          };

      const { data, error } = await serviceClient
        .from('duels')
        .update(update)
        .eq('id', duelId)
        .eq('status', 'invited')
        .eq('guest_user_id', account.id)
        .select('*')
        .maybeSingle();
      if (error || !data) throw new ApiError('Chaqiruvga javob berib bo‘lmadi.', 500, 'duel_respond_failed');
      duel = data as DuelRow;
      return duelSnapshot(duel);
    }

    case 'duel.create':
      throw new ApiError(
        'Eski duel havolalari o‘chirildi. Shashka yoki Tic Tac Toe ichidan do‘stingizni chaqiring.',
        410,
        'legacy_duel_disabled',
      );

    case 'duel.get': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const duel = await getDuelOrThrow(serviceClient, duelId);
      const isParticipant =
        duel.host_user_id === account.id ||
        duel.guest_user_id === account.id;
      const canJoin =
        duel.status === 'waiting' &&
        duel.guest_user_id === null;
      if (!isParticipant && !canJoin) {
        throw new ApiError(
          'Bu o‘yinga kirish mumkin emas.',
          403,
          'duel_forbidden',
        );
      }

      await persistFinishedDuelHistory(serviceClient, duel);
      await persistTicTacToeHistory(serviceClient, duel);
      await persistCheckersHistory(serviceClient, duel);
      return duelSnapshot(duel);
    }

    case 'duel.join': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'expired') throw new ApiError('Duel havolasi eskirgan.', 410, 'duel_expired');
      if (duel.host_user_id === account.id || duel.guest_user_id === account.id) return duelSnapshot(duel);
      if (duel.guest_user_id) throw new ApiError('Duelga boshqa o‘yinchi qo‘shilgan.', 409, 'duel_full');
      if (duel.status !== 'waiting') throw new ApiError('Duelga qo‘shilish vaqti tugagan.', 409, 'duel_not_joinable');

      const now = Date.now();
      const { data, error } = await serviceClient
        .from('duels')
        .update({
          guest_user_id: account.id,
          guest_name: account.display_name,
          status: 'ready_check',
          responded_at: new Date(now).toISOString(),
          ready_deadline_at: new Date(now + 20_000).toISOString(),
          expires_at: new Date(now + 30 * 60_000).toISOString(),
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
      if (duel.status === 'expired' || duel.status === 'cancelled') return duelSnapshot(duel);
      const role = resolveDuelRole(duel, account.id);
      if (duel.status !== 'ready_check') return duelSnapshot(duel);

      if (duel.ready_deadline_at && new Date(duel.ready_deadline_at).getTime() <= Date.now()) {
        duel = await expireDuelIfNeeded(serviceClient, duel);
        return duelSnapshot(duel);
      }

      const readyField = role === 'host' ? 'host_ready' : 'guest_ready';
      const { error } = await serviceClient
        .from('duels')
        .update({ [readyField]: true })
        .eq('id', duelId)
        .eq('status', 'ready_check');
      if (error) throw new ApiError('Tayyorlik holatini saqlab bo‘lmadi.', 500, 'duel_ready_failed');

      duel = await getDuelOrThrow(serviceClient, duelId);
      if (
        duel.status === 'ready_check' &&
        duel.host_ready &&
        duel.guest_ready
      ) {
        const now = Date.now();
        const gameStartAt = now + DUEL_COUNTDOWN_MS;
        const { data } = await serviceClient
          .from('duels')
          .update({
            status: 'countdown',
            countdown_start_at: new Date(now).toISOString(),
            game_start_at: new Date(gameStartAt).toISOString(),
            expires_at: new Date(now + 30 * 60_000).toISOString(),
            ...(duel.game_id === 'checkers'
              ? {
                  checkers_turn: 'host',
                  checkers_turn_deadline_at: new Date(
                    gameStartAt + CHECKERS_TURN_MS,
                  ).toISOString(),
                  checkers_position_history: {
                    [`${CHECKERS_INITIAL_BOARD}:host`]: 1,
                  },
                }
              : {}),
          })
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

    case 'duel.cancel': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const duel = await getDuelOrThrow(serviceClient, duelId);
      resolveDuelRole(duel, account.id);
      if (duel.status === 'finished' || duel.status === 'expired' || duel.status === 'cancelled') {
        return duelSnapshot(duel);
      }

      const now = new Date().toISOString();
      const { data, error } = await serviceClient
        .from('duels')
        .update({
          status: 'cancelled',
          cancelled_at: now,
          cancelled_by: account.id,
        })
        .eq('id', duelId)
        .in('status', ['waiting', 'invited', 'ready_check', 'countdown', 'playing'])
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError('O‘yinni bekor qilib bo‘lmadi.', 500, 'duel_cancel_failed');
      return duelSnapshot((data as DuelRow | null) ?? duel);
    }

    case 'duel.checkers_move': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const from = Number(payload.from);
      const to = Number(payload.to);

      if (
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 0 ||
        from > 31 ||
        to < 0 ||
        to > 31
      ) {
        throw new ApiError(
          'Shashka yurishi noto‘g‘ri.',
          400,
          'invalid_checkers_move',
        );
      }

      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.game_id !== 'checkers') {
        throw new ApiError(
          'Bu Shashka o‘yini emas.',
          400,
          'invalid_duel_game',
        );
      }

      const role = resolveDuelRole(duel, account.id);
      if (duel.status === 'finished' && duel.checkers_winner) {
        await persistCheckersHistory(serviceClient, duel);
        return duelSnapshot(duel);
      }

      if (
        duel.status !== 'playing' ||
        !duel.game_start_at ||
        Date.now() <
          new Date(duel.game_start_at).getTime() - 250
      ) {
        throw new ApiError(
          'O‘yin hali boshlanmagan.',
          409,
          'duel_not_started',
        );
      }

      if ((duel.checkers_turn ?? 'host') !== role) {
        throw new ApiError(
          'Hozir raqibning navbati.',
          409,
          'checkers_not_your_turn',
        );
      }

      duel = await resolveCheckersTimeoutIfNeeded(
        serviceClient,
        duel,
      );
      if (duel.status === 'finished') {
        return duelSnapshot(duel);
      }

      const currentBoardString =
        duel.checkers_board ?? CHECKERS_INITIAL_BOARD;
      const board = parseServerCheckersBoard(currentBoardString);
      const side = serverCheckersSideForRole(role);
      const forcedFrom = duel.checkers_forced_from ?? null;
      const legalMoves = serverCheckersLegalMoves(
        board,
        side,
        forcedFrom,
      );
      const move = legalMoves.find(
        (candidate) =>
          candidate.from === from &&
          candidate.to === to,
      );

      if (!move) {
        const captureRequired = legalMoves.some(
          (candidate) => candidate.captured !== null,
        );
        throw new ApiError(
          captureRequired
            ? 'Urish majburiy. Belgilangan donani uring.'
            : 'Bu yurishga ruxsat berilmaydi.',
          409,
          captureRequired
            ? 'checkers_capture_required'
            : 'checkers_illegal_move',
        );
      }

      const applied = applyServerCheckersMove(board, move);
      const nextBoardString = serializeServerCheckersBoard(
        applied.board,
      );
      const opponentRole =
        role === 'host' ? 'guest' : 'host';
      const opponentSide = serverCheckersSideForRole(
        opponentRole,
      );

      const furtherCaptures =
        move.captured !== null
          ? serverCheckersCapturesForPiece(
              applied.board,
              move.to,
            )
          : [];
      const continueCapture = furtherCaptures.length > 0;
      const completedMoves =
        (duel.checkers_moves ?? 0) +
        (continueCapture ? 0 : 1);
      const noProgressMoves =
        move.captured !== null || applied.promoted
          ? 0
          : (duel.checkers_no_progress_moves ?? 0) + 1;
      const hostCaptures =
        (duel.checkers_host_captures ?? 0) +
        (role === 'host' && move.captured !== null ? 1 : 0);
      const guestCaptures =
        (duel.checkers_guest_captures ?? 0) +
        (role === 'guest' && move.captured !== null ? 1 : 0);
      const hostPromotions =
        (duel.checkers_host_promotions ?? 0) +
        (role === 'host' && applied.promoted ? 1 : 0);
      const guestPromotions =
        (duel.checkers_guest_promotions ?? 0) +
        (role === 'guest' && applied.promoted ? 1 : 0);

      let winner: 'host' | 'guest' | 'draw' | null = null;
      let resultReason: string | null = null;
      let nextTurn: 'host' | 'guest' = continueCapture
        ? role
        : opponentRole;
      let nextForcedFrom: number | null = continueCapture
        ? move.to
        : null;

      const positionHistory =
        duel.checkers_position_history &&
        typeof duel.checkers_position_history === 'object'
          ? { ...duel.checkers_position_history }
          : {
              [`${currentBoardString}:${role}`]: 1,
            };

      if (!continueCapture) {
        const opponentPieces = serverCheckersCountPieces(
          applied.board,
          opponentSide,
        );
        const opponentMoves = serverCheckersLegalMoves(
          applied.board,
          opponentSide,
          null,
        );

        if (opponentPieces === 0) {
          winner = role;
          resultReason = 'all_captured';
        } else if (opponentMoves.length === 0) {
          winner = role;
          resultReason = 'no_moves';
        }

        const positionKey = `${nextBoardString}:${nextTurn}`;
        const positionCount =
          Number(positionHistory[positionKey] ?? 0) + 1;
        positionHistory[positionKey] = positionCount;

        if (!winner && positionCount >= 3) {
          winner = 'draw';
          resultReason = 'repetition';
        } else if (
          !winner &&
          noProgressMoves >= CHECKERS_NO_PROGRESS_LIMIT
        ) {
          winner = 'draw';
          resultReason = 'no_progress';
        } else if (
          !winner &&
          completedMoves >= CHECKERS_MOVE_LIMIT
        ) {
          winner = 'draw';
          resultReason = 'move_limit';
        }
      }

      const now = Date.now();
      const finished = winner !== null;
      const update = {
        checkers_board: nextBoardString,
        checkers_turn: nextTurn,
        checkers_winner: winner,
        checkers_result_reason: resultReason,
        checkers_moves: completedMoves,
        checkers_host_captures: hostCaptures,
        checkers_guest_captures: guestCaptures,
        checkers_host_promotions: hostPromotions,
        checkers_guest_promotions: guestPromotions,
        checkers_forced_from: finished
          ? null
          : nextForcedFrom,
        checkers_turn_deadline_at: finished
          ? null
          : continueCapture
            ? duel.checkers_turn_deadline_at
            : new Date(now + CHECKERS_TURN_MS).toISOString(),
        checkers_last_move_at: new Date(now).toISOString(),
        checkers_draw_offer_by: null,
        checkers_draw_offer_at: null,
        checkers_no_progress_moves: noProgressMoves,
        checkers_position_history: positionHistory,
        status: finished ? 'finished' : 'playing',
        finished_at: finished
          ? new Date(now).toISOString()
          : null,
        expires_at: new Date(now + 30 * 60_000).toISOString(),
      };

      const { data, error } = await serviceClient
        .from('duels')
        .update(update)
        .eq('id', duelId)
        .eq('status', 'playing')
        .eq('checkers_board', currentBoardString)
        .eq('checkers_turn', role)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new ApiError(
          'Shashka yurishini saqlab bo‘lmadi.',
          500,
          'checkers_move_failed',
        );
      }
      if (!data) {
        throw new ApiError(
          'Raqib oldinroq yurdi. Doska yangilandi.',
          409,
          'checkers_concurrent_move',
        );
      }

      duel = data as DuelRow;
      await persistCheckersHistory(serviceClient, duel);
      return duelSnapshot(duel);
    }

    case 'duel.checkers_resign': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.game_id !== 'checkers') {
        throw new ApiError(
          'Bu Shashka o‘yini emas.',
          400,
          'invalid_duel_game',
        );
      }

      const role = resolveDuelRole(duel, account.id);
      if (duel.status === 'finished' && duel.checkers_winner) {
        await persistCheckersHistory(serviceClient, duel);
        return duelSnapshot(duel);
      }
      if (duel.status !== 'playing') {
        throw new ApiError(
          'O‘yin hali boshlanmagan.',
          409,
          'duel_not_started',
        );
      }

      const winner = role === 'host' ? 'guest' : 'host';
      const now = new Date().toISOString();
      const { data, error } = await serviceClient
        .from('duels')
        .update({
          status: 'finished',
          checkers_winner: winner,
          checkers_result_reason: 'resign',
          finished_at: now,
          checkers_turn_deadline_at: null,
          checkers_draw_offer_by: null,
          checkers_draw_offer_at: null,
        })
        .eq('id', duelId)
        .eq('status', 'playing')
        .is('checkers_winner', null)
        .select('*')
        .maybeSingle();

      if (error) {
        throw new ApiError(
          'Taslim bo‘lishni saqlab bo‘lmadi.',
          500,
          'checkers_resign_failed',
        );
      }

      const resolved = (data as DuelRow | null) ?? duel;
      await persistCheckersHistory(serviceClient, resolved);
      return duelSnapshot(resolved);
    }

    case 'duel.checkers_offer_draw': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.game_id !== 'checkers') {
        throw new ApiError(
          'Bu Shashka o‘yini emas.',
          400,
          'invalid_duel_game',
        );
      }

      const role = resolveDuelRole(duel, account.id);
      if (duel.status !== 'playing' || duel.checkers_winner) {
        throw new ApiError(
          'Durrang taklifi uchun o‘yin faol bo‘lishi kerak.',
          409,
          'checkers_game_finished',
        );
      }
      if (duel.checkers_draw_offer_by) {
        throw new ApiError(
          'Durrang taklifi allaqachon yuborilgan.',
          409,
          'checkers_draw_offer_pending',
        );
      }

      const countField =
        role === 'host'
          ? 'checkers_host_draw_offers'
          : 'checkers_guest_draw_offers';
      const currentCount =
        role === 'host'
          ? duel.checkers_host_draw_offers ?? 0
          : duel.checkers_guest_draw_offers ?? 0;
      if (currentCount >= CHECKERS_DRAW_OFFER_LIMIT) {
        throw new ApiError(
          'Durrang taklifi limitiga yetdingiz.',
          429,
          'checkers_draw_offer_limit',
        );
      }

      const now = new Date().toISOString();
      const { data, error } = await serviceClient
        .from('duels')
        .update({
          checkers_draw_offer_by: role,
          checkers_draw_offer_at: now,
          [countField]: currentCount + 1,
        })
        .eq('id', duelId)
        .eq('status', 'playing')
        .is('checkers_draw_offer_by', null)
        .select('*')
        .maybeSingle();

      if (error || !data) {
        throw new ApiError(
          'Durrang taklifini yuborib bo‘lmadi.',
          500,
          'checkers_draw_offer_failed',
        );
      }

      return duelSnapshot(data as DuelRow);
    }

    case 'duel.checkers_draw_response': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const accept = payload.accept === true;
      const duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.game_id !== 'checkers') {
        throw new ApiError(
          'Bu Shashka o‘yini emas.',
          400,
          'invalid_duel_game',
        );
      }

      const role = resolveDuelRole(duel, account.id);
      const offerBy = duel.checkers_draw_offer_by;
      if (
        duel.status !== 'playing' ||
        !offerBy ||
        offerBy === role
      ) {
        throw new ApiError(
          'Javob beriladigan durrang taklifi topilmadi.',
          409,
          'checkers_draw_offer_not_found',
        );
      }

      const now = new Date().toISOString();
      const update = accept
        ? {
            status: 'finished',
            checkers_winner: 'draw',
            checkers_result_reason: 'draw_agreement',
            finished_at: now,
            checkers_turn_deadline_at: null,
            checkers_draw_offer_by: null,
            checkers_draw_offer_at: null,
          }
        : {
            checkers_draw_offer_by: null,
            checkers_draw_offer_at: null,
          };

      const { data, error } = await serviceClient
        .from('duels')
        .update(update)
        .eq('id', duelId)
        .eq('status', 'playing')
        .eq('checkers_draw_offer_by', offerBy)
        .select('*')
        .maybeSingle();

      if (error || !data) {
        throw new ApiError(
          'Durrang taklifiga javob berib bo‘lmadi.',
          500,
          'checkers_draw_response_failed',
        );
      }

      const resolved = data as DuelRow;
      await persistCheckersHistory(serviceClient, resolved);
      return duelSnapshot(resolved);
    }

    case 'duel.tic_move': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const cell = Math.round(Number(payload.cell));
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
        throw new ApiError('Katak noto‘g‘ri.', 400, 'invalid_tic_cell');
      }

      const { data, error } = await serviceClient.rpc('play_tic_tac_toe_move', {
        p_duel_id: duelId,
        p_user_id: account.id,
        p_cell: cell,
      });

      if (error) {
        const message = String(error.message ?? '');
        if (message.includes('not_your_turn')) {
          throw new ApiError('Hozir raqibning navbati.', 409, 'tic_not_your_turn');
        }
        if (message.includes('cell_occupied')) {
          throw new ApiError('Bu katak band.', 409, 'tic_cell_occupied');
        }
        if (message.includes('game_finished')) {
          throw new ApiError('O‘yin allaqachon yakunlangan.', 409, 'tic_game_finished');
        }
        if (message.includes('duel_forbidden')) {
          throw new ApiError('Bu o‘yin sizga tegishli emas.', 403, 'duel_forbidden');
        }
        throw new ApiError('Yurishni saqlab bo‘lmadi.', 500, 'tic_move_failed');
      }

      const duel = (Array.isArray(data) ? data[0] : data) as DuelRow | null;
      if (!duel) throw new ApiError('O‘yin topilmadi.', 404, 'duel_not_found');

      await persistTicTacToeHistory(serviceClient, duel);
      return duelSnapshot(duel);
    }

    case 'duel.submit': {
      const duelId = requireUuid(payload.duelId, 'duelId');
      const timeMs = Math.round(Number(payload.timeMs));
      if (!Number.isFinite(timeMs) || timeMs < 1 || timeMs > 60_000) {
        throw new ApiError('O‘yin natijasi noto‘g‘ri.', 400, 'invalid_duel_time');
      }

      let duel = await getDuelOrThrow(serviceClient, duelId);
      if (duel.status === 'expired' || duel.status === 'cancelled') {
        throw new ApiError('O‘yin yakunlangan yoki bekor qilingan.', 410, 'duel_expired');
      }
      const role = resolveDuelRole(duel, account.id);
      if (!['countdown', 'playing'].includes(duel.status) || !duel.game_start_at) {
        throw new ApiError('O‘yin hali boshlanmagan.', 409, 'duel_not_started');
      }

      if (Date.now() < new Date(duel.game_start_at).getTime() - 250) {
        throw new ApiError('O‘yin hali boshlanmagan.', 409, 'duel_not_started');
      }

      const timeField = role === 'host' ? 'host_time_ms' : 'guest_time_ms';
      const { error } = await serviceClient
        .from('duels')
        .update({ [timeField]: timeMs, status: 'playing' })
        .eq('id', duelId)
        .in('status', ['countdown', 'playing'])
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
