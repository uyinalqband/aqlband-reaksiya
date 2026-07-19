import type { AppUser } from '@/types';

/**
 * Returns the native Telegram WebApp bridge, or `undefined` when the app is
 * running outside Telegram (plain browser during development/preview).
 * Every consumer of the bridge must go through this so the app degrades
 * gracefully instead of throwing when opened outside Telegram.
 */
export function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

export function isInsideTelegram(): boolean {
  return Boolean(getWebApp());
}

/** Call once on app boot: signals readiness and expands to full height. */
export function initTelegramApp(): void {
  const webApp = getWebApp();
  if (!webApp) return;

  try {
    webApp.ready();
    webApp.expand();
    webApp.disableVerticalSwipes?.();
    webApp.setHeaderColor?.('#120C24');
    webApp.setBackgroundColor?.('#120C24');
  } catch {
    /* older/unsupported Telegram client — app still works without these */
  }
}

export function getTelegramUser(): AppUser | null {
  const raw = getWebApp()?.initDataUnsafe?.user;
  if (!raw) return null;

  return {
    id: raw.id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    username: raw.username,
    languageCode: raw.language_code,
    photoUrl: raw.photo_url,
    isPremium: raw.is_premium,
  };
}

export function getTelegramLanguageCode(): string | undefined {
  return getWebApp()?.initDataUnsafe?.user?.language_code;
}

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

export const haptics = {
  impact(style: ImpactStyle = 'medium'): void {
    getWebApp()?.HapticFeedback?.impactOccurred?.(style);
  },
  success(): void {
    getWebApp()?.HapticFeedback?.notificationOccurred?.('success');
  },
  error(): void {
    getWebApp()?.HapticFeedback?.notificationOccurred?.('error');
  },
  warning(): void {
    getWebApp()?.HapticFeedback?.notificationOccurred?.('warning');
  },
  selection(): void {
    getWebApp()?.HapticFeedback?.selectionChanged?.();
  },
};

/** Opens the native Telegram share sheet pre-filled with a challenge link. */
export function shareChallenge(botUsername: string, startParam: string, text: string): void {
  const deepLink = `https://t.me/${botUsername}/app?startapp=${encodeURIComponent(startParam)}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;

  const webApp = getWebApp();
  if (webApp) {
    webApp.openTelegramLink(shareUrl);
  } else if (typeof window !== 'undefined') {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
}

/** Reads the `startapp` payload used for challenge deep links. */
export function getStartParam(): string | null {
  const fromSdk = getWebApp()?.initDataUnsafe?.start_param;
  if (fromSdk) return fromSdk;

  // Fallback for plain-browser preview (Telegram script not present / not launched via deep link).
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp');
  if (fromQuery) return fromQuery;

  const match = window.location.hash.match(/tgWebAppStartParam=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const CLOUD_STORAGE_TIMEOUT_MS = 2500;

/** Wraps a callback-style call in a promise that resolves with `fallback` if it never calls back in time. */
function withTimeout<T>(executor: (resolve: (value: T) => void) => void, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, CLOUD_STORAGE_TIMEOUT_MS);

    executor((value) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }
    });
  });
}

/** Minimal persistent key-value store: uses Telegram CloudStorage when available, else localStorage. */
export const storage = {
  async get(key: string): Promise<string | null> {
    const webApp = getWebApp();
    if (webApp?.CloudStorage) {
      return withTimeout<string | null>((resolve) => {
        try {
          webApp.CloudStorage!.getItem(key, (err, value) => {
            resolve(err ? null : (value ?? null));
          });
        } catch {
          resolve(null);
        }
      }, null);
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    const webApp = getWebApp();
    if (webApp?.CloudStorage) {
      await withTimeout<void>((resolve) => {
        try {
          webApp.CloudStorage!.setItem(key, value, () => resolve());
        } catch {
          resolve();
        }
      }, undefined);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable — silently no-op */
    }
  },
  async remove(key: string): Promise<void> {
    const webApp = getWebApp();
    if (webApp?.CloudStorage) {
      await withTimeout<void>((resolve) => {
        try {
          webApp.CloudStorage!.removeItem(key, () => resolve());
        } catch {
          resolve();
        }
      }, undefined);
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable — silently no-op */
    }
  },
};
