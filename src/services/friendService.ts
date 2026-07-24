import { invokePlatformApi } from '@/lib/platformApi';
import type { FriendListEntry } from '@/types/friendship';

/** Accepts both new (targetId) and old (myId, targetId) call shapes. */
export async function sendFriendRequest(targetUserId: string): Promise<void>;
export async function sendFriendRequest(_legacyMyUserId: string, targetUserId: string): Promise<void>;
export async function sendFriendRequest(firstId: string, secondId?: string): Promise<void> {
  const targetUserId = secondId ?? firstId;
  await invokePlatformApi<{ sent: boolean }>('friend.request', { targetUserId });
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  await invokePlatformApi<{ accepted: boolean }>('friend.accept', { friendshipId });
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  await invokePlatformApi<{ removed: boolean }>('friend.remove', { friendshipId });
}

/** Legacy user-id argument is ignored; identity comes from the verified session. */
export async function getFriendList(_legacyMyUserId?: string): Promise<FriendListEntry[]> {
  const result = await invokePlatformApi<{
    entries: Array<{
      friendshipId: string;
      status: 'pending' | 'accepted';
      isOutgoing: boolean;
      user: { id: string; displayName: string; username: string | null };
      createdAt: string;
    }>;
  }>('friend.list');

  return result.entries.map((entry) => ({
    ...entry,
    user: {
      ...entry.user,
      firstName: entry.user.displayName,
    },
  }));
}
