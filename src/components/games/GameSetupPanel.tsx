import { useCallback, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getGameDefinition, type SoloGameId } from '@/features/games/catalog';
import {
  DEFAULT_GAME_SESSION,
  DIFFICULTIES,
  type Difficulty,
  type GameSessionConfig,
  type RoundSelection,
} from '@/features/games/session/config';
import { getFriendList } from '@/services/friendService';
import { createDuel } from '@/services/duelService';
import { useOnlineStore } from '@/store/onlineStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { FriendListEntry } from '@/types/friendship';

interface Props {
  gameId: SoloGameId;
  onStart: (config: GameSessionConfig) => void;
}

const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function GameSetupPanel({ gameId, onStart }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const game = getGameDefinition(gameId)!;
  const isSudoku = gameId === 'sudoku';
  const availableRounds = isSudoku ? ([1, 2, 3] as const) : ROUNDS;

  const [rounds, setRounds] = useState<RoundSelection>(isSudoku ? 1 : DEFAULT_GAME_SESSION.rounds);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SESSION.difficulty);
  const [memorySize, setMemorySize] = useState(4);
  const [nBack, setNBack] = useState(2);
  const [puzzleShuffle, setPuzzleShuffle] = useState(40);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const config: GameSessionConfig = { rounds, difficulty, memorySize, nBack, puzzleShuffle };

  const openFriends = useCallback(async () => {
    if (!isSupabaseConfigured || !appUserId) {
      setInviteError(t('setup.onlineRequired'));
      return;
    }

    const open = !friendsOpen;
    setFriendsOpen(open);
    setInviteError(null);
    if (!open || friends.length > 0) return;

    setFriendsLoading(true);
    try {
      const entries = await getFriendList(appUserId);
      setFriends(entries.filter((entry) => entry.status === 'accepted'));
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : t('setup.friendsLoadError'));
    } finally {
      setFriendsLoading(false);
    }
  }, [appUserId, friends.length, friendsOpen, t]);

  const inviteFriend = async (friend: FriendListEntry) => {
    if (invitingId) return;
    setInvitingId(friend.user.id);
    setInviteError(null);
    try {
      const duel = await createDuel(friend.user.id, gameId, config);
      navigate('/duel', { state: { duelId: duel.id, role: 'host' } });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : t('setup.inviteError'));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl" aria-hidden="true">{game.emoji}</div>
        <h1 className="mt-3 font-display text-2xl font-bold">{t(game.titleKey)}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">{t(game.descriptionKey)}</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold">{t('setup.rounds')}</h3>
        <div className={`mt-3 grid gap-2 ${isSudoku ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {availableRounds.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setRounds(count)}
              className={`h-10 rounded-xl border font-mono font-bold transition-colors ${
                rounds === count
                  ? 'border-violet-400 bg-violet-600 text-white shadow-glow'
                  : 'border-ink-600 bg-ink-800 text-mist-400'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        {!isSudoku && (
          <button
            type="button"
            onClick={() => setRounds('survival')}
            className={`mt-2 h-11 w-full rounded-xl border text-sm font-semibold transition-colors ${
              rounds === 'survival'
                ? 'border-gold-400 bg-gold-500/15 text-gold-300'
                : 'border-ink-600 bg-ink-800 text-mist-400'
            }`}
          >
            ♾️ {t('setup.survival')}
          </button>
        )}
        {isSudoku && (
          <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs leading-relaxed text-violet-200">
            {t('sudoku.setupInfo')}
          </p>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">{t('setup.difficulty')}</h3>
        <div className="mt-3 space-y-2">
          {DIFFICULTIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDifficulty(item)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                difficulty === item ? 'border-violet-400 bg-violet-600/20' : 'border-ink-600 bg-ink-800'
              }`}
            >
              <p className="text-sm font-semibold">{t(`difficulty.${item}.title`)}</p>
              <p className="mt-1 text-xs text-mist-500">{t(`difficulty.${item}.description`)}</p>
            </button>
          ))}
        </div>
      </Card>

      {game.customSetup === 'memory' && (
        <Card>
          <h3 className="text-sm font-semibold">{t('setup.memorySize')}</h3>
          <input
            type="range"
            min="3"
            max="8"
            value={memorySize}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMemorySize(Number(event.target.value))}
            className="mt-4 w-full"
          />
          <p className="mt-2 text-center font-mono text-gold-400">{memorySize}</p>
        </Card>
      )}

      {game.customSetup === 'nback' && (
        <Card>
          <h3 className="text-sm font-semibold">N-Back</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setNBack(value)}
                className={`h-11 rounded-xl border ${
                  nBack === value ? 'border-violet-400 bg-violet-600' : 'border-ink-600 bg-ink-800'
                }`}
              >
                {value}-Back
              </button>
            ))}
          </div>
        </Card>
      )}

      {game.customSetup === 'puzzle' && (
        <Card>
          <h3 className="text-sm font-semibold">{t('setup.shuffle')}</h3>
          <input
            type="range"
            min="10"
            max="120"
            step="10"
            value={puzzleShuffle}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPuzzleShuffle(Number(event.target.value))}
            className="mt-4 w-full"
          />
          <p className="mt-2 text-center font-mono text-gold-400">{puzzleShuffle}</p>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold">{t('setup.howTo')}</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-mist-400">{t(game.instructionsKey)}</p>
      </Card>

      <Button className="w-full" onClick={() => onStart(config)}>{t('setup.start')}</Button>
      <Button className="w-full" variant="secondary" onClick={() => void openFriends()}>
        👥 {t('setup.friend')}
      </Button>

      {friendsOpen && (
        <Card>
          <h3 className="text-sm font-semibold">{t('setup.chooseFriend')}</h3>
          <p className="mt-1 text-xs text-mist-500">{t('setup.sameSettings')}</p>

          {friendsLoading ? (
            <p className="py-6 text-center text-sm text-mist-500">{t('common.loading')}</p>
          ) : friends.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-ink-600 px-3 py-5 text-center text-sm text-mist-500">
              {t('setup.noFriends')}
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {friends.map((friend) => (
                <button
                  key={friend.friendshipId}
                  type="button"
                  disabled={Boolean(invitingId)}
                  onClick={() => void inviteFriend(friend)}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/80 px-3 py-3 text-left disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600/20 font-display text-sm font-bold text-violet-200">
                    {friend.user.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{friend.user.displayName}</span>
                    {friend.user.username && <span className="block truncate text-xs text-mist-500">@{friend.user.username}</span>}
                  </span>
                  <span className="text-xs font-semibold text-violet-300">
                    {invitingId === friend.user.id ? t('setup.sending') : t('setup.invite')}
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
