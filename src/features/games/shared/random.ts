export type RandomSource = () => number;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRoundRandom(
  duelId: string | null | undefined,
  gameId: string,
  round: number,
  channel = 'main',
): RandomSource {
  if (!duelId) return Math.random;
  return mulberry32(hashText(`aqlband:${duelId}:${gameId}:${round}:${channel}`));
}

export function randomInteger(random: RandomSource, minimum: number, maximum: number): number {
  const min = Math.ceil(minimum);
  const max = Math.floor(maximum);
  return min + Math.floor(random() * (max - min + 1));
}

export function pickRandom<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) throw new Error('Tasodifiy tanlov uchun element topilmadi.');
  return items[Math.floor(random() * items.length)];
}

export function shuffleRandom<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
