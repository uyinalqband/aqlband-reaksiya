import { invokePlatformApi } from '@/lib/platformApi';
import type { GameAttempt } from '@/store/gameHistoryStore';

export interface HistorySyncResult {
  attempts: GameAttempt[];
  historyGeneration: string;
  historyClearedAt: number;
}

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

export async function clearOnlineGameHistory(): Promise<HistorySyncResult & { cleared: boolean }> {
  return invokePlatformApi<HistorySyncResult & { cleared: boolean }>('history.clear');
}
