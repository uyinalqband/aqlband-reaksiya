/** A single completed reaction-test round. */
export interface Attempt {
  id: string;
  /** Reaction time in milliseconds. Negative values are never stored — false starts are tracked separately. */
  timeMs: number;
  /** Unix ms timestamp of when the round finished. */
  playedAt: number;
}

/** Skill tier derived from a reaction time, used for result framing and copy. */
export type ResultTier = 'lightning' | 'sharp' | 'quick' | 'steady' | 'casual';

/** Lifecycle states of a single reaction round. */
export type GamePhase =
  | 'idle' // pre-round, showing "tap to start"
  | 'countdown' // random delay before the signal, circle is idle/armed color
  | 'armed' // alias-safe state right before "go" (kept distinct for clarity in state machine)
  | 'go' // signal is live, timer running, waiting for tap
  | 'result' // tap registered, showing time
  | 'tooSoon' // user tapped during countdown
  | 'timeout'; // user never tapped after signal (safety net)

/** Minimal Telegram user profile shape the app actually consumes. */
export interface AppUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium?: boolean;
}

/** A challenge payload encoded into a deep-link so a friend can compare results. */
export interface ChallengePayload {
  /** Reaction time in ms set by the challenger. */
  t: number;
  /** Challenger's first name, for display only — never trust for identity. */
  n: string;
  /** Challenger's Telegram user id, if available. */
  u?: number;
}

export interface StatsSnapshot {
  best: number | null;
  average: number | null;
  totalAttempts: number;
}
