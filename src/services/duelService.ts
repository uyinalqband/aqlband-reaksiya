import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { DuelRole, DuelRow } from '@/types/duel';

const TABLE = 'duels';

/** Time from when both players are ready until the "go" signal, in ms. Shared by all clients via `countdown_start_at`. */
export const DUEL_COUNTDOWN_MS = 5000;

export async function createDuel(hostTelegramId: number, hostName: string): Promise<DuelRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ host_telegram_id: hostTelegramId, host_name: hostName })
    .select()
    .single();

  if (error) throw new Error(`createDuel failed: ${error.message}`);
  return data as DuelRow;
}

export async function getDuel(duelId: string): Promise<DuelRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.from(TABLE).select('*').eq('id', duelId).maybeSingle();
  if (error) throw new Error(`getDuel failed: ${error.message}`);
  return (data as DuelRow) ?? null;
}

/**
 * Joins an existing duel as the guest. If the host opens their own invite
 * link, this is a no-op that just returns the current row (they're already
 * "in" as host). Throws if the duel doesn't exist or already has a
 * different guest.
 */
export async function joinDuel(duelId: string, guestTelegramId: number, guestName: string): Promise<DuelRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  const existing = await getDuel(duelId);
  if (!existing) throw new Error("O'yin topilmadi. Havola eskirgan bo'lishi mumkin.");
  if (existing.host_telegram_id === guestTelegramId) return existing;
  if (existing.guest_telegram_id && existing.guest_telegram_id !== guestTelegramId) {
    throw new Error("Bu o'yinga allaqachon boshqa o'yinchi qo'shilgan.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ guest_telegram_id: guestTelegramId, guest_name: guestName, status: 'ready_check' })
    .eq('id', duelId)
    .eq('status', 'waiting')
    .select()
    .maybeSingle();

  if (error) throw new Error(`joinDuel failed: ${error.message}`);
  // Null `data` means someone else's join committed a split second earlier
  // (the WHERE status='waiting' guard no longer matched) — re-fetch to show
  // the actual current state rather than a stale local guess.
  return (data as DuelRow) ?? (await getDuel(duelId)) ?? existing;
}

/**
 * Marks the given player as ready, then atomically transitions the duel to
 * 'countdown' the moment BOTH sides are ready. The second update's WHERE
 * clause is the concurrency guard: whichever client's "both ready" check
 * lands second simply matches zero rows and does nothing, so the countdown
 * only ever starts once, regardless of timing between the two devices.
 */
export async function setReady(duelId: string, role: DuelRole): Promise<void> {
  if (!isSupabaseConfigured) return;

  const field = role === 'host' ? 'host_ready' : 'guest_ready';
  const { error } = await supabase
    .from(TABLE)
    .update({ [field]: true })
    .eq('id', duelId);
  if (error) throw new Error(`setReady failed: ${error.message}`);

  const { error: transitionError } = await supabase
    .from(TABLE)
    .update({ status: 'countdown', countdown_start_at: new Date().toISOString() })
    .eq('id', duelId)
    .eq('status', 'ready_check')
    .eq('host_ready', true)
    .eq('guest_ready', true);
  if (transitionError) throw new Error(`countdown transition failed: ${transitionError.message}`);
}

/**
 * Records this player's reaction time, then atomically transitions the
 * duel to 'finished' once BOTH times are present — same race-safe pattern
 * as setReady().
 */
export async function submitDuelTime(duelId: string, role: DuelRole, timeMs: number): Promise<void> {
  if (!isSupabaseConfigured) return;

  const field = role === 'host' ? 'host_time_ms' : 'guest_time_ms';
  const { error } = await supabase
    .from(TABLE)
    .update({ [field]: Math.round(timeMs) })
    .eq('id', duelId);
  if (error) throw new Error(`submitDuelTime failed: ${error.message}`);

  const { error: finishError } = await supabase
    .from(TABLE)
    .update({ status: 'finished' })
    .eq('id', duelId)
    .not('host_time_ms', 'is', null)
    .not('guest_time_ms', 'is', null);
  if (finishError) throw new Error(`finish transition failed: ${finishError.message}`);
}

/**
 * Subscribes to live updates for a single duel row. Returns an unsubscribe
 * function. No-ops (returns a no-op unsubscribe) if Supabase isn't
 * configured, matching the rest of the app's graceful-degradation pattern.
 */
export function subscribeToDuel(duelId: string, onChange: (row: DuelRow) => void): () => void {
  if (!isSupabaseConfigured) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(`duel-${duelId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${duelId}` },
      (payload) => onChange(payload.new as DuelRow),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
