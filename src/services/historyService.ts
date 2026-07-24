import { invokePlatformApi } from '@/lib/platformApi';
import type { GameAttempt, GameId } from '@/store/gameHistoryStore';

export interface HistorySyncResult {
  attempts: GameAttempt[];
  historyGeneration: string;
  historyClearedAt: number;
}

export interface MiniGameCompletion {
  id: string;
  gameId: GameId;
  playedAt: number;
}

export interface CompletionAwardResult {
  awardedXp: number;
  processed: number;
}

export const XP_ONLY_GAME_IDS = [
  'reaction',
  'emoji-find',
  'number-memory',
  'stroop-test',
  'ascending-numbers',
  'odd-one-out',
  'pattern-memory',
  'go-no-go',
  'mental-math',
  'sequence-memory',
  'card-memory',
  'time-estimation',
  'peripheral-vision',
  'twenty-four',
  'dual-n-back',
  'fifteen-puzzle',
  'sudoku',
] as const satisfies readonly GameId[];

const XP_ONLY_GAME_ID_SET = new Set<GameId>(XP_ONLY_GAME_IDS);

export function isXpOnlyGameId(gameId: GameId): boolean {
  return XP_ONLY_GAME_ID_SET.has(gameId);
}

/**
 * Sends only a completion ID, game ID and time. Score, milliseconds,
 * mistakes and other mini-game result details never leave the device.
 */
export async function awardMiniGameCompletions(
  completions: MiniGameCompletion[],
  signal?: AbortSignal,
): Promise<CompletionAwardResult> {
  return invokePlatformApi<CompletionAwardResult>(
    'progression.award_completions',
    { completions },
    { signal },
  );
}

/** Legacy compatibility only. The server no longer stores mini-game rows. */
export async function syncGameHistory(
  attempts: GameAttempt[],
  historyGeneration: string,
  signal?: AbortSignal,
): Promise<HistorySyncResult> {
  return invokePlatformApi<HistorySyncResult>(
    'history.sync',
    { attempts, historyGeneration },
    { signal },
  );
}

export async function clearOnlineGameHistory(): Promise<
  HistorySyncResult & { cleared: boolean }
> {
  return invokePlatformApi<HistorySyncResult & { cleared: boolean }>(
    'history.clear',
  );
}
