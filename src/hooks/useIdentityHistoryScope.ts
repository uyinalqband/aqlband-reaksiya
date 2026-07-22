import { useEffect } from 'react';
import { getLocalIdentityScope } from '@/lib/platformApi';
import { supabase } from '@/lib/supabaseClient';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';

/** Keeps local history isolated and aligned with the active provider account. */
export function useIdentityHistoryScope(enabled: boolean): void {
  const account = useOnlineStore((state) => state.account);
  const hydrate = useGameHistoryStore((state) => state.hydrate);
  const alignServerHistory = useGameHistoryStore((state) => state.alignServerHistory);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refresh = async () => {
      const scope = await getLocalIdentityScope();
      if (cancelled) return;
      await hydrate(scope);
      if (!cancelled && account) {
        await alignServerHistory(account.historyGeneration, account.historyClearedAt, account.createdAt);
      }
    };

    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => void refresh());
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [enabled, account, hydrate, alignServerHistory]);
}
