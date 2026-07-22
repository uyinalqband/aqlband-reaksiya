import { create } from 'zustand';
import { storage } from '@/lib/telegram';
import type { AppAccount } from '@/types/account';

const rankStorageKey = (accountId: string) => `aqlband_last_rank_v2_${accountId}`;

interface OnlineState {
  account: AppAccount | null;
  lastKnownRank: number | null;
  accountDeleted: boolean;
  setAccount: (account: AppAccount) => Promise<void>;
  updateRank: (newRank: number | null) => Promise<number | null>;
  updateHistoryState: (historyGeneration: string, historyClearedAt: number) => void;
  clearAccount: (markDeleted?: boolean) => Promise<void>;
  setAccountDeletionBlocked: (blocked: boolean) => void;
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  account: null,
  lastKnownRank: null,
  accountDeleted: false,

  setAccount: async (account) => {
    if (get().accountDeleted) return;
    let lastKnownRank: number | null = null;
    try {
      const raw = await storage.get(rankStorageKey(account.id));
      const parsed = raw === null ? null : Number(raw);
      lastKnownRank = parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } catch {
      lastKnownRank = null;
    }
    set({ account, lastKnownRank });
  },

  updateHistoryState: (historyGeneration, historyClearedAt) => {
    const account = get().account;
    if (!account) return;
    set({ account: { ...account, historyGeneration, historyClearedAt } });
  },

  updateRank: async (newRank) => {
    const previous = get().lastKnownRank;
    const account = get().account;
    set({ lastKnownRank: newRank });

    if (account) {
      if (newRank === null) await storage.remove(rankStorageKey(account.id));
      else await storage.set(rankStorageKey(account.id), String(newRank));
    }
    return previous;
  },

  setAccountDeletionBlocked: (blocked) => set({ accountDeleted: blocked }),

  clearAccount: async (markDeleted = false) => {
    const account = get().account;
    if (account) await storage.remove(rankStorageKey(account.id));
    set({ account: null, lastKnownRank: null, accountDeleted: markDeleted || get().accountDeleted });
  },
}));
