import { useMemo } from 'react';
import type { AppUser } from '@/types';
import { getTelegramUser } from '@/lib/telegram';

/** Resolves the launching Telegram user once; identity is stable for the session. */
export function useTelegramUser(): AppUser | null {
  return useMemo(() => getTelegramUser(), []);
}
