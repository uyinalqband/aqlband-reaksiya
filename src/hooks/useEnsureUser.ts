import { useEffect } from 'react';
import { ensureUser } from '@/services/userService';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { hasOnlineCredential } from '@/lib/platformApi';
import { useIdentityHistoryScope } from '@/hooks/useIdentityHistoryScope';
import { useHistorySync } from '@/hooks/useHistorySync';
import type { AppUser } from '@/types';

function legacyNumericId(accountId: string): number {
  let hash = 0;
  for (let index = 0; index < accountId.length; index += 1) {
    hash = (hash * 31 + accountId.charCodeAt(index)) | 0;
  }
  return Math.max(1, Math.abs(hash));
}

/**
 * Secure account bootstrap with backward compatibility for the existing App.tsx.
 * It also activates provider-scoped history and server synchronization.
 */
export function useEnsureUser(input: boolean | AppUser | null): void {
  const telegramUser = typeof input === 'object' && input !== null ? input : null;
  const enabled = typeof input === 'boolean' ? input : telegramUser !== null;

  useIdentityHistoryScope(enabled);
  useHistorySync();

  const setAccount = useOnlineStore((state) => state.setAccount);
  const setIdentity = useOnlineStore((state) => state.setIdentity);
  const clearAccount = useOnlineStore((state) => state.clearAccount);
  const accountDeleted = useOnlineStore((state) => state.accountDeleted);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || accountDeleted) return;

    let cancelled = false;
    let controller = new AbortController();

    const refresh = async () => {
      try {
        if (!(await hasOnlineCredential())) {
          if (!cancelled) await clearAccount(false);
          return;
        }

        controller.abort();
        controller = new AbortController();
        const account = await ensureUser(controller.signal);
        if (cancelled) return;

        await setAccount(account);
        const numericId = telegramUser?.id ?? legacyNumericId(account.id);
        setIdentity(account.id, numericId);
      } catch (error) {
        if (!cancelled && !(error instanceof Error && 'code' in error && error.code === 'request_aborted')) {
          console.error('Account initialization failed', error);
        }
      }
    };

    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      controller.abort();
      data.subscription.unsubscribe();
    };
  }, [enabled, telegramUser, accountDeleted, setAccount, setIdentity, clearAccount]);
}
