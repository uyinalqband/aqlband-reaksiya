export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendListEntry {
  friendshipId: string;
  status: FriendshipStatus;
  isOutgoing: boolean;
  user: {
    id: string;
    displayName: string;
    /** Legacy alias used by the current profile components. */
    firstName: string;
    username: string | null;
  };
  createdAt: string;
}
