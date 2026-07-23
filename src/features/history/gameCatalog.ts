import { formatMs } from '@/features/games/session/metrics';
import { getGameDefinition } from '@/features/games/catalog';
import type { GameAttempt, GameId } from '@/store/gameHistoryStore';

const LEGACY: Partial<Record<GameId,{title:string;emoji:string}>> = {
  'duel-reaction': { title:'Duel', emoji:'⚔️' },
};


export const GAME_CATALOG: Record<GameId, { title: string; emoji: string }> = {
  reaction: { title: 'Reaksiya', emoji: '⚡' },
  'emoji-find': { title: 'Emoji', emoji: '🍎' },
  'number-memory': { title: 'Memory', emoji: '🧠' },
  'stroop-test': { title: 'Stroop', emoji: '🌈' },
  'duel-reaction': { title: 'Duel', emoji: '⚔️' },
  'ascending-numbers': { title: 'Ascending Numbers', emoji: '🔢' },
  'odd-one-out': { title: 'Odd One Out', emoji: '👁' },
  'pattern-memory': { title: 'Pattern Memory', emoji: '🧩' },
  'go-no-go': { title: 'Go / No-Go', emoji: '🚦' },
  'mental-math': { title: 'Mental Math', emoji: '➕' },
  'sequence-memory': { title: 'Sequence Memory', emoji: '🔄' },
  'card-memory': { title: 'Card Memory', emoji: '🃏' },
  'time-estimation': { title: 'Time Estimation', emoji: '⏱️' },
  'peripheral-vision': { title: 'Peripheral Vision', emoji: '👀' },
  'twenty-four': { title: '24 Game', emoji: '🧮' },
  'dual-n-back': { title: 'Dual N-Back', emoji: '🧠' },
  'fifteen-puzzle': { title: '15 Puzzle', emoji: '🧩' },
};

export function getGamePresentation(gameId: GameId): { title: string; emoji: string } {
  const game=getGameDefinition(gameId);
  return game ? { title: game.titleKey, emoji: game.emoji } : (LEGACY[gameId] ?? {title:gameId,emoji:'🎮'});
}

export function formatAttemptResult(attempt: GameAttempt): string {
  if (attempt.metric === 'duration_ms') return `${formatMs(attempt.value)} ms`;
  if (attempt.metric === 'correct_count') {
    const rounds=typeof attempt.meta?.rounds==='number'?attempt.meta.rounds:5;
    return `${attempt.value}/${rounds}`;
  }
  return `${Math.round(attempt.value).toLocaleString('en-US')} XP`;
}
