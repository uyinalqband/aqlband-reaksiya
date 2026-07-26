export type CheckersMatchMode = 'rated' | 'friendly';

export interface CheckersRatingProfile {
  userId: string;
  displayName: string;
  username: string | null;
  rating: number;
  peakRating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  provisionalGames: number;
  rank: number | null;
  activeDuelId: string | null;
  activeRole: 'host' | 'guest' | null;
}

export interface CheckersLeaderboardRow {
  userId: string;
  displayName: string;
  username: string | null;
  rating: number;
  peakRating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  rank: number;
}

export interface CheckersHistoryRow {
  duelId: string;
  opponentName: string;
  opponentUsername: string | null;
  outcome: 'win' | 'draw' | 'loss';
  mode: CheckersMatchMode;
  color: 'white' | 'black';
  moves: number;
  durationMs: number;
  captured: number;
  opponentCaptured: number;
  promotions: number;
  resultReason: string;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number;
  playedAt: number;
}

export interface MatchmakingStatus {
  state: 'idle' | 'searching' | 'matched';
  queuedAt: number | null;
  expandedRange: number;
  duelId: string | null;
  role: 'host' | 'guest' | null;
  opponentName: string | null;
}
