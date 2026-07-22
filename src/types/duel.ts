export type DuelStatus = 'waiting' | 'ready_check' | 'countdown' | 'finished' | 'expired' | 'cancelled';

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
  host_time_ms: number | null;
  guest_time_ms: number | null;
  expires_at: string;
  finished_at: string | null;
  created_at: string;
}

export type DuelRole = 'host' | 'guest';
