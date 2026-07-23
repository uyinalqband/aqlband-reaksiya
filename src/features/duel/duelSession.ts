import type { GameSessionConfig, SoloGameId } from '@/features/gameSession/config';
import { isGameSessionConfig } from '@/features/gameSession/config';
import type { DuelGameContext, DuelRole } from '@/types/duel';

const GAME_PATHS: Record<SoloGameId, string> = {
  reaction: '/games/reaction',
  'emoji-find': '/games/emoji',
  'number-memory': '/games/number-memory',
  'stroop-test': '/games/stroop',
};

export function gamePath(gameId: SoloGameId): string {
  return GAME_PATHS[gameId];
}

export function makeDuelGameState(context: DuelGameContext) {
  return { duelGame: context };
}

function isDuelRole(value: unknown): value is DuelRole {
  return value === 'host' || value === 'guest';
}

function isSoloGameId(value: unknown): value is SoloGameId {
  return value === 'reaction' || value === 'emoji-find' || value === 'number-memory' || value === 'stroop-test';
}

export function readDuelGameContext(
  value: unknown,
  expectedGameId?: SoloGameId,
): DuelGameContext | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as { duelGame?: unknown };
  if (!state.duelGame || typeof state.duelGame !== 'object') return null;
  const raw = state.duelGame as Partial<DuelGameContext> & { config?: GameSessionConfig };

  if (
    typeof raw.duelId !== 'string' ||
    !raw.duelId ||
    !isDuelRole(raw.role) ||
    !isSoloGameId(raw.gameId) ||
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
