import { create } from 'zustand';
import { storage } from '@/lib/telegram';

export interface GameAttempt {
  id: string;
  /** Primary metric for this game session — meaning depends on the game (ms, correct count, points). */
  value: number;
  meta?: Record<string, number>;
  playedAt: number;
}

interface GameStatsState {
  attemptsByGame: Record<string, GameAttempt[]>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addAttempt: (gameId: string, value: number, meta?: Record<string, number>) => Promise<void>;
}

const STORAGE_KEY = 'aqlband_game_stats_v1';
const MAX_PER_GAME = 50;

/**
 * Generic local (offline-first) stats store shared by every mini-game in
 * the hub (Emoji Find, Number Memory, Stroop Test, and future additions).
 * Each game just calls addAttempt(gameId, summaryValue) once per completed
 * session — the meaning of `value` (lower-is-better ms, or higher-is-better
 * score) is decided by each screen when it reads the data back out via
 * getBestValue().
 */
export const useGameStatsStore = create<GameStatsState>((set, get) => ({
  attemptsByGame: {},
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await storage.get(STORAGE_KEY);
      const attemptsByGame = raw ? JSON.parse(raw) : {};
      set({ attemptsByGame, hydrated: true });
    } catch {
      set({ attemptsByGame: {}, hydrated: true });
    }
  },

  addAttempt: async (gameId, value, meta) => {
    const attempt: GameAttempt = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      value,
      meta,
      playedAt: Date.now(),
    };
    const current = get().attemptsByGame[gameId] ?? [];
    const next = [attempt, ...current].slice(0, MAX_PER_GAME);
    const attemptsByGame = { ...get().attemptsByGame, [gameId]: next };
    set({ attemptsByGame });
    await storage.set(STORAGE_KEY, JSON.stringify(attemptsByGame));
  },
}));

export function getBestValue(attempts: GameAttempt[], lowerIsBetter: boolean): number | null {
  if (attempts.length === 0) return null;
  const values = attempts.map((a) => a.value);
  return lowerIsBetter ? Math.min(...values) : Math.max(...values);
}
