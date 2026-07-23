import { create } from '@/lib/zustand';
import i18n, { type SupportedLanguage, DEFAULT_LANGUAGE } from '@/i18n';
import { storage } from '@/lib/telegram';

const STORAGE_KEY = 'aqlband_reaksiya_settings_v1';

interface PersistedSettings {
  language: SupportedLanguage;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  hydrate: (detectedLanguage: SupportedLanguage) => Promise<void>;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleSound: () => Promise<void>;
  toggleHaptics: () => Promise<void>;
}

const DEFAULTS: PersistedSettings = {
  language: DEFAULT_LANGUAGE,
  soundEnabled: true,
  hapticsEnabled: true,
};

function persist(state: PersistedSettings): Promise<void> {
  return storage.set(STORAGE_KEY, JSON.stringify(state));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async (detectedLanguage) => {
    if (get().hydrated) return;
    try {
      const raw = await storage.get(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedSettings;
        set({ ...saved, hydrated: true });
        void i18n.changeLanguage(saved.language);
      } else {
        // First launch: honor Telegram's reported language, then persist it
        // so future launches don't re-detect (respects manual overrides).
        set({ language: detectedLanguage, hydrated: true });
        void i18n.changeLanguage(detectedLanguage);
        await persist({ ...DEFAULTS, language: detectedLanguage });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setLanguage: async (language) => {
    set({ language });
    void i18n.changeLanguage(language);
    await persist({ language, soundEnabled: get().soundEnabled, hapticsEnabled: get().hapticsEnabled });
  },

  toggleSound: async () => {
    const soundEnabled = !get().soundEnabled;
    set({ soundEnabled });
    await persist({ language: get().language, soundEnabled, hapticsEnabled: get().hapticsEnabled });
  },

  toggleHaptics: async () => {
    const hapticsEnabled = !get().hapticsEnabled;
    set({ hapticsEnabled });
    await persist({ language: get().language, soundEnabled: get().soundEnabled, hapticsEnabled });
  },
}));
