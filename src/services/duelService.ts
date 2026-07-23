import { invokePlatformApi, PlatformApiError } from '@/lib/platformApi';
import type { GameSessionConfig, SoloGameId } from '@/features/gameSession/config';
import type { DuelRole, DuelRow, IncomingDuelInvite } from '@/types/duel';

export const DUEL_COUNTDOWN_MS = 5_000;
export const DUEL_READY_TIMEOUT_MS = 20_000;

export function clientEpochNow(): number {
  return typeof performance !== 'undefined' ? performance.timeOrigin + performance.now() : Date.now();
}

export interface DuelSnapshot {
  duel: DuelRow;
  serverNow: number;
}

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

export function createDuel(
  targetUserId: string,
  gameId: SoloGameId,
  config: GameSessionConfig,
): Promise<DuelResult> {
  return invokeDuel('duel.invite', {
    targetUserId,
    gameId,
    rounds: config.rounds,
    difficulty: config.difficulty,
  });
}

export async function getIncomingDuelInvites(): Promise<IncomingDuelInvite[]> {
  const result = await invokePlatformApi<{ invites: IncomingDuelInvite[] }>('duel.inbox');
  return result.invites;
}

export function respondDuelInvite(duelId: string, accept: boolean): Promise<DuelResult> {
  return invokeDuel('duel.respond', { duelId, accept });
}

export async function getDuel(duelId: string): Promise<DuelResult | null> {
  try {
    return await invokeDuel('duel.get', { duelId });
  } catch (error) {
    if (error instanceof PlatformApiError && error.code === 'duel_not_found') return null;
    throw error;
  }
}

/** Kept for old deep links; direct friend invitations do not call this. */
export function joinDuel(
  duelId: string,
  _legacyGuestTelegramId?: number,
  _legacyGuestName?: string,
): Promise<DuelResult> {
  return invokeDuel('duel.join', { duelId });
}

export function setReady(duelId: string, _legacyRole?: DuelRole): Promise<DuelResult> {
  return invokeDuel('duel.ready', { duelId });
}

export function cancelDuel(duelId: string): Promise<DuelResult> {
  return invokeDuel('duel.cancel', { duelId });
}

export function submitDuelTime(duelId: string, timeMs: number): Promise<DuelResult>;
export function submitDuelTime(duelId: string, legacyRole: DuelRole, timeMs: number): Promise<DuelResult>;
export function submitDuelTime(
  duelId: string,
  roleOrTime: DuelRole | number,
  maybeTime?: number,
): Promise<DuelResult> {
  const timeMs = typeof roleOrTime === 'number' ? roleOrTime : maybeTime;
  if (typeof timeMs !== 'number') return Promise.reject(new Error('O‘yin natijasi topilmadi.'));
  return invokeDuel('duel.submit', { duelId, timeMs });
}

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
  const interval = window.setInterval(() => void refresh(), 650);
  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}
