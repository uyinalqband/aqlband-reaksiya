import { create } from 'zustand';
import { storage } from '@/lib/telegram';

const RANK_STORAGE_KEY = 'aqlband_reaksiya_last_rank_v1';

interface OnlineState {
  /** `users.id` (uuid) once ensureUser() has resolved for this session. Null until then. */
  appUserId: string | null;
  telegramId: number | null;
  /** World rank as of the last time it was fetched (Home mount or after a save). */
  lastKnownRank: number | null;
  hydrated: boolean;

  setIdentity: (appUserId: string, telegramId: number) => void;
  hydrateLastKnownRank: () => Promise<void>;
  /** Updates the cached rank and persists it. Returns the previous value for comparison. */
  updateRank: (newRank: number | null) => Promise<number | null>;
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  appUserId: null,
  telegramId: null,
  lastKnownRank: null,
  hydrated: false,

  setIdentity: (appUserId, telegramId) => set({ appUserId, telegramId }),

  hydrateLastKnownRank: async () => {
    if (get().hydrated) return;
    try {
      const raw = await storage.get(RANK_STORAGE_KEY);
      set({ lastKnownRank: raw ? Number(raw) : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  updateRank: async (newRank) => {
    const previous = get().lastKnownRank;
    set({ lastKnownRank: newRank });
    if (newRank !== null) {
      await storage.set(RANK_STORAGE_KEY, String(newRank));
    }
    return previous;
  },
}));
