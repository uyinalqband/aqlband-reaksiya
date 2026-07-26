export type ReactionGamePhase =
  | 'idle'
  | 'countdown'
  | 'go'
  | 'result'
  | 'tooSoon'
  | 'timeout';

export interface ReactionRoundOptions {
  countdownMinMs: number;
  countdownMaxMs: number;
  timeoutMs: number;
}
