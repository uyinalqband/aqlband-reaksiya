export type CheckersLeagueTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'crystal'
  | 'champion'
  | 'legend';

export interface CheckersLeague {
  tier: CheckersLeagueTier;
  division: 1 | 2 | 3;
  name: string;
  emoji: string;
  minRating: number;
  maxRating: number | null;
}

export const CHECKERS_LEAGUES: readonly CheckersLeague[] = [
  { tier: 'bronze', division: 1, name: 'Bronze I', emoji: '🥉', minRating: 0, maxRating: 1039 },
  { tier: 'bronze', division: 2, name: 'Bronze II', emoji: '🥉', minRating: 1040, maxRating: 1079 },
  { tier: 'bronze', division: 3, name: 'Bronze III', emoji: '🥉', minRating: 1080, maxRating: 1119 },
  { tier: 'silver', division: 1, name: 'Silver I', emoji: '🥈', minRating: 1120, maxRating: 1159 },
  { tier: 'silver', division: 2, name: 'Silver II', emoji: '🥈', minRating: 1160, maxRating: 1199 },
  { tier: 'silver', division: 3, name: 'Silver III', emoji: '🥈', minRating: 1200, maxRating: 1259 },
  { tier: 'gold', division: 1, name: 'Gold I', emoji: '🥇', minRating: 1260, maxRating: 1319 },
  { tier: 'gold', division: 2, name: 'Gold II', emoji: '🥇', minRating: 1320, maxRating: 1379 },
  { tier: 'gold', division: 3, name: 'Gold III', emoji: '🥇', minRating: 1380, maxRating: 1449 },
  { tier: 'crystal', division: 1, name: 'Crystal I', emoji: '🔮', minRating: 1450, maxRating: 1519 },
  { tier: 'crystal', division: 2, name: 'Crystal II', emoji: '🔮', minRating: 1520, maxRating: 1589 },
  { tier: 'crystal', division: 3, name: 'Crystal III', emoji: '🔮', minRating: 1590, maxRating: 1669 },
  { tier: 'champion', division: 1, name: 'Champion I', emoji: '🏆', minRating: 1670, maxRating: 1749 },
  { tier: 'champion', division: 2, name: 'Champion II', emoji: '🏆', minRating: 1750, maxRating: 1829 },
  { tier: 'champion', division: 3, name: 'Champion III', emoji: '🏆', minRating: 1830, maxRating: 1919 },
  { tier: 'legend', division: 1, name: 'Legend I', emoji: '🛡️', minRating: 1920, maxRating: 1999 },
  { tier: 'legend', division: 2, name: 'Legend II', emoji: '🛡️', minRating: 2000, maxRating: 2079 },
  { tier: 'legend', division: 3, name: 'Legend III', emoji: '🛡️', minRating: 2080, maxRating: null },
] as const;

export function getCheckersLeague(rating: number): CheckersLeague {
  const safeRating = Math.max(0, Math.round(rating));
  return (
    [...CHECKERS_LEAGUES]
      .reverse()
      .find((league) => safeRating >= league.minRating) ??
    CHECKERS_LEAGUES[0]
  );
}

export function getNextCheckersLeague(rating: number): CheckersLeague | null {
  const current = getCheckersLeague(rating);
  const index = CHECKERS_LEAGUES.findIndex(
    (league) =>
      league.tier === current.tier &&
      league.division === current.division,
  );
  return CHECKERS_LEAGUES[index + 1] ?? null;
}

export function ratingProgress(rating: number) {
  const current = getCheckersLeague(rating);
  const next = getNextCheckersLeague(rating);
  if (!next) {
    return { current, next: null, percent: 100, remaining: 0 };
  }
  const span = Math.max(1, next.minRating - current.minRating);
  const progressed = Math.max(0, Math.min(span, rating - current.minRating));
  return {
    current,
    next,
    percent: (progressed / span) * 100,
    remaining: Math.max(0, next.minRating - rating),
  };
}
