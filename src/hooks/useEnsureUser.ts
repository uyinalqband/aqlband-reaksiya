import { useEffect } from 'react';
import { ensureUser } from '@/services/userService';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { hasOnlineCredential } from '@/lib/platformApi';

/** Creates/refreshes only the verified provider-neutral account. */
export function useEnsureUser(enabled: boolean): void {
  const setAccount = useOnlineStore((state) => state.setAccount);
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
        if (!cancelled) await setAccount(account);
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
  }, [enabled, accountDeleted, setAccount, clearAccount]);
}
