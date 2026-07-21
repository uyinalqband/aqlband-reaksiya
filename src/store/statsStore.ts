import { create } from 'zustand';
import type { Attempt, StatsSnapshot } from '@/types';
import { average } from '@/features/game/logic';
import { storage } from '@/lib/telegram';

const STORAGE_KEY = 'aqlband_reaksiya_attempts_v1';
const MAX_HISTORY = 50;

interface StatsState {
  attempts: Attempt[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addAttempt: (timeMs: number) => Promise<Attempt>;
  reset: () => Promise<void>;
}

function persist(attempts: Attempt[]): Promise<void> {
  return storage.set(STORAGE_KEY, JSON.stringify(attempts));
}

/**
 * Pure derivation of stats from an attempts list. Deliberately NOT a store
 * method: a Zustand selector must return a stable reference across calls
 * when the underlying state hasn't changed, or React's
 * useSyncExternalStore will see a "new" value on every render and loop
 * forever (React error #185). Call this via useMemo in components instead,
 * keyed on the `attempts` array reference.
 */
export function computeStatsSnapshot(attempts: Attempt[]): StatsSnapshot {
  if (attempts.length === 0) {
    return { best: null, average: null, totalAttempts: 0 };
  }
  const times = attempts.map((a) => a.timeMs);
  return {
    best: Math.min(...times),
    average: average(times),
    totalAttempts: attempts.length,
  };
}

export const useStatsStore = create<StatsState>((set, get) => ({
  attempts: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await storage.get(STORAGE_KEY);
      const attempts: Attempt[] = raw ? JSON.parse(raw) : [];
      set({ attempts, hydrated: true });
    } catch {
      set({ attempts: [], hydrated: true });
    }
  },

  addAttempt: async (timeMs: number) => {
    const attempt: Attempt = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      timeMs: Math.round(timeMs),
      playedAt: Date.now(),
    };
    const next = [attempt, ...get().attempts].slice(0, MAX_HISTORY);
    set({ attempts: next });
    await persist(next);
    return attempt;
  },

  reset: async () => {
    set({ attempts: [] });
    await persist([]);
  },
}));
