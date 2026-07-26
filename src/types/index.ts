export interface AppUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium?: boolean;
}

export interface ChallengePayload {
  /** Challenger result in milliseconds. */
  t: number;
  /** Challenger display name. */
  n: string;
  /** Challenger Telegram user id, when available. */
  u?: number;
}
