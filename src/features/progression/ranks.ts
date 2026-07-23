export type XpRankTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'crystal'
  | 'champion'
  | 'legend';

export type XpRankDivision = 'I' | 'II' | 'III';

export interface XpRank {
  tier: XpRankTier;
  name: string;
  emoji: string;
  division: XpRankDivision;
  minXp: number;
  toneClass: string;
}

export interface XpRankProgress {
  current: XpRank;
  next: XpRank | null;
  progressPercent: number;
  xpIntoRank: number;
  xpForRank: number | null;
  remainingXp: number;
}

/**
 * AqlBand competitive XP ranks.
 *
 * Division order intentionally follows the product rule supplied by the user:
 * I is the entry division, then II, then III.
 */
export const XP_RANKS: readonly XpRank[] = [
  { tier: 'bronze', name: 'Bronza', emoji: '🥉', division: 'I', minXp: 0, toneClass: 'border-orange-500/35 bg-orange-500/10 text-orange-300' },
  { tier: 'bronze', name: 'Bronza', emoji: '🥉', division: 'II', minXp: 1040, toneClass: 'border-orange-500/35 bg-orange-500/10 text-orange-300' },
  { tier: 'bronze', name: 'Bronza', emoji: '🥉', division: 'III', minXp: 1080, toneClass: 'border-orange-500/35 bg-orange-500/10 text-orange-300' },

  { tier: 'silver', name: 'Silver', emoji: '🥈', division: 'I', minXp: 1120, toneClass: 'border-slate-400/35 bg-slate-400/10 text-slate-200' },
  { tier: 'silver', name: 'Silver', emoji: '🥈', division: 'II', minXp: 1160, toneClass: 'border-slate-400/35 bg-slate-400/10 text-slate-200' },
  { tier: 'silver', name: 'Silver', emoji: '🥈', division: 'III', minXp: 1200, toneClass: 'border-slate-400/35 bg-slate-400/10 text-slate-200' },

  { tier: 'gold', name: 'Gold', emoji: '🥇', division: 'I', minXp: 1260, toneClass: 'border-gold-500/40 bg-gold-500/10 text-gold-400' },
  { tier: 'gold', name: 'Gold', emoji: '🥇', division: 'II', minXp: 1320, toneClass: 'border-gold-500/40 bg-gold-500/10 text-gold-400' },
  { tier: 'gold', name: 'Gold', emoji: '🥇', division: 'III', minXp: 1380, toneClass: 'border-gold-500/40 bg-gold-500/10 text-gold-400' },

  { tier: 'crystal', name: 'Crystal', emoji: '🔮', division: 'I', minXp: 1450, toneClass: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },
  { tier: 'crystal', name: 'Crystal', emoji: '🔮', division: 'II', minXp: 1520, toneClass: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },
  { tier: 'crystal', name: 'Crystal', emoji: '🔮', division: 'III', minXp: 1590, toneClass: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },

  { tier: 'champion', name: 'Champion', emoji: '🏆', division: 'I', minXp: 1670, toneClass: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300' },
  { tier: 'champion', name: 'Champion', emoji: '🏆', division: 'II', minXp: 1750, toneClass: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300' },
  { tier: 'champion', name: 'Champion', emoji: '🏆', division: 'III', minXp: 1830, toneClass: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300' },

  { tier: 'legend', name: 'Legend', emoji: '🛡️', division: 'I', minXp: 1920, toneClass: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
  { tier: 'legend', name: 'Legend', emoji: '🛡️', division: 'II', minXp: 2000, toneClass: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
  { tier: 'legend', name: 'Legend', emoji: '🛡️', division: 'III', minXp: 2080, toneClass: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' },
] as const;

function normalizeXp(totalXp: number): number {
  return Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
}

export function getXpRank(totalXp: number): XpRank {
  const xp = normalizeXp(totalXp);

  for (let index = XP_RANKS.length - 1; index >= 0; index -= 1) {
    if (xp >= XP_RANKS[index].minXp) return XP_RANKS[index];
  }

  return XP_RANKS[0];
}

export function getNextXpRank(totalXp: number): XpRank | null {
  const current = getXpRank(totalXp);
  const currentIndex = XP_RANKS.indexOf(current);
  return XP_RANKS[currentIndex + 1] ?? null;
}

export function getXpRankLabel(totalXp: number): string {
  const rank = getXpRank(totalXp);
  return `${rank.emoji} ${rank.name} ${rank.division}`;
}

export function getXpRankProgress(totalXp: number): XpRankProgress {
  const xp = normalizeXp(totalXp);
  const current = getXpRank(xp);
  const next = getNextXpRank(xp);

  if (!next) {
    return {
      current,
      next: null,
      progressPercent: 100,
      xpIntoRank: Math.max(0, xp - current.minXp),
      xpForRank: null,
      remainingXp: 0,
    };
  }

  const xpForRank = Math.max(1, next.minXp - current.minXp);
  const xpIntoRank = Math.max(0, xp - current.minXp);

  return {
    current,
    next,
    progressPercent: Math.max(0, Math.min(100, (xpIntoRank / xpForRank) * 100)),
    xpIntoRank,
    xpForRank,
    remainingXp: Math.max(0, next.minXp - xp),
  };
}
