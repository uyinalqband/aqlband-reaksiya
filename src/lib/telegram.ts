import type { AppUser } from '@/types';

export function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

/** True only for a real Telegram launch, not merely because the bridge script loaded. */
export function isInsideTelegram(): boolean {
  const webApp = getWebApp();
  return Boolean(webApp?.initData && webApp.initDataUnsafe?.user);
}

export function getTelegramInitData(): string {
  return getWebApp()?.initData?.trim() ?? '';
}

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
    // Older Telegram clients can safely continue without optional methods.
  }
}

export function closeTelegramApp(): void {
  try {
    getWebApp()?.close();
  } catch {
    // Closing is optional; the deleted-account screen remains usable.
  }
}

export function getTelegramUser(): AppUser | null {
  const raw = getWebApp()?.initDataUnsafe?.user;
  if (!raw || !getTelegramInitData()) return null;

  return {
    id: raw.id,
    firstName: raw.first_name,
    username: raw.username,
    languageCode: raw.language_code,
  };
}

export function getTelegramLanguageCode(): string | undefined {
  return getTelegramUser()?.languageCode;
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

export function shareChallenge(botUsername: string, startParam: string, text: string): void {
  const deepLink = `https://t.me/${botUsername}/app?startapp=${encodeURIComponent(startParam)}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;

  const webApp = getWebApp();
  if (isInsideTelegram() && webApp) {
    webApp.openTelegramLink(shareUrl);
  } else if (typeof window !== 'undefined') {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
}

export function getStartParam(): string | null {
  const fromSdk = getWebApp()?.initDataUnsafe?.start_param;
  if (fromSdk) return fromSdk;

  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp');
    if (fromQuery) return fromQuery;

    const match = window.location.hash.match(/(?:^|[&#])tgWebAppStartParam=([^&]+)/);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  } catch {
    return null;
  }
}

const CLOUD_STORAGE_TIMEOUT_MS = 2500;

interface CloudResult<T> {
  ok: boolean;
  value: T;
}

function withTimeout<T>(executor: (resolve: (value: CloudResult<T>) => void) => void, fallback: T): Promise<CloudResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, value: fallback });
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

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
}

function localRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
}

/** Telegram CloudStorage with a local, account-scoped backup/fallback. */
export const storage = {
  async get(key: string): Promise<string | null> {
    const webApp = getWebApp();
    if (isInsideTelegram() && webApp?.CloudStorage) {
      const result = await withTimeout<string | null>((resolve) => {
        try {
          webApp.CloudStorage!.getItem(key, (error, value) => {
            resolve({ ok: !error, value: error ? null : (value ?? null) });
          });
        } catch {
          resolve({ ok: false, value: null });
        }
      }, null);

      if (result.ok && result.value !== null) {
        localSet(key, result.value);
        return result.value;
      }
    }
    return localGet(key);
  },

  async set(key: string, value: string): Promise<void> {
    localSet(key, value);
    const webApp = getWebApp();
    if (isInsideTelegram() && webApp?.CloudStorage) {
      await withTimeout<void>((resolve) => {
        try {
          webApp.CloudStorage!.setItem(key, value, (error) => resolve({ ok: !error, value: undefined }));
        } catch {
          resolve({ ok: false, value: undefined });
        }
      }, undefined);
    }
  },

  async remove(key: string): Promise<void> {
    await this.removeMany([key]);
  },

  async removeMany(keys: string[]): Promise<void> {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    uniqueKeys.forEach(localRemove);
    if (uniqueKeys.length === 0) return;

    const webApp = getWebApp();
    const cloudStorage = isInsideTelegram() ? webApp?.CloudStorage : undefined;
    if (!cloudStorage) return;

    await withTimeout<void>((resolve) => {
      try {
        if (cloudStorage.removeItems) {
          cloudStorage.removeItems(uniqueKeys, (error) => resolve({ ok: !error, value: undefined }));
          return;
        }

        let remaining = uniqueKeys.length;
        let failed = false;
        for (const key of uniqueKeys) {
          cloudStorage.removeItem(key, (error) => {
            failed ||= Boolean(error);
            remaining -= 1;
            if (remaining === 0) resolve({ ok: !failed, value: undefined });
          });
        }
      } catch {
        resolve({ ok: false, value: undefined });
      }
    }, undefined);
  },
};
