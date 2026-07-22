import { invokePlatformApi } from '@/lib/platformApi';
import type { FriendListEntry } from '@/types/friendship';

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  await invokePlatformApi<{ sent: boolean }>('friend.request', { targetUserId });
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  await invokePlatformApi<{ accepted: boolean }>('friend.accept', { friendshipId });
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  await invokePlatformApi<{ removed: boolean }>('friend.remove', { friendshipId });
}

export async function getFriendList(): Promise<FriendListEntry[]> {
  const result = await invokePlatformApi<{ entries: FriendListEntry[] }>('friend.list');
  return result.entries;
}
