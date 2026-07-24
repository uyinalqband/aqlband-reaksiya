export type AuthProvider = 'telegram' | 'google';

/** Minimal account data used by the app. Provider IDs never reach the UI. */
export interface AppAccount {
  id: string;
  provider: AuthProvider;
  displayName: string;
  username: string | null;
  /** Account creation time, used only to prevent deleted history from returning. */
  createdAt: number;
  /** Opaque sync state; never displayed as profile data. */
  historyGeneration: string;
  historyClearedAt: number;
  /** Board skin selected for the next Checkers match. */
  selectedCheckersSkin: string;
  /** Piece skin kept by this player's own colour. */
  selectedCheckersPieceSkin: string;
}
