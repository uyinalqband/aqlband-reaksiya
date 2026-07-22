import { invokePlatformApi, PlatformApiError } from '@/lib/platformApi';
import type { DuelRole, DuelRow } from '@/types/duel';

export const DUEL_COUNTDOWN_MS = 5_000;

/** Monotonic epoch-like clock, resistant to system clock adjustments during a duel. */
export function clientEpochNow(): number {
  return typeof performance !== 'undefined' ? performance.timeOrigin + performance.now() : Date.now();
}

export interface DuelSnapshot {
  duel: DuelRow;
  serverNow: number;
}

/**
 * Contains both shapes: existing UI can read row.id directly, while newer
 * code can read result.duel and result.serverNow.
 */
export type DuelResult = DuelRow & DuelSnapshot;

function combine(snapshot: DuelSnapshot): DuelResult {
  return { ...snapshot.duel, ...snapshot };
}

async function invokeDuel(action: string, payload: Record<string, unknown> = {}): Promise<DuelResult> {
  const startedAt = clientEpochNow();
  const result = await invokePlatformApi<DuelSnapshot>(action, payload);
  const roundTripMs = clientEpochNow() - startedAt;
  return combine({ ...result, serverNow: result.serverNow + Math.round(roundTripMs / 2) });
}

/** Legacy host ID/name parameters are ignored; the server uses verified identity. */
export function createDuel(_legacyHostTelegramId?: number, _legacyHostName?: string): Promise<DuelResult> {
  return invokeDuel('duel.create');
}

export async function getDuel(duelId: string): Promise<DuelResult | null> {
  try {
    return await invokeDuel('duel.get', { duelId });
  } catch (error) {
    if (error instanceof PlatformApiError && error.code === 'duel_not_found') return null;
    throw error;
  }
}

/** Legacy guest ID/name parameters are ignored; the server uses verified identity. */
export function joinDuel(
  duelId: string,
  _legacyGuestTelegramId?: number,
  _legacyGuestName?: string,
): Promise<DuelResult> {
  return invokeDuel('duel.join', { duelId });
}

/** Legacy role parameter is ignored; the server derives the role. */
export function setReady(duelId: string, _legacyRole?: DuelRole): Promise<DuelResult> {
  return invokeDuel('duel.ready', { duelId });
}

export function submitDuelTime(duelId: string, timeMs: number): Promise<DuelResult>;
export function submitDuelTime(duelId: string, legacyRole: DuelRole, timeMs: number): Promise<DuelResult>;
export function submitDuelTime(
  duelId: string,
  roleOrTime: DuelRole | number,
  maybeTime?: number,
): Promise<DuelResult> {
  const timeMs = typeof roleOrTime === 'number' ? roleOrTime : maybeTime;
  if (typeof timeMs !== 'number') return Promise.reject(new Error('Reaksiya vaqti topilmadi.'));
  return invokeDuel('duel.submit', { duelId, timeMs });
}

/** Secure polling replaces the old publicly-readable Realtime table. */
export function subscribeToDuel(
  duelId: string,
  onChange: (result: DuelResult) => void,
  onError?: (error: unknown) => void,
): () => void {
  let stopped = false;
  let running = false;

  const refresh = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await getDuel(duelId);
      if (!stopped && result) onChange(result);
    } catch (error) {
      if (!stopped) onError?.(error);
    } finally {
      running = false;
    }
  };

  void refresh();
  const interval = window.setInterval(() => void refresh(), 900);
  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}
