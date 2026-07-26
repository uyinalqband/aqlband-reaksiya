export interface LevelProgress {
  level: number;
  totalXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeeded: number;
  percent: number;
}

/**
 * Unlimited level curve. Early levels are fast; later levels grow smoothly.
 * Cumulative XP required for level L: 50 * (L - 1) * L.
 */
export function cumulativeXpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return 50 * (safe - 1) * safe;
}

export function levelFromXp(totalXp: number): number {
  const safeXp = Math.max(0, Math.floor(totalXp));
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + safeXp / 12.5)) / 2));
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const level = levelFromXp(safeXp);
  const levelStartXp = cumulativeXpForLevel(level);
  const nextLevelXp = cumulativeXpForLevel(level + 1);
  const xpNeeded = Math.max(1, nextLevelXp - levelStartXp);
  const xpIntoLevel = Math.max(0, safeXp - levelStartXp);

  return {
    level,
    totalXp: safeXp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeeded,
    percent: Math.min(100, (xpIntoLevel / xpNeeded) * 100),
  };
}
