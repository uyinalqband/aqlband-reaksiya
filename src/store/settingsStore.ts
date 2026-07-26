import { create } from '@/lib/zustand';
import i18n, { type SupportedLanguage, DEFAULT_LANGUAGE } from '@/i18n';
import { storage } from '@/lib/telegram';

const STORAGE_KEY = 'aqlband_reaksiya_settings_v1';

interface PersistedSettings {
  language: SupportedLanguage;
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  hapticsEnabled: boolean;
}

interface SettingsState extends PersistedSettings {
  hydrated: boolean;
  hydrate: (detectedLanguage: SupportedLanguage) => Promise<void>;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleSound: () => Promise<void>;
  toggleMusic: () => Promise<void>;
  setMusicVolume: (volume: number) => Promise<void>;
  toggleHaptics: () => Promise<void>;
}

const DEFAULTS: PersistedSettings = {
  language: DEFAULT_LANGUAGE,
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.38,
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
        const saved = JSON.parse(raw) as Partial<PersistedSettings>;
        const merged: PersistedSettings = {
          ...DEFAULTS,
          ...saved,
          musicVolume:
            typeof saved.musicVolume === 'number'
              ? Math.max(0, Math.min(1, saved.musicVolume))
              : DEFAULTS.musicVolume,
        };
        set({ ...merged, hydrated: true });
        void i18n.changeLanguage(merged.language);
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
    await persist({
      language,
      soundEnabled: get().soundEnabled,
      musicEnabled: get().musicEnabled,
      musicVolume: get().musicVolume,
      hapticsEnabled: get().hapticsEnabled,
    });
  },

  toggleSound: async () => {
    const soundEnabled = !get().soundEnabled;
    set({ soundEnabled });
    await persist({
      language: get().language,
      soundEnabled,
      musicEnabled: get().musicEnabled,
      musicVolume: get().musicVolume,
      hapticsEnabled: get().hapticsEnabled,
    });
  },

  toggleMusic: async () => {
    const musicEnabled = !get().musicEnabled;
    set({ musicEnabled });
    await persist({
      language: get().language,
      soundEnabled: get().soundEnabled,
      musicEnabled,
      musicVolume: get().musicVolume,
      hapticsEnabled: get().hapticsEnabled,
    });
  },

  setMusicVolume: async (volume) => {
    const musicVolume = Math.max(0, Math.min(1, volume));
    set({ musicVolume });
    await persist({
      language: get().language,
      soundEnabled: get().soundEnabled,
      musicEnabled: get().musicEnabled,
      musicVolume,
      hapticsEnabled: get().hapticsEnabled,
    });
  },

  toggleHaptics: async () => {
    const hapticsEnabled = !get().hapticsEnabled;
    set({ hapticsEnabled });
    await persist({
      language: get().language,
      soundEnabled: get().soundEnabled,
      musicEnabled: get().musicEnabled,
      musicVolume: get().musicVolume,
      hapticsEnabled,
    });
  },
}));
