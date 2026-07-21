import { useCallback, useEffect, useRef, useState } from 'react';
import type { DuelRole, DuelRow } from '@/types/duel';
import { getDuel, joinDuel, setReady, submitDuelTime, subscribeToDuel } from '@/services/duelService';

interface UseDuelResult {
  duel: DuelRow | null;
  loading: boolean;
  error: string | null;
  markReady: () => Promise<void>;
  submitTime: (timeMs: number) => Promise<void>;
}

/**
 * Loads a duel (joining as guest on first mount if applicable), keeps it
 * live via Realtime, and exposes the two player actions. One hook instance
 * per DuelScreen mount — the guest-join call is guarded to fire only once
 * even under React StrictMode's double-invoke.
 */
export function useDuel(
  duelId: string | null,
  role: DuelRole | null,
  myTelegramId: number | null,
  myName: string,
): UseDuelResult {
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!duelId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        let row: DuelRow | null;
        if (role === 'guest' && myTelegramId !== null && !hasJoinedRef.current) {
          hasJoinedRef.current = true;
          row = await joinDuel(duelId, myTelegramId, myName);
        } else {
          row = await getDuel(duelId);
        }
        if (!cancelled) {
          if (!row) setError("O'yin topilmadi.");
          setDuel(row);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nimadir xato ketdi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubscribe = subscribeToDuel(duelId, (row) => {
      if (!cancelled) setDuel(row);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [duelId, role, myTelegramId, myName]);

  const markReady = useCallback(async () => {
    if (!duelId || !role) return;
    try {
      await setReady(duelId, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nimadir xato ketdi.");
    }
  }, [duelId, role]);

  const submitTime = useCallback(
    async (timeMs: number) => {
      if (!duelId || !role) return;
      try {
        await submitDuelTime(duelId, role, timeMs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nimadir xato ketdi.");
      }
    },
    [duelId, role],
  );

  return { duel, loading, error, markReady, submitTime };
}
