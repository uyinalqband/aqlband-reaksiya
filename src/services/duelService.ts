import { invokePlatformApi } from '@/lib/platformApi';
import type { DuelRow } from '@/types/duel';

export const DUEL_COUNTDOWN_MS = 5_000;

/** Monotonic epoch-like clock, resistant to system clock adjustments during a duel. */
export function clientEpochNow(): number {
  return typeof performance !== 'undefined'
    ? performance.timeOrigin + performance.now()
    : Date.now();
}

export interface DuelSnapshot {
  duel: DuelRow;
  /** Estimated current server time at response receipt. */
  serverNow: number;
}

async function invokeDuel(action: string, payload: Record<string, unknown> = {}): Promise<DuelSnapshot> {
  const startedAt = clientEpochNow();
  const result = await invokePlatformApi<DuelSnapshot>(action, payload);
  const roundTripMs = clientEpochNow() - startedAt;
  return { ...result, serverNow: result.serverNow + Math.round(roundTripMs / 2) };
}

export function createDuel(): Promise<DuelSnapshot> {
  return invokeDuel('duel.create');
}

export function getDuel(duelId: string): Promise<DuelSnapshot> {
  return invokeDuel('duel.get', { duelId });
}

export function joinDuel(duelId: string): Promise<DuelSnapshot> {
  return invokeDuel('duel.join', { duelId });
}

export function setReady(duelId: string): Promise<DuelSnapshot> {
  return invokeDuel('duel.ready', { duelId });
}

export function submitDuelTime(duelId: string, timeMs: number): Promise<DuelSnapshot> {
  return invokeDuel('duel.submit', { duelId, timeMs });
}

/** Secure polling replaces the old publicly-readable Realtime table. */
export function subscribeToDuel(
  duelId: string,
  onChange: (snapshot: DuelSnapshot) => void,
  onError?: (error: unknown) => void,
): () => void {
  let stopped = false;
  let running = false;

  const refresh = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const snapshot = await getDuel(duelId);
      if (!stopped) onChange(snapshot);
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      running = false;
    }
  };

  const interval = window.setInterval(() => void refresh(), 900);
  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}
