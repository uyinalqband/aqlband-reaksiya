import { create } from 'zustand';
import { storage } from '@/lib/telegram';
import type { AppAccount } from '@/types/account';

const rankStorageKey = (accountId: string) => `aqlband_last_rank_v2_${accountId}`;

interface OnlineState {
  account: AppAccount | null;
  lastKnownRank: number | null;
  accountDeleted: boolean;

  /** Legacy aliases kept so the existing screens do not need to be rewritten. */
  appUserId: string | null;
  telegramId: number | null;
  hydrated: boolean;

  setAccount: (account: AppAccount) => Promise<void>;
  setIdentity: (appUserId: string, telegramId: number) => void;
  hydrateLastKnownRank: () => Promise<void>;
  updateRank: (newRank: number | null) => Promise<number | null>;
  updateHistoryState: (historyGeneration: string, historyClearedAt: number) => void;
  clearAccount: (markDeleted?: boolean) => Promise<void>;
  setAccountDeletionBlocked: (blocked: boolean) => void;
}

async function readRank(accountId: string | null): Promise<number | null> {
  if (!accountId) return null;
  try {
    const raw = await storage.get(rankStorageKey(accountId));
    const parsed = raw === null ? null : Number(raw);
    return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  account: null,
  lastKnownRank: null,
  accountDeleted: false,
  appUserId: null,
  telegramId: null,
  hydrated: false,

  setAccount: async (account) => {
    if (get().accountDeleted) return;
    const lastKnownRank = await readRank(account.id);
    set({
      account,
      appUserId: account.id,
      lastKnownRank,
      hydrated: true,
    });
  },

  setIdentity: (appUserId, telegramId) => {
    if (get().accountDeleted) return;
    set({ appUserId, telegramId });
  },

  hydrateLastKnownRank: async () => {
    if (get().hydrated) return;
    const accountId = get().account?.id ?? get().appUserId;
    const lastKnownRank = await readRank(accountId);
    set({ lastKnownRank, hydrated: true });
  },

  updateHistoryState: (historyGeneration, historyClearedAt) => {
    const account = get().account;
    if (!account) return;
    set({ account: { ...account, historyGeneration, historyClearedAt } });
  },

  updateRank: async (newRank) => {
    const previous = get().lastKnownRank;
    const accountId = get().account?.id ?? get().appUserId;
    set({ lastKnownRank: newRank, hydrated: true });

    if (accountId) {
      if (newRank === null) await storage.remove(rankStorageKey(accountId));
      else await storage.set(rankStorageKey(accountId), String(newRank));
    }
    return previous;
  },

  setAccountDeletionBlocked: (blocked) => set({ accountDeleted: blocked }),

  clearAccount: async (markDeleted = false) => {
    const accountId = get().account?.id ?? get().appUserId;
    if (accountId) await storage.remove(rankStorageKey(accountId));
    set({
      account: null,
      appUserId: null,
      telegramId: null,
      lastKnownRank: null,
      hydrated: true,
      accountDeleted: markDeleted || get().accountDeleted,
    });
  },
}));
