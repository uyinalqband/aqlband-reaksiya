import { useEffect, useRef } from 'react';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import {
  awardMiniGameCompletions,
  isXpOnlyGameId,
  type MiniGameCompletion,
} from '@/services/historyService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getLocalIdentityScope } from '@/lib/platformApi';

function completionList(
  attempts: ReturnType<typeof useGameHistoryStore.getState>['attempts'],
): MiniGameCompletion[] {
  return attempts
    .filter((attempt) => isXpOnlyGameId(attempt.gameId))
    .map((attempt) => ({
      id: attempt.id,
      gameId: attempt.gameId,
      playedAt: attempt.playedAt,
    }));
}

function signature(completions: MiniGameCompletion[]): string {
  return completions
    .map((item) => `${item.id}:${item.gameId}:${item.playedAt}`)
    .join('|');
}

/**
 * XP-only synchronization. Mini-game milliseconds, scores, errors and meta
 * remain local and are never written to Supabase.
 */
export function useHistorySync(): void {
  const account = useOnlineStore((state) => state.account);
  const accountDeleted = useOnlineStore((state) => state.accountDeleted);
  const attempts = useGameHistoryStore((state) => state.attempts);
  const hydrated = useGameHistoryStore((state) => state.hydrated);
  const scopeKey = useGameHistoryStore((state) => state.scopeKey);
  const lastCompletedRef = useRef<{
    accountId: string;
    scopeKey: string;
    signature: string;
  } | null>(null);

  useEffect(() => {
    if (
      !isSupabaseConfigured ||
      !account ||
      accountDeleted ||
      !hydrated ||
      !scopeKey
    ) {
      return;
    }

    const completions = completionList(attempts);
    const currentSignature = signature(completions);
    const previous = lastCompletedRef.current;
    if (
      previous?.accountId === account.id &&
      previous.scopeKey === scopeKey &&
      previous.signature === currentSignature
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void (async () => {
        const expectedScope = await getLocalIdentityScope();
        if (cancelled || expectedScope !== scopeKey) return;

        try {
          if (completions.length > 0) {
            await awardMiniGameCompletions(completions, controller.signal);
          }
          if (!cancelled) {
            lastCompletedRef.current = {
              accountId: account.id,
              scopeKey,
              signature: currentSignature,
            };
          }
        } catch (error) {
          if (
            !cancelled &&
            !(
              error instanceof Error &&
              'code' in error &&
              error.code === 'request_aborted'
            )
          ) {
            console.error('Mini-game XP sync failed', error);
          }
        }
      })();
    }, 600);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [account, accountDeleted, attempts, hydrated, scopeKey]);
}
