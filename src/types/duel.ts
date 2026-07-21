export type DuelStatus = 'waiting' | 'ready_check' | 'countdown' | 'finished';

/** Row shape of `public.duels`. */
export interface DuelRow {
  id: string;
  host_telegram_id: number;
  host_name: string;
  guest_telegram_id: number | null;
  guest_name: string | null;
  status: DuelStatus;
  host_ready: boolean;
  guest_ready: boolean;
  countdown_start_at: string | null;
  host_time_ms: number | null;
  guest_time_ms: number | null;
  created_at: string;
}

export type DuelRole = 'host' | 'guest';
