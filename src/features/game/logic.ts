import type { ResultTier } from '@/types';

/** Random delay range (ms) before the "go" signal appears, keeps rounds unpredictable. */
export const COUNTDOWN_MIN_MS = 1500;
export const COUNTDOWN_MAX_MS = 4200;

/** If the player never taps after the signal, auto-resolve as a timeout. */
export const REACTION_TIMEOUT_MS = 3000;

export function randomCountdownDelay(): number {
  return Math.round(COUNTDOWN_MIN_MS + Math.random() * (COUNTDOWN_MAX_MS - COUNTDOWN_MIN_MS));
}

/**
 * Reaction time tiers, calibrated against published human-reflex research:
 * ~150-200ms is elite/near-limit, ~200-250ms is a strong average adult reaction,
 * 250-350ms is common, and slower times usually reflect distraction or a warm-up round.
 */
const TIER_THRESHOLDS: { max: number; tier: ResultTier }[] = [
  { max: 200, tier: 'lightning' },
  { max: 250, tier: 'sharp' },
  { max: 320, tier: 'quick' },
  { max: 420, tier: 'steady' },
  { max: Infinity, tier: 'casual' },
];

export function getResultTier(timeMs: number): ResultTier {
  return TIER_THRESHOLDS.find((t) => timeMs <= t.max)!.tier;
}

/**
 * Approximate percentile using a smooth logistic curve centered near 260ms
 * (a commonly cited median simple-visual-reaction-time for adults). This is
 * a deliberately simple, dependency-free model — good enough for motivating
 * in-app framing, not a scientific claim.
 */
export function estimatePercentile(timeMs: number): number {
  const center = 260;
  const spread = 55;
  const z = (center - timeMs) / spread;
  const logistic = 1 / (1 + Math.exp(-z));
  const percentile = Math.round(logistic * 98) + 1;
  return Math.min(99, Math.max(1, percentile));
}

export function formatMs(timeMs: number): string {
  return Math.round(timeMs).toLocaleString('en-US');
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
