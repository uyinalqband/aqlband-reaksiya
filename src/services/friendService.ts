import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { LeaderboardRow } from '@/types/leaderboard';
import type { FriendListEntry, FriendshipRow } from '@/types/friendship';
import type { UserRow } from '@/types/user';

const FRIENDSHIPS = 'friendships';
const LEADERBOARD = 'leaderboard';

/**
 * Sends a friend request. `myUserId`/`targetUserId` are `users.id` (uuid),
 * not telegram_id — look the target up via searchUserByUsername() first.
 * Throws a friendly error if a request already exists in either direction.
 */
export async function sendFriendRequest(myUserId: string, targetUserId: string): Promise<FriendshipRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  if (myUserId === targetUserId) {
    throw new Error("O'zingizga do'stlik so'rovi yubora olmaysiz.");
  }

  // A friendship may already exist in either direction — check both before inserting,
  // since the DB's unique constraint only covers one exact (requester, addressee) order.
  const { data: existing, error: existingError } = await supabase
    .from(FRIENDSHIPS)
    .select('*')
    .or(
      `and(requester_id.eq.${myUserId},addressee_id.eq.${targetUserId}),` +
        `and(requester_id.eq.${targetUserId},addressee_id.eq.${myUserId})`,
    )
    .maybeSingle();

  if (existingError) throw new Error(`sendFriendRequest failed: ${existingError.message}`);
  if (existing) {
    throw new Error(
      existing.status === 'accepted' ? 'Siz allaqachon do\u2019stsiz.' : 'So\u2018rov allaqachon yuborilgan.',
    );
  }

  const { data, error } = await supabase
    .from(FRIENDSHIPS)
    .insert({ requester_id: myUserId, addressee_id: targetUserId, status: 'pending' })
    .select()
    .single();

  if (error) throw new Error(`sendFriendRequest failed: ${error.message}`);
  return data as FriendshipRow;
}

/** Accepts a pending incoming request. */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from(FRIENDSHIPS)
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId);

  if (error) throw new Error(`acceptFriendRequest failed: ${error.message}`);
}

/**
 * Declines a pending request, cancels a request you sent, or unfriends an
 * existing friend — all three are the same operation: delete the row.
 */
export async function removeFriendship(friendshipId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from(FRIENDSHIPS).delete().eq('id', friendshipId);
  if (error) throw new Error(`removeFriendship failed: ${error.message}`);
}

/**
 * All friendship rows involving this user (both directions, both
 * pending and accepted), enriched with the other person's display info.
 * Screens filter this by `status` / `isOutgoing` as needed (e.g. an
 * "incoming requests" list is `status === 'pending' && !isOutgoing`).
 */
export async function getFriendList(myUserId: string): Promise<FriendListEntry[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from(FRIENDSHIPS)
    .select('*, requester:requester_id(*), addressee:addressee_id(*)')
    .or(`requester_id.eq.${myUserId},addressee_id.eq.${myUserId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getFriendList failed: ${error.message}`);

  type Joined = FriendshipRow & { requester: UserRow; addressee: UserRow };

  return ((data as Joined[]) ?? []).map((row) => {
    const isOutgoing = row.requester_id === myUserId;
    const other = isOutgoing ? row.addressee : row.requester;
    return {
      friendshipId: row.id,
      status: row.status,
      isOutgoing,
      user: {
        id: other.id,
        telegramId: other.telegram_id,
        username: other.username,
        firstName: other.first_name,
      },
      createdAt: row.created_at,
    } satisfies FriendListEntry;
  });
}

/**
 * Best reaction time per accepted friend (plus the current user), ordered
 * fastest-first — the "Do'stlar" leaderboard tab.
 */
export async function getFriendsLeaderboard(myUserId: string, myTelegramId: number): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];

  const friends = await getFriendList(myUserId);
  const friendTelegramIds = friends.filter((f) => f.status === 'accepted').map((f) => f.user.telegramId);

  const telegramIds = [...new Set([myTelegramId, ...friendTelegramIds])];
  if (telegramIds.length === 0) return [];

  const { data, error } = await supabase
    .from(LEADERBOARD)
    .select('*')
    .in('telegram_id', telegramIds)
    .order('score', { ascending: true });

  if (error) throw new Error(`getFriendsLeaderboard failed: ${error.message}`);

  // Dedupe to each player's single best row, same approach as getTop10Leaderboard.
  const seen = new Set<number>();
  const best: LeaderboardRow[] = [];
  for (const row of (data as LeaderboardRow[]) ?? []) {
    if (seen.has(row.telegram_id)) continue;
    seen.add(row.telegram_id);
    best.push(row);
  }
  return best;
}
