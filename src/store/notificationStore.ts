import { create } from '@/lib/zustand';
import { storage } from '@/lib/telegram';

export type NotificationKind = 'friend' | 'game';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: number;
  actionId?: string;
  read: boolean;
}

interface PersistedNotifications {
  items: AppNotification[];
  dismissedIds: string[];
}

const KEY = 'aqlband_notifications_v2';

interface State extends PersistedNotifications {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (item: Omit<AppNotification, 'read'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const persist = (state: PersistedNotifications) =>
  storage.set(KEY, JSON.stringify({
    items: state.items.slice(0, 50),
    dismissedIds: state.dismissedIds.slice(0, 200),
  }));

export const useNotificationStore = create<State>((set, get) => ({
  items: [],
  dismissedIds: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await storage.get(KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedNotifications> | AppNotification[];
      if (Array.isArray(parsed)) {
        set({ items: parsed, dismissedIds: [], hydrated: true });
      } else {
        set({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
          hydrated: true,
        });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  upsert: async (item) => {
    if (get().dismissedIds.includes(item.id)) return;
    const current = get().items.find((entry) => entry.id === item.id);
    const items = [
      { ...item, read: current?.read ?? false },
      ...get().items.filter((entry) => entry.id !== item.id),
    ].slice(0, 50);
    set({ items });
    await persist({ items, dismissedIds: get().dismissedIds });
  },

  remove: async (id) => {
    const items = get().items.filter((entry) => entry.id !== id);
    const dismissedIds = [id, ...get().dismissedIds.filter((entry) => entry !== id)].slice(0, 200);
    set({ items, dismissedIds });
    await persist({ items, dismissedIds });
  },

  markRead: async (id) => {
    const items = get().items.map((entry) => entry.id === id ? { ...entry, read: true } : entry);
    set({ items });
    await persist({ items, dismissedIds: get().dismissedIds });
  },

  clear: async () => {
    const dismissedIds = [
      ...get().items.map((entry) => entry.id),
      ...get().dismissedIds,
    ].filter((id, index, array) => array.indexOf(id) === index).slice(0, 200);
    set({ items: [], dismissedIds });
    await persist({ items: [], dismissedIds });
  },
}));
