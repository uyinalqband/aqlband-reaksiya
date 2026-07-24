import type { Difficulty, GameSessionConfig, RoundSelection, SoloGameId } from '@/features/games/session/config';

export type DuelGameId = SoloGameId;

export type DuelStatus =
  | 'waiting'
  | 'invited'
  | 'ready_check'
  | 'countdown'
  | 'playing'
  | 'finished'
  | 'expired'
  | 'cancelled';

export interface DuelRow {
  id: string;
  host_user_id: string;
  guest_user_id: string | null;
  host_name: string;
  guest_name: string | null;
  status: DuelStatus;
  host_ready: boolean;
  guest_ready: boolean;
  countdown_start_at: string | null;
  game_start_at: string | null;
  ready_deadline_at: string | null;
  host_time_ms: number | null;
  guest_time_ms: number | null;
  game_id: DuelGameId;
  round_count: number;
  survival: boolean;
  difficulty: Difficulty;
  game_config?: Record<string, unknown> | null;
  expires_at: string;
  finished_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  tic_tac_toe_board?: string | null;
  tic_tac_toe_turn?: 'host' | 'guest' | null;
  tic_tac_toe_winner?: 'host' | 'guest' | 'draw' | null;
  tic_tac_toe_moves?: number | null;
  tic_tac_toe_last_move_at?: string | null;
  checkers_board?: string | null;
  checkers_turn?: 'host' | 'guest' | null;
  checkers_winner?: 'host' | 'guest' | 'draw' | null;
  checkers_result_reason?: string | null;
  checkers_moves?: number | null;
  checkers_host_captures?: number | null;
  checkers_guest_captures?: number | null;
  checkers_host_promotions?: number | null;
  checkers_guest_promotions?: number | null;
  checkers_forced_from?: number | null;
  checkers_turn_deadline_at?: string | null;
  checkers_last_move_at?: string | null;
  checkers_draw_offer_by?: 'host' | 'guest' | null;
  checkers_draw_offer_at?: string | null;
  checkers_host_draw_offers?: number | null;
  checkers_guest_draw_offers?: number | null;
  checkers_no_progress_moves?: number | null;
  checkers_position_history?: Record<string, number> | null;
  checkers_mode?: 'friendly' | 'rated';
  checkers_host_rating_before?: number | null;
  checkers_guest_rating_before?: number | null;
  checkers_host_rating_after?: number | null;
  checkers_guest_rating_after?: number | null;
  checkers_host_rating_delta?: number | null;
  checkers_guest_rating_delta?: number | null;
  checkers_rating_processed_at?: string | null;
  created_at: string;
}

export type DuelRole = 'host' | 'guest';

export interface DuelGameContext {
  duelId: string;
  role: DuelRole;
  gameId: DuelGameId;
  config: GameSessionConfig;
  opponentName: string;
}

export interface IncomingDuelInvite {
  duel: DuelRow;
  serverNow: number;
}

function optionalInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

export function duelConfig(duel: DuelRow): GameSessionConfig {
  const rounds: RoundSelection = duel.survival
    ? 'survival'
    : (Math.max(1, Math.min(10, Math.round(duel.round_count))) as RoundSelection);
  const custom = duel.game_config ?? {};

  return {
    rounds,
    difficulty: duel.difficulty,
    memorySize: optionalInteger(custom.memorySize, 3, 8),
    nBack: optionalInteger(custom.nBack, 1, 3),
    puzzleShuffle: optionalInteger(custom.puzzleShuffle, 10, 120),
  };
}
