import { useEffect, useRef } from 'react';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { syncGameHistory } from '@/services/historyService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getLocalIdentityScope } from '@/lib/platformApi';

function signature(attempts: ReturnType<typeof useGameHistoryStore.getState>['attempts']): string {
  return attempts.map((item) => `${item.id}:${item.value}:${item.playedAt}`).join('|');
}

/** Best-effort two-way history sync. Local play always continues when offline. */
export function useHistorySync(): void {
  const account = useOnlineStore((state) => state.account);
  const accountDeleted = useOnlineStore((state) => state.accountDeleted);
  const updateHistoryState = useOnlineStore((state) => state.updateHistoryState);
  const attempts = useGameHistoryStore((state) => state.attempts);
  const hydrated = useGameHistoryStore((state) => state.hydrated);
  const scopeKey = useGameHistoryStore((state) => state.scopeKey);
  const serverGeneration = useGameHistoryStore((state) => state.serverGeneration);
  const alignServerHistory = useGameHistoryStore((state) => state.alignServerHistory);
  const mergeRemote = useGameHistoryStore((state) => state.mergeRemote);
  const lastCompletedRef = useRef<{ accountId: string; scopeKey: string; signature: string } | null>(null);

  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !account ||
      accountDeleted ||
      !hydrated ||
      !scopeKey ||
      serverGeneration !== account.historyGeneration
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void (async () => {
        const expectedScope = await getLocalIdentityScope();
        if (cancelled || expectedScope !== scopeKey) return;

        const currentSignature = signature(attempts);
        const previous = lastCompletedRef.current;
        if (previous?.accountId === account.id && previous.scopeKey === scopeKey && previous.signature === currentSignature) {
          return;
        }

        try {
          const result = await syncGameHistory(attempts, account.historyGeneration, controller.signal);
          if (cancelled || useGameHistoryStore.getState().scopeKey !== scopeKey) return;

          updateHistoryState(result.historyGeneration, result.historyClearedAt);
          await alignServerHistory(result.historyGeneration, result.historyClearedAt, account.createdAt);
          if (cancelled || useGameHistoryStore.getState().scopeKey !== scopeKey) return;

          await mergeRemote(result.attempts);
          if (!cancelled) {
            lastCompletedRef.current = {
              accountId: account.id,
              scopeKey,
              signature: signature(useGameHistoryStore.getState().attempts),
            };
          }
        } catch (error) {
          if (!cancelled && !(error instanceof Error && 'code' in error && error.code === 'request_aborted')) {
            console.error('History sync failed', error);
          }
        }
      })();
    }, 600);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    account,
    accountDeleted,
    attempts,
    hydrated,
    scopeKey,
    serverGeneration,
    updateHistoryState,
    alignServerHistory,
    mergeRemote,
  ]);
}
