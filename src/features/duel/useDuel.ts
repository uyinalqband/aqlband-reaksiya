import { useCallback, useEffect, useRef, useState } from 'react';
import type { DuelRole, DuelRow } from '@/types/duel';
import {
  cancelDuel,
  getDuel,
  joinDuel,
  setReady,
  subscribeToDuel,
  clientEpochNow,
} from '@/services/duelService';

interface UseDuelResult {
  duel: DuelRow | null;
  loading: boolean;
  error: string | null;
  markReady: () => Promise<void>;
  cancel: () => Promise<void>;
  serverOffsetMs: number;
}

export function useDuel(
  duelId: string | null,
  role: DuelRole | null,
  myTelegramId: number | null,
  myName: string,
): UseDuelResult {
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
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
          const current = await getDuel(duelId);
          if (current?.status === 'waiting' && current.guest_user_id === null) {
            hasJoinedRef.current = true;
            row = await joinDuel(duelId, myTelegramId, myName);
          } else {
            row = current;
          }
        } else {
          row = await getDuel(duelId);
        }

        if (!cancelled) {
          if (!row) setError("O'yin topilmadi.");
          setDuel(row);
          if (row && 'serverNow' in row && typeof row.serverNow === 'number') {
            setServerOffsetMs(row.serverNow - clientEpochNow());
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nimadir xato ketdi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubscribe = subscribeToDuel(
      duelId,
      (row) => {
        if (!cancelled) {
          setDuel(row);
          setServerOffsetMs(row.serverNow - clientEpochNow());
          setError(null);
        }
      },
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ulanishda xato yuz berdi.");
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [duelId, role, myTelegramId, myName]);

  const markReady = useCallback(async () => {
    if (!duelId || !role) return;
    try {
      const result = await setReady(duelId, role);
      setDuel(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nimadir xato ketdi.");
    }
  }, [duelId, role]);

  const cancel = useCallback(async () => {
    if (!duelId) return;
    try {
      const result = await cancelDuel(duelId);
      setDuel(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'yinni bekor qilib bo'lmadi.");
    }
  }, [duelId]);

  return { duel, loading, error, markReady, cancel, serverOffsetMs };
}
