import { useEffect } from 'react';
import { getIncomingDuelInvites } from '@/services/duelService';
import { getFriendList } from '@/services/friendService';
import { useNotificationStore } from '@/store/notificationStore';
import { useOnlineStore } from '@/store/onlineStore';

export function NotificationSync() {
  const appUserId = useOnlineStore((state) => state.appUserId);
  const upsert = useNotificationStore((state) => state.upsert);

  useEffect(() => {
    if (!appUserId) return;
    let stopped = false;
    let running = false;

    const refresh = async () => {
      if (stopped || running) return;
      running = true;
      try {
        const [invites, friends] = await Promise.all([
          getIncomingDuelInvites(),
          getFriendList(appUserId),
        ]);

        for (const invite of invites) {
          if (stopped) break;
          await upsert({
            id: `duel-${invite.duel.id}`,
            kind: 'game',
            title: invite.duel.host_name,
            message: `${invite.duel.game_id} · ${invite.duel.survival ? '∞' : invite.duel.round_count}`,
            createdAt: new Date(invite.duel.created_at).getTime(),
            actionId: invite.duel.id,
          });
        }

        for (const entry of friends.filter((item) => item.status === 'pending' && !item.isOutgoing)) {
          if (stopped) break;
          await upsert({
            id: `friend-${entry.friendshipId}`,
            kind: 'friend',
            title: entry.user.displayName,
            message: entry.user.username ? `@${entry.user.username}` : '👥',
            createdAt: new Date(entry.createdAt).getTime(),
            actionId: entry.friendshipId,
          });
        }
      } catch {
        // Temporary network errors should not interrupt the app.
      } finally {
        running = false;
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [appUserId, upsert]);

  return null;
}
