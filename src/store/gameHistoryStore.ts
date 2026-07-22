import { create } from 'zustand';
import { storage } from '@/lib/telegram';

export type GameId = 'reaction' | 'emoji-find' | 'number-memory' | 'stroop-test' | 'duel-reaction';
export type GameMetric = 'duration_ms' | 'correct_count' | 'score';
export type AttemptMetaValue = string | number | boolean | null;

export interface GameAttempt {
  id: string;
  gameId: GameId;
  value: number;
  metric: GameMetric;
  meta?: Record<string, AttemptMetaValue>;
  playedAt: number;
}

export interface NewGameAttempt {
  id?: string;
  gameId: GameId;
  value: number;
  metric: GameMetric;
  meta?: Record<string, AttemptMetaValue>;
  playedAt?: number;
}

export interface ReactionStatsSnapshot {
  best: number | null;
  average: number | null;
  totalAttempts: number;
}

interface GameHistoryState {
  attempts: GameAttempt[];
  hydrated: boolean;
  scopeKey: string | null;
  serverGeneration: string | null;
  hydrate: (scopeKey: string) => Promise<void>;
  alignServerHistory: (generation: string, clearedAt: number, accountCreatedAt: number) => Promise<void>;
  addAttempt: (input: NewGameAttempt) => Promise<GameAttempt>;
  mergeRemote: (attempts: GameAttempt[]) => Promise<void>;
  reset: (scopeKey?: string | null, nextServerGeneration?: string | null) => Promise<void>;
}

const LEGACY_V2_MANIFEST_KEY = 'aqlband_game_history_v2_manifest';
const LEGACY_V2_CHUNK_PREFIX = 'aqlband_game_history_v2_chunk_';
const LEGACY_REACTION_KEY = 'aqlband_reaksiya_attempts_v1';
const LEGACY_GAMES_KEY = 'aqlband_game_stats_v1';
const MAX_HISTORY = 200;
const MAX_PER_GAME = 50;
const CHUNK_SIZE = 3_200;
const MAX_PERSISTED_CHUNKS = 64;

interface HistoryManifest {
  version: 3;
  chunks: number;
  serverGeneration?: string | null;
}

interface LegacyManifest {
  version: 2;
  chunks: number;
}

interface LegacyReactionAttempt {
  id: string;
  timeMs: number;
  playedAt: number;
}

interface LegacyGameAttempt {
  id: string;
  value: number;
  meta?: Record<string, number>;
  playedAt: number;
}

interface HydratedHistory {
  attempts: GameAttempt[];
  serverGeneration: string | null;
}

const hydrationPromises = new Map<string, Promise<HydratedHistory>>();
let persistQueue: Promise<void> = Promise.resolve();

function normalizeScope(scopeKey: string): string {
  const cleaned = scopeKey.trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return cleaned || 'guest';
}

function manifestKey(scopeKey: string): string {
  return `aqlband_game_history_v3_${normalizeScope(scopeKey)}_manifest`;
}

function chunkPrefix(scopeKey: string): string {
  return `aqlband_game_history_v3_${normalizeScope(scopeKey)}_chunk_`;
}

function queuePersist(scopeKey: string, attempts: GameAttempt[], serverGeneration: string | null): Promise<void> {
  const snapshot = [...attempts];
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(() => persistHistory(scopeKey, snapshot, serverGeneration));
  return persistQueue;
}

function createAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function isGameId(value: unknown): value is GameId {
  return (
    value === 'reaction' ||
    value === 'emoji-find' ||
    value === 'number-memory' ||
    value === 'stroop-test' ||
    value === 'duel-reaction'
  );
}

function isGameMetric(value: unknown): value is GameMetric {
  return value === 'duration_ms' || value === 'correct_count' || value === 'score';
}

function normalizeMeta(value: unknown): Record<string, AttemptMetaValue> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, AttemptMetaValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') result[key] = item;
    else if (typeof item === 'number' && Number.isFinite(item)) result[key] = item;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeAttempt(value: unknown): GameAttempt | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<GameAttempt>;
  if (
    typeof raw.id !== 'string' ||
    !raw.id ||
    !isGameId(raw.gameId) ||
    typeof raw.value !== 'number' ||
    !Number.isFinite(raw.value) ||
    !isGameMetric(raw.metric) ||
    typeof raw.playedAt !== 'number' ||
    !Number.isFinite(raw.playedAt)
  ) {
    return null;
  }

  const meta = normalizeMeta(raw.meta);
  if (raw.gameId === 'duel-reaction' && meta) delete meta.opponentName;

  return {
    id: raw.id,
    gameId: raw.gameId,
    value: Math.round(raw.value),
    metric: raw.metric,
    meta,
    playedAt: Math.round(raw.playedAt),
  };
}

function pruneHistory(attempts: GameAttempt[]): GameAttempt[] {
  const sorted = [...attempts].sort((left, right) => right.playedAt - left.playedAt || left.id.localeCompare(right.id));
  const perGameCount = new Map<GameId, number>();
  const seenIds = new Set<string>();
  const result: GameAttempt[] = [];

  for (const attempt of sorted) {
    if (seenIds.has(attempt.id)) continue;
    const count = perGameCount.get(attempt.gameId) ?? 0;
    if (count >= MAX_PER_GAME) continue;

    seenIds.add(attempt.id);
    perGameCount.set(attempt.gameId, count + 1);
    result.push(attempt);
    if (result.length >= MAX_HISTORY) break;
  }

  return result;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) chunks.push(value.slice(index, index + CHUNK_SIZE));
  return chunks.length > 0 ? chunks : ['[]'];
}

async function readChunks(manifestStorageKey: string, prefix: string, expectedVersion: 2 | 3): Promise<GameAttempt[] | null> {
  const rawManifest = await storage.get(manifestStorageKey);
  if (!rawManifest) return null;

  try {
    const manifest = JSON.parse(rawManifest) as HistoryManifest | LegacyManifest;
    if (manifest.version !== expectedVersion || !Number.isInteger(manifest.chunks) || manifest.chunks < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) => storage.get(`${prefix}${index}`)),
    );
    if (chunks.some((chunk) => chunk === null)) return null;

    const parsed = JSON.parse(chunks.join('')) as unknown[];
    return pruneHistory(parsed.map(normalizeAttempt).filter((attempt): attempt is GameAttempt => attempt !== null));
  } catch {
    return null;
  }
}

async function readPersistedHistory(
  scopeKey: string,
): Promise<{ attempts: GameAttempt[]; serverGeneration: string | null } | null> {
  const rawManifest = await storage.get(manifestKey(scopeKey));
  if (!rawManifest) return null;

  try {
    const manifest = JSON.parse(rawManifest) as HistoryManifest;
    if (manifest.version !== 3 || !Number.isInteger(manifest.chunks) || manifest.chunks < 1) return null;
    const prefix = chunkPrefix(scopeKey);
    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) => storage.get(`${prefix}${index}`)),
    );
    if (chunks.some((chunk) => chunk === null)) return null;
    const parsed = JSON.parse(chunks.join('')) as unknown[];
    const attempts = pruneHistory(
      parsed.map(normalizeAttempt).filter((attempt): attempt is GameAttempt => attempt !== null),
    );
    const serverGeneration =
      typeof manifest.serverGeneration === 'string' && manifest.serverGeneration.length <= 80
        ? manifest.serverGeneration
        : null;
    return { attempts, serverGeneration };
  } catch {
    return null;
  }
}

async function persistHistory(
  scopeKey: string,
  attempts: GameAttempt[],
  serverGeneration: string | null,
): Promise<void> {
  const key = manifestKey(scopeKey);
  const prefix = chunkPrefix(scopeKey);
  const previousManifestRaw = await storage.get(key);
  let previousChunkCount = 0;

  try {
    previousChunkCount = previousManifestRaw
      ? Math.max(0, Number((JSON.parse(previousManifestRaw) as HistoryManifest).chunks) || 0)
      : 0;
  } catch {
    previousChunkCount = 0;
  }

  const chunks = splitIntoChunks(JSON.stringify(attempts));
  await Promise.all(chunks.map((chunk, index) => storage.set(`${prefix}${index}`, chunk)));
  await storage.set(
    key,
    JSON.stringify({ version: 3, chunks: chunks.length, serverGeneration } satisfies HistoryManifest),
  );

  if (previousChunkCount > chunks.length) {
    await Promise.all(
      Array.from({ length: previousChunkCount - chunks.length }, (_, offset) =>
        storage.remove(`${prefix}${chunks.length + offset}`),
      ),
    );
  }
}

async function removeChunkedHistory(manifestStorageKey: string, prefix: string): Promise<void> {
  const rawManifest = await storage.get(manifestStorageKey);
  let chunks = 0;
  try {
    chunks = rawManifest ? Number((JSON.parse(rawManifest) as { chunks?: number }).chunks) || 0 : 0;
  } catch {
    chunks = 0;
  }

  const chunkKeys = Array.from(
    { length: Math.max(chunks, MAX_PERSISTED_CHUNKS) },
    (_, index) => `${prefix}${index}`,
  );
  await storage.removeMany([manifestStorageKey, ...chunkKeys]);
}

async function migrateLegacyHistory(scopeKey: string): Promise<GameAttempt[]> {
  const v2Attempts = await readChunks(LEGACY_V2_MANIFEST_KEY, LEGACY_V2_CHUNK_PREFIX, 2);
  if (v2Attempts !== null) {
    const result = pruneHistory(v2Attempts);
    await queuePersist(scopeKey, result, null);
    await removeChunkedHistory(LEGACY_V2_MANIFEST_KEY, LEGACY_V2_CHUNK_PREFIX);
    return result;
  }

  const [reactionRaw, gamesRaw] = await Promise.all([
    storage.get(LEGACY_REACTION_KEY),
    storage.get(LEGACY_GAMES_KEY),
  ]);
  const migrated: GameAttempt[] = [];

  try {
    const reactionAttempts = reactionRaw ? (JSON.parse(reactionRaw) as LegacyReactionAttempt[]) : [];
    for (const attempt of reactionAttempts) {
      if (!Number.isFinite(attempt.timeMs) || !Number.isFinite(attempt.playedAt)) continue;
      migrated.push({
        id: attempt.id || createAttemptId(),
        gameId: 'reaction',
        value: Math.round(attempt.timeMs),
        metric: 'duration_ms',
        meta: { mode: 'solo' },
        playedAt: attempt.playedAt,
      });
    }
  } catch {
    // Invalid legacy reaction history is ignored.
  }

  try {
    const gamesById = gamesRaw ? (JSON.parse(gamesRaw) as Record<string, LegacyGameAttempt[]>) : {};
    for (const [gameId, attempts] of Object.entries(gamesById)) {
      if (!isGameId(gameId) || gameId === 'reaction' || gameId === 'duel-reaction' || !Array.isArray(attempts)) continue;
      const metric: GameMetric = gameId === 'emoji-find' ? 'duration_ms' : gameId === 'number-memory' ? 'correct_count' : 'score';
      for (const attempt of attempts) {
        if (!Number.isFinite(attempt.value) || !Number.isFinite(attempt.playedAt)) continue;
        migrated.push({
          id: attempt.id || createAttemptId(),
          gameId,
          value: Math.round(attempt.value),
          metric,
          meta: normalizeMeta(attempt.meta),
          playedAt: Math.round(attempt.playedAt),
        });
      }
    }
  } catch {
    // Invalid legacy mini-game history is ignored.
  }

  const result = pruneHistory(migrated);
  await queuePersist(scopeKey, result, null);
  await Promise.all([storage.remove(LEGACY_REACTION_KEY), storage.remove(LEGACY_GAMES_KEY)]);
  return result;
}

export const useGameHistoryStore = create<GameHistoryState>((set, get) => ({
  attempts: [],
  hydrated: false,
  scopeKey: null,
  serverGeneration: null,

  hydrate: async (rawScopeKey) => {
    const scopeKey = normalizeScope(rawScopeKey);
    if (get().hydrated && get().scopeKey === scopeKey) return;

    set({ attempts: [], hydrated: false, scopeKey, serverGeneration: null });
    let promise = hydrationPromises.get(scopeKey);
    if (!promise) {
      promise = (async () => {
        const persisted = await readPersistedHistory(scopeKey);
        if (persisted !== null) return persisted;
        return { attempts: await migrateLegacyHistory(scopeKey), serverGeneration: null };
      })();
      hydrationPromises.set(scopeKey, promise);
    }

    try {
      const history = await promise;
      if (get().scopeKey === scopeKey) {
        set({
          attempts: history.attempts,
          serverGeneration: history.serverGeneration,
          hydrated: true,
        });
      }
    } catch {
      hydrationPromises.delete(scopeKey);
      if (get().scopeKey === scopeKey) set({ attempts: [], serverGeneration: null, hydrated: true });
    }
  },

  alignServerHistory: async (generation, clearedAt, accountCreatedAt) => {
    const scopeKey = get().scopeKey ?? 'guest';
    if (!generation || generation.length > 80 || get().serverGeneration === generation) return;

    const previousGeneration = get().serverGeneration;
    const cutoff = Math.max(
      Number.isFinite(clearedAt) ? clearedAt : 0,
      Number.isFinite(accountCreatedAt) ? accountCreatedAt : 0,
    );
    const nextAttempts =
      previousGeneration === null
        ? pruneHistory(get().attempts.filter((attempt) => attempt.playedAt > cutoff))
        : [];

    set({ attempts: nextAttempts, serverGeneration: generation });
    await queuePersist(scopeKey, nextAttempts, generation);
  },

  addAttempt: async (input) => {
    const meta = normalizeMeta(input.meta);
    if (input.gameId === 'duel-reaction' && meta) delete meta.opponentName;

    const attempt: GameAttempt = {
      id: input.id ?? createAttemptId(),
      gameId: input.gameId,
      value: Math.round(input.value),
      metric: input.metric,
      meta,
      playedAt: Math.round(input.playedAt ?? Date.now()),
    };

    const existing = get().attempts.find((item) => item.id === attempt.id);
    if (existing) return existing;

    const next = pruneHistory([attempt, ...get().attempts]);
    set({ attempts: next });
    await queuePersist(get().scopeKey ?? 'guest', next, get().serverGeneration);
    return attempt;
  },

  mergeRemote: async (remoteAttempts) => {
    const normalizedRemote = remoteAttempts
      .map(normalizeAttempt)
      .filter((attempt): attempt is GameAttempt => attempt !== null);
    const mergedById = new Map<string, GameAttempt>();
    for (const attempt of get().attempts) mergedById.set(attempt.id, attempt);
    for (const attempt of normalizedRemote) mergedById.set(attempt.id, attempt);
    const next = pruneHistory([...mergedById.values()]);

    const currentSignature = get().attempts.map((attempt) => `${attempt.id}:${attempt.value}:${attempt.playedAt}`).join('|');
    const nextSignature = next.map((attempt) => `${attempt.id}:${attempt.value}:${attempt.playedAt}`).join('|');
    if (currentSignature === nextSignature) return;

    set({ attempts: next });
    await queuePersist(get().scopeKey ?? 'guest', next, get().serverGeneration);
  },

  reset: async (requestedScopeKey, nextServerGeneration = null) => {
    await persistQueue.catch(() => undefined);
    const scopeKey = normalizeScope(requestedScopeKey ?? get().scopeKey ?? 'guest');
    hydrationPromises.delete(scopeKey);

    if (get().scopeKey === scopeKey) {
      set({ attempts: [], serverGeneration: nextServerGeneration });
    }

    if (nextServerGeneration) {
      await persistHistory(scopeKey, [], nextServerGeneration);
    } else {
      await removeChunkedHistory(manifestKey(scopeKey), chunkPrefix(scopeKey));
    }

    await Promise.all([storage.remove(LEGACY_REACTION_KEY), storage.remove(LEGACY_GAMES_KEY)]);
  },
}));

export function getAttemptsForGame(attempts: GameAttempt[], gameId: GameId): GameAttempt[] {
  return attempts.filter((attempt) => attempt.gameId === gameId);
}

export function getBestValue(attempts: GameAttempt[], gameId: GameId, lowerIsBetter: boolean): number | null {
  const values = attempts.filter((attempt) => attempt.gameId === gameId).map((attempt) => attempt.value);
  if (values.length === 0) return null;
  return lowerIsBetter ? Math.min(...values) : Math.max(...values);
}

export function computeReactionStats(attempts: GameAttempt[]): ReactionStatsSnapshot {
  const reactionValues = attempts
    .filter((attempt) => attempt.gameId === 'reaction')
    .map((attempt) => attempt.value);

  return {
    best: reactionValues.length > 0 ? Math.min(...reactionValues) : null,
    average: reactionValues.length > 0 ? Math.round(reactionValues.reduce((sum, value) => sum + value, 0) / reactionValues.length) : null,
    totalAttempts: reactionValues.length,
  };
}
