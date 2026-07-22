import { create } from 'zustand';
import { average } from '@/features/game/logic';
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
  hydrate: () => Promise<void>;
  addAttempt: (input: NewGameAttempt) => Promise<GameAttempt>;
  reset: () => Promise<void>;
}

const STORAGE_MANIFEST_KEY = 'aqlband_game_history_v2_manifest';
const STORAGE_CHUNK_PREFIX = 'aqlband_game_history_v2_chunk_';
const LEGACY_REACTION_KEY = 'aqlband_reaksiya_attempts_v1';
const LEGACY_GAMES_KEY = 'aqlband_game_stats_v1';
const MAX_HISTORY = 200;
const MAX_PER_GAME = 50;
const CHUNK_SIZE = 3_200;

interface HistoryManifest {
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

let hydrationPromise: Promise<GameAttempt[]> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function queuePersist(attempts: GameAttempt[]): Promise<void> {
  persistQueue = persistQueue.catch(() => undefined).then(() => persistHistory(attempts));
  return persistQueue;
}

function createAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
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

function normalizeAttempt(value: unknown): GameAttempt | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<GameAttempt>;
  if (
    typeof raw.id !== 'string' ||
    !isGameId(raw.gameId) ||
    typeof raw.value !== 'number' ||
    !Number.isFinite(raw.value) ||
    !isGameMetric(raw.metric) ||
    typeof raw.playedAt !== 'number' ||
    !Number.isFinite(raw.playedAt)
  ) {
    return null;
  }
  return {
    id: raw.id,
    gameId: raw.gameId,
    value: raw.value,
    metric: raw.metric,
    meta: raw.meta,
    playedAt: raw.playedAt,
  };
}

function pruneHistory(attempts: GameAttempt[]): GameAttempt[] {
  const sorted = [...attempts].sort((a, b) => b.playedAt - a.playedAt);
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
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    chunks.push(value.slice(index, index + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : ['[]'];
}

async function readPersistedHistory(): Promise<GameAttempt[] | null> {
  const rawManifest = await storage.get(STORAGE_MANIFEST_KEY);
  if (!rawManifest) return null;

  try {
    const manifest = JSON.parse(rawManifest) as HistoryManifest;
    if (manifest.version !== 2 || !Number.isInteger(manifest.chunks) || manifest.chunks < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) => storage.get(`${STORAGE_CHUNK_PREFIX}${index}`)),
    );
    if (chunks.some((chunk) => chunk === null)) return null;

    const parsed = JSON.parse(chunks.join('')) as unknown[];
    return pruneHistory(parsed.map(normalizeAttempt).filter((attempt): attempt is GameAttempt => attempt !== null));
  } catch {
    return null;
  }
}

async function persistHistory(attempts: GameAttempt[]): Promise<void> {
  const previousManifestRaw = await storage.get(STORAGE_MANIFEST_KEY);
  let previousChunkCount = 0;
  try {
    previousChunkCount = previousManifestRaw
      ? Math.max(0, Number((JSON.parse(previousManifestRaw) as HistoryManifest).chunks) || 0)
      : 0;
  } catch {
    previousChunkCount = 0;
  }

  const chunks = splitIntoChunks(JSON.stringify(attempts));
  await Promise.all(chunks.map((chunk, index) => storage.set(`${STORAGE_CHUNK_PREFIX}${index}`, chunk)));
  await storage.set(STORAGE_MANIFEST_KEY, JSON.stringify({ version: 2, chunks: chunks.length } satisfies HistoryManifest));

  if (previousChunkCount > chunks.length) {
    await Promise.all(
      Array.from({ length: previousChunkCount - chunks.length }, (_, offset) =>
        storage.remove(`${STORAGE_CHUNK_PREFIX}${chunks.length + offset}`),
      ),
    );
  }
}

async function migrateLegacyHistory(): Promise<GameAttempt[]> {
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
    // Invalid legacy reaction history is ignored without blocking the app.
  }

  try {
    const gamesById = gamesRaw
      ? (JSON.parse(gamesRaw) as Record<string, LegacyGameAttempt[]>)
      : {};
    for (const [gameId, attempts] of Object.entries(gamesById)) {
      if (!isGameId(gameId) || gameId === 'reaction' || gameId === 'duel-reaction' || !Array.isArray(attempts)) continue;
      const metric: GameMetric = gameId === 'emoji-find' ? 'duration_ms' : gameId === 'number-memory' ? 'correct_count' : 'score';
      for (const attempt of attempts) {
        if (!Number.isFinite(attempt.value) || !Number.isFinite(attempt.playedAt)) continue;
        migrated.push({
          id: attempt.id || createAttemptId(),
          gameId,
          value: attempt.value,
          metric,
          meta: attempt.meta,
          playedAt: attempt.playedAt,
        });
      }
    }
  } catch {
    // Invalid legacy mini-game history is ignored without blocking the app.
  }

  const result = pruneHistory(migrated);
  await queuePersist(result);
  await Promise.all([storage.remove(LEGACY_REACTION_KEY), storage.remove(LEGACY_GAMES_KEY)]);
  return result;
}

export const useGameHistoryStore = create<GameHistoryState>((set, get) => ({
  attempts: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;

    hydrationPromise ??= (async () => {
      const persisted = await readPersistedHistory();
      if (persisted !== null) return persisted;
      return migrateLegacyHistory();
    })();

    try {
      const attempts = await hydrationPromise;
      set({ attempts, hydrated: true });
    } catch {
      hydrationPromise = null;
      set({ attempts: [], hydrated: true });
    }
  },

  addAttempt: async (input) => {
    const attempt: GameAttempt = {
      id: input.id ?? createAttemptId(),
      gameId: input.gameId,
      value: input.value,
      metric: input.metric,
      meta: input.meta,
      playedAt: input.playedAt ?? Date.now(),
    };

    const existing = get().attempts.find((item) => item.id === attempt.id);
    if (existing) return existing;

    const next = pruneHistory([attempt, ...get().attempts]);
    set({ attempts: next });
    await queuePersist(next);
    return attempt;
  },

  reset: async () => {
    await persistQueue.catch(() => undefined);
    const rawManifest = await storage.get(STORAGE_MANIFEST_KEY);
    let chunkCount = 0;
    try {
      chunkCount = rawManifest ? Number((JSON.parse(rawManifest) as HistoryManifest).chunks) || 0 : 0;
    } catch {
      chunkCount = 0;
    }

    set({ attempts: [] });
    await Promise.all([
      storage.remove(STORAGE_MANIFEST_KEY),
      storage.remove(LEGACY_REACTION_KEY),
      storage.remove(LEGACY_GAMES_KEY),
      ...Array.from({ length: chunkCount }, (_, index) => storage.remove(`${STORAGE_CHUNK_PREFIX}${index}`)),
    ]);
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

  if (reactionValues.length === 0) {
    return { best: null, average: null, totalAttempts: 0 };
  }

  return {
    best: Math.min(...reactionValues),
    average: average(reactionValues),
    totalAttempts: reactionValues.length,
  };
}
