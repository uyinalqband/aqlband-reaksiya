export type FriendshipStatus = 'pending' | 'accepted';

/** Row shape of `public.friendships`. */
export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
}

/** A friend (or pending request) enriched with the other person's display info. */
export interface FriendListEntry {
  friendshipId: string;
  status: FriendshipStatus;
  /** True if the *current* user is the one who sent the request. */
  isOutgoing: boolean;
  user: {
    id: string;
    telegramId: number;
    username: string | null;
    firstName: string;
  };
  createdAt: string;
}
