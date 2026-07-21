import { useState } from 'react';
import { acceptFriendRequest, removeFriendship } from '@/services/friendService';
import type { FriendListEntry } from '@/types/friendship';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CheckIcon, TrashIcon } from '@/components/ui/icons';

interface FriendRequestsListProps {
  entries: FriendListEntry[];
  onChanged: () => void;
}

export function FriendRequestsList({ entries, onChanged }: FriendRequestsListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = entries.filter((e) => e.status === 'pending' && !e.isOutgoing);
  const outgoing = entries.filter((e) => e.status === 'pending' && e.isOutgoing);
  const accepted = entries.filter((e) => e.status === 'accepted');

  const runAction = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      onChanged();
    } catch (error) {
      console.error('Friend action failed', error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {incoming.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
            Kiruvchi so'rovlar
          </h3>
          <Card padded={false} className="divide-y divide-ink-600/50">
            {incoming.map((entry) => (
              <div key={entry.friendshipId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mist-100">{entry.user.firstName}</p>
                  {entry.user.username && (
                    <p className="truncate text-xs text-mist-500">@{entry.user.username}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={busyId === entry.friendshipId}
                    onClick={() => void runAction(entry.friendshipId, () => acceptFriendRequest(entry.friendshipId))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-signal-go/20 text-signal-go disabled:opacity-40"
                    aria-label="Qabul qilish"
                  >
                    <CheckIcon width={16} height={16} />
                  </button>
                  <button
                    disabled={busyId === entry.friendshipId}
                    onClick={() => void runAction(entry.friendshipId, () => removeFriendship(entry.friendshipId))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-signal-early/20 text-signal-early disabled:opacity-40"
                    aria-label="Rad etish"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
            Yuborilgan so'rovlar
          </h3>
          <Card padded={false} className="divide-y divide-ink-600/50">
            {outgoing.map((entry) => (
              <div key={entry.friendshipId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mist-100">{entry.user.firstName}</p>
                  <p className="text-xs text-mist-500">Javob kutilmoqda...</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === entry.friendshipId}
                  onClick={() => void runAction(entry.friendshipId, () => removeFriendship(entry.friendshipId))}
                >
                  Bekor qilish
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
          Do'stlar ({accepted.length})
        </h3>
        {accepted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            Hali do'stlaringiz yo'q. Yuqorida nik orqali qidiring.
          </p>
        ) : (
          <Card padded={false} className="divide-y divide-ink-600/50">
            {accepted.map((entry) => (
              <div key={entry.friendshipId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mist-100">{entry.user.firstName}</p>
                  {entry.user.username && (
                    <p className="truncate text-xs text-mist-500">@{entry.user.username}</p>
                  )}
                </div>
                <button
                  disabled={busyId === entry.friendshipId}
                  onClick={() => void runAction(entry.friendshipId, () => removeFriendship(entry.friendshipId))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mist-500 disabled:opacity-40"
                  aria-label="Do'stlikni bekor qilish"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
