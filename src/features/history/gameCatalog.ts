import { formatMs } from '@/features/gameSession/metrics';
import type { GameAttempt, GameId } from '@/store/gameHistoryStore';

interface GameDefinition {
  title: string;
  emoji: string;
}

export const GAME_CATALOG: Record<GameId, GameDefinition> = {
  reaction: { title: 'Reaksiya', emoji: '⚡' },
  'emoji-find': { title: 'Emoji', emoji: '🍎' },
  'number-memory': { title: 'Memory', emoji: '🧠' },
  'stroop-test': { title: 'Stroop', emoji: '🌈' },
  'duel-reaction': { title: 'Duel', emoji: '⚔️' },
};

export function formatAttemptResult(attempt: GameAttempt): string {
  switch (attempt.metric) {
    case 'duration_ms':
      return `${formatMs(attempt.value)} ms`;
    case 'correct_count': {
      const rounds = typeof attempt.meta?.rounds === 'number' ? attempt.meta.rounds : 5;
      return `${attempt.value}/${rounds}`;
    }
    case 'score':
      return `${Math.round(attempt.value).toLocaleString('en-US')} ball`;
  }
}
