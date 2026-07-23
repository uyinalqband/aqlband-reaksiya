import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UsersIcon } from '@/components/ui/icons';
import {
  DEFAULT_GAME_SESSION,
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  GAME_SETUP_COPY,
  type Difficulty,
  type GameSessionConfig,
  type RoundSelection,
  type SoloGameId,
} from '@/features/gameSession/config';
import { getFriendList } from '@/services/friendService';
import { createDuel } from '@/services/duelService';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { FriendListEntry } from '@/types/friendship';

interface GameSetupPanelProps {
  gameId: SoloGameId;
  onStart: (config: GameSessionConfig) => void;
}

const FIXED_ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'very-hard', 'progressive'];

export function GameSetupPanel({ gameId, onStart }: GameSetupPanelProps) {
  const navigate = useNavigate();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const copy = GAME_SETUP_COPY[gameId];
  const [rounds, setRounds] = useState<RoundSelection>(DEFAULT_GAME_SESSION.rounds);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SESSION.difficulty);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const config: GameSessionConfig = { rounds, difficulty };

  const openFriends = useCallback(async () => {
    if (!isSupabaseConfigured || !appUserId) {
      setInviteError("Do'st bilan o'ynash uchun onlayn akkaunt ulanishi kerak.");
      return;
    }

    const nextOpen = !friendsOpen;
    setFriendsOpen(nextOpen);
    setInviteError(null);
    if (!nextOpen || friends.length > 0) return;

    setFriendsLoading(true);
    try {
      const entries = await getFriendList(appUserId);
      setFriends(entries.filter((entry) => entry.status === 'accepted'));
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Do'stlar ro'yxatini yuklab bo'lmadi.");
    } finally {
      setFriendsLoading(false);
    }
  }, [appUserId, friends.length, friendsOpen]);

  const inviteFriend = async (friend: FriendListEntry) => {
    if (invitingId) return;
    setInvitingId(friend.user.id);
    setInviteError(null);
    try {
      const result = await createDuel(friend.user.id, gameId, config);
      navigate('/duel', {
        state: { duelId: result.id, role: 'host' },
      });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Chaqiruv yuborib bo'lmadi.");
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl" aria-hidden="true">{copy.emoji}</div>
        <h2 className="mt-3 font-display text-2xl font-bold text-mist-100">{copy.title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">{copy.subtitle}</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Raundlar soni</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {FIXED_ROUNDS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setRounds(count)}
              className={`h-10 rounded-xl border font-mono text-sm font-bold transition-colors ${
                rounds === count
                  ? 'border-violet-400 bg-violet-600 text-white shadow-glow'
                  : 'border-ink-600 bg-ink-800 text-mist-400'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRounds('survival')}
          className={`mt-2.5 h-11 w-full rounded-xl border text-sm font-semibold transition-colors ${
            rounds === 'survival'
              ? 'border-gold-400/70 bg-gold-500/15 text-gold-300'
              : 'border-ink-600 bg-ink-800 text-mist-400'
          }`}
        >
          ♾️ Yutqazgungacha
        </button>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Qiyinlik darajasi</h3>
        <div className="mt-3 space-y-2">
          {DIFFICULTIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDifficulty(item)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                difficulty === item
                  ? 'border-violet-400/70 bg-violet-600/20'
                  : 'border-ink-600 bg-ink-800/70'
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${difficulty === item ? 'text-violet-200' : 'text-mist-200'}`}>
                  {DIFFICULTY_LABELS[item]}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-mist-500">{DIFFICULTY_DESCRIPTIONS[item]}</p>
              </div>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                  difficulty === item ? 'border-violet-300 bg-violet-400' : 'border-mist-700'
                }`}
              />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Qanday o'ynaladi?</h3>
        <div className="mt-3 space-y-3">
          {copy.instructions.map((instruction, index) => (
            <div key={instruction} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/25 font-mono text-xs font-bold text-violet-300">
                {index + 1}
              </span>
              <p className="pt-0.5 text-xs leading-relaxed text-mist-400">{instruction}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <Button className="w-full" onClick={() => onStart(config)}>
          O'yinni boshlash
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          icon={<UsersIcon width={17} height={17} />}
          onClick={() => void openFriends()}
        >
          Do'st bilan o'ynash
        </Button>
      </div>

      {friendsOpen && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-mist-200">Do'stni tanlang</h3>
              <p className="mt-1 text-[11px] text-mist-500">
                Tanlangan raund va qiyinlik ikkala o'yinchi uchun bir xil bo'ladi.
              </p>
            </div>
          </div>

          {friendsLoading ? (
            <p className="py-6 text-center text-sm text-mist-500">Yuklanmoqda...</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-ink-600 px-3 py-5 text-center text-sm text-mist-500">
              Hali do'stlaringiz yo'q. Avval Profil bo'limidan do'st qo'shing.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {friends.map((friend) => (
                <button
                  key={friend.friendshipId}
                  type="button"
                  disabled={Boolean(invitingId)}
                  onClick={() => void inviteFriend(friend)}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-3 text-left transition-colors active:bg-ink-700 disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600/20 font-display text-sm font-bold text-violet-200">
                    {friend.user.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-mist-100">{friend.user.displayName}</span>
                    {friend.user.username && (
                      <span className="block truncate text-xs text-mist-500">@{friend.user.username}</span>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-violet-300">
                    {invitingId === friend.user.id ? 'Yuborilmoqda...' : 'Chaqirish'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {inviteError && <p className="text-center text-xs text-signal-early">{inviteError}</p>}
    </div>
  );
}
