import { useEffect } from 'react';
import { ensureUser } from '@/services/userService';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { AppUser } from '@/types';

/**
 * Registers/refreshes the current Telegram user in Supabase. Best-effort:
 * if Supabase is unreachable or unconfigured, the game must keep working
 * exactly as before (local-only) — this never throws into the caller.
 */
export function useEnsureUser(telegramUser: AppUser | null): void {
  const setIdentity = useOnlineStore((s) => s.setIdentity);

  useEffect(() => {
    if (!telegramUser || !isSupabaseConfigured) return;

    let cancelled = false;

    void ensureUser({
      telegramId: telegramUser.id,
      username: telegramUser.username ?? null,
      firstName: telegramUser.firstName,
    })
      .then((row) => {
        if (!cancelled) setIdentity(row.id, row.telegram_id);
      })
      .catch((error: unknown) => {
        console.error('useEnsureUser: ensureUser failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [telegramUser, setIdentity]);
}
