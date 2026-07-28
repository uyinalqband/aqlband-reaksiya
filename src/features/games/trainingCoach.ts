import { GAMES, type GameDefinition } from '@/features/games/catalog';
import type { GameAttempt } from '@/store/gameHistoryStore';

export type Skill = GameDefinition['category'];

const TRAINABLE = GAMES.filter((game) => !game.friendOnly);
const DAY_MS = 86_400_000;

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result);
}

export function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function dailyTraining(date = new Date()): GameDefinition[] {
  const seed = hash(dayKey(date));
  const categories: Skill[] = ['speed', 'memory', 'attention', 'logic'];
  return [0, 1, 2].map((offset) => {
    const category = categories[(seed + offset) % categories.length];
    const pool = TRAINABLE.filter((game) => game.category === category);
    return pool[(seed * (offset + 3) + offset) % pool.length];
  });
}

export function isToday(timestamp: number): boolean {
  return dayKey(new Date(timestamp)) === dayKey();
}

export function trainingProgress(attempts: GameAttempt[]): number {
  const played = new Set(
    attempts.filter((attempt) => isToday(attempt.playedAt)).map((attempt) => attempt.gameId),
  );
  return dailyTraining().filter((game) => played.has(game.id)).length;
}

export function skillScores(attempts: GameAttempt[]): Record<Skill, number> {
  const result: Record<Skill, number> = { speed: 18, memory: 18, attention: 18, logic: 18 };
  const recent = attempts.filter((attempt) => Date.now() - attempt.playedAt <= DAY_MS * 14);
  for (const category of Object.keys(result) as Skill[]) {
    const ids = new Set<string>(TRAINABLE.filter((game) => game.category === category).map((game) => game.id));
    const games = recent.filter((attempt) => ids.has(attempt.gameId));
    const activeDays = new Set(games.map((attempt) => dayKey(new Date(attempt.playedAt)))).size;
    const accuracy = games.length === 0
      ? 0
      : games.reduce((sum, attempt) => {
          const correct = Number(attempt.meta?.correct ?? 1);
          const errors = Number(attempt.meta?.errors ?? 0) + Number(attempt.meta?.timeouts ?? 0);
          return sum + correct / Math.max(1, correct + errors);
        }, 0) / games.length;
    result[category] = Math.min(100, Math.round(18 + games.length * 4 + activeDays * 5 + accuracy * 25));
  }
  return result;
}

export function recommendedGame(attempts: GameAttempt[]): GameDefinition {
  const scores = skillScores(attempts);
  const weakest = (Object.keys(scores) as Skill[]).sort((a, b) => scores[a] - scores[b])[0];
  const pool = TRAINABLE.filter((game) => game.category === weakest);
  const counts = new Map<string, number>();
  attempts.forEach((attempt) => counts.set(attempt.gameId, (counts.get(attempt.gameId) ?? 0) + 1));
  return [...pool].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0];
}

export function adaptiveLevel(attempts: GameAttempt[], gameId: string): 'easy' | 'medium' | 'hard' | 'very-hard' {
  const recent = attempts.filter((attempt) => attempt.gameId === gameId).slice(0, 5);
  if (recent.length < 2) return 'medium';
  const accuracy = recent.reduce((sum, attempt) => {
    const correct = Number(attempt.meta?.correct ?? 1);
    const errors = Number(attempt.meta?.errors ?? 0) + Number(attempt.meta?.timeouts ?? 0);
    return sum + correct / Math.max(1, correct + errors);
  }, 0) / recent.length;
  if (accuracy >= .92 && recent.length >= 4) return 'very-hard';
  if (accuracy >= .78) return 'hard';
  if (accuracy < .48) return 'easy';
  return 'medium';
}
