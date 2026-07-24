import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useNotificationStore } from '@/store/notificationStore';
import { respondDuelInvite } from '@/services/duelService';
import { gamePath, makeDuelGameState } from '@/features/duel/duelSession';
import { duelConfig } from '@/types/duel';
import { acceptFriendRequest, removeFriendship } from '@/services/friendService';

export function NotificationsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = useNotificationStore((state) => state.items);
  const remove = useNotificationStore((state) => state.remove);
  const clear = useNotificationStore((state) => state.clear);
  const [busy, setBusy] = useState<string | null>(null);

  const answer = async (
    itemId: string,
    actionId: string,
    accept: boolean,
    kind: 'friend' | 'game',
  ) => {
    if (busy) return;
    setBusy(itemId);
    try {
      if (kind === 'game') {
        const duel = await respondDuelInvite(actionId, accept);
        await remove(itemId);
        if (accept) {
          navigate(gamePath(duel.game_id), {
            replace: true,
            state: makeDuelGameState({
              duelId: duel.id,
              role: 'guest',
              gameId: duel.game_id,
              config: duelConfig(duel),
              opponentName: duel.host_name,
            }),
          });
        }
      } else {
        if (accept) await acceptFriendRequest(actionId);
        else await removeFriendship(actionId);
        await remove(itemId);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <TopBar
        title={t('notifications.title')}
        trailing={items.length > 0 ? (
          <button type="button" onClick={() => void clear()} className="text-xs text-mist-500">
            {t('notifications.clear')}
          </button>
        ) : null}
      />

      {items.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-mist-500">{t('notifications.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex gap-3">
                <div className="text-2xl">{item.kind === 'game' ? '🎮' : '👥'}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-mist-500">{item.message}</p>
                  <p className="mt-1 text-[10px] text-mist-700">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <button type="button" onClick={() => void remove(item.id)} className="text-mist-700">✕</button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  disabled={busy === item.id || !item.actionId}
                  onClick={() => item.actionId && void answer(item.id, item.actionId, true, item.kind)}
                >
                  {t('notifications.accept')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === item.id}
                  onClick={() => item.actionId
                    ? void answer(item.id, item.actionId, false, item.kind)
                    : void remove(item.id)}
                >
                  {t('notifications.reject')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
