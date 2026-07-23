import type { Difficulty, GameSessionConfig, RoundSelection, SoloGameId } from '@/features/gameSession/config';

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
  game_id: SoloGameId;
  round_count: number;
  survival: boolean;
  difficulty: Difficulty;
  expires_at: string;
  finished_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
}

export type DuelRole = 'host' | 'guest';

export interface DuelGameContext {
  duelId: string;
  role: DuelRole;
  gameId: SoloGameId;
  config: GameSessionConfig;
  opponentName: string;
}

export interface IncomingDuelInvite {
  duel: DuelRow;
  serverNow: number;
}

export function duelConfig(duel: DuelRow): GameSessionConfig {
  const rounds: RoundSelection = duel.survival
    ? 'survival'
    : (Math.max(1, Math.min(10, Math.round(duel.round_count))) as RoundSelection);
  return { rounds, difficulty: duel.difficulty };
}
