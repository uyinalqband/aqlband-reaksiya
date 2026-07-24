import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import uz from './locales/uz.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['uz', 'en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'uz';

const resources = {
  uz: { translation: uz },
  en: { translation: en },
  ru: { translation: ru },
};

/**
 * Normalizes any BCP-47 language code (e.g. "ru-RU", "en-US") down to one
 * of our supported base languages, falling back to the app default.
 */
export function normalizeLanguage(code?: string | null): SupportedLanguage {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.toLowerCase().split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // Telegram's own language hint is applied explicitly in src/app/App.tsx
    // once the SDK reports initData; this detector only covers the
    // non-Telegram (plain browser) fallback path.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'aqlband_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
  });

export default i18n;
