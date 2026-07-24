import { GAME_IDS, getGameDefinition } from '@/features/games/catalog';
import type { GameSessionConfig } from '@/features/games/session/config';
import { isGameSessionConfig } from '@/features/games/session/config';
import type { DuelGameContext, DuelGameId, DuelRole } from '@/types/duel';

export function gamePath(gameId: DuelGameId): string {
  return getGameDefinition(gameId)?.route ?? '/';
}

export function makeDuelGameState(context: DuelGameContext) {
  return { duelGame: context };
}

function isDuelRole(value: unknown): value is DuelRole {
  return value === 'host' || value === 'guest';
}

function isDuelGameId(value: unknown): value is DuelGameId {
  return typeof value === 'string' && (GAME_IDS as readonly string[]).includes(value);
}

export function readDuelGameContext(
  value: unknown,
  expectedGameId?: DuelGameId,
): DuelGameContext | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as { duelGame?: unknown };
  if (!state.duelGame || typeof state.duelGame !== 'object') return null;
  const raw = state.duelGame as Partial<DuelGameContext> & { config?: GameSessionConfig };

  if (
    typeof raw.duelId !== 'string' ||
    !raw.duelId ||
    !isDuelRole(raw.role) ||
    !isDuelGameId(raw.gameId) ||
    !isGameSessionConfig(raw.config) ||
    typeof raw.opponentName !== 'string'
  ) {
    return null;
  }
  if (expectedGameId && raw.gameId !== expectedGameId) return null;

  return {
    duelId: raw.duelId,
    role: raw.role,
    gameId: raw.gameId,
    config: raw.config,
    opponentName: raw.opponentName,
  };
}
