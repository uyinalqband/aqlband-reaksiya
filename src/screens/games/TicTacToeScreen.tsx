import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { readDuelGameContext } from '@/features/duel/duelSession';
import { createDuel, playTicTacToeMove, subscribeToDuel, cancelDuel } from '@/services/duelService';
import { getFriendList } from '@/services/friendService';
import { useOnlineStore } from '@/store/onlineStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { haptics } from '@/lib/telegram';
import { shareGameResult } from '@/lib/share';
import type { DuelRow } from '@/types/duel';
import type { FriendListEntry } from '@/types/friendship';
import type { GameSessionConfig } from '@/features/games/session/config';

const GAME_ID = 'tic-tac-toe' as const;
const DEFAULT_CONFIG: GameSessionConfig = {
  rounds: 1,
  difficulty: 'medium',
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function winningCells(board: string): number[] {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark !== '.' && mark === board[b] && mark === board[c]) return [...line];
  }
  return [];
}

export function TicTacToeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const duelContext = useMemo(
    () => readDuelGameContext(location.state, GAME_ID),
    [location.state],
  );

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const savedResultRef = useRef(false);

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useEffect(() => {
    if (!duelContext) return;
    return subscribeToDuel(
      duelContext.duelId,
      (result) => {
        setDuel(result);
        setGameError(null);
      },
      (error) => {
        setGameError(error instanceof Error ? error.message : t('errors.generic'));
      },
    );
  }, [duelContext, t]);

  const openFriends = useCallback(async () => {
    if (!isSupabaseConfigured || !appUserId) {
      setInviteError(t('setup.onlineRequired'));
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
      const created = await createDuel(friend.user.id, GAME_ID, DEFAULT_CONFIG);
      navigate('/duel', { state: { duelId: created.id, role: 'host' } });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : t('setup.inviteError'));
    } finally {
      setInvitingId(null);
    }
  };

  const board = (duel?.tic_tac_toe_board ?? '.........').padEnd(9, '.').slice(0, 9);
  const iAmHost = duelContext?.role === 'host';
  const myMark = iAmHost ? 'X' : 'O';
  const opponentMark = iAmHost ? 'O' : 'X';
  const myTurn = duel?.tic_tac_toe_turn === duelContext?.role;
  const winner = duel?.tic_tac_toe_winner ?? null;
  const won = winner === duelContext?.role;
  const draw = winner === 'draw';
  const finished = Boolean(winner) || duel?.status === 'finished';
  const winning = winningCells(board);
  const myName = iAmHost ? duel?.host_name : duel?.guest_name;
  const opponentName = duelContext?.opponentName ?? (iAmHost ? duel?.guest_name : duel?.host_name) ?? t('ticTacToe.opponent');

  useEffect(() => {
    if (!duelContext || !duel || !finished || savedResultRef.current || !appUserId) return;
    savedResultRef.current = true;

    const outcome = won ? 'win' : draw ? 'draw' : 'loss';
    void addAttempt({
      id: `tic-${duel.id}-${appUserId}`,
      gameId: GAME_ID,
      metric: 'correct_count',
      value: won ? 1 : 0,
      meta: {
        multiplayer: true,
        outcome,
        opponent: opponentName,
        moves: duel.tic_tac_toe_moves ?? 0,
        role: duelContext.role,
      },
    });
  }, [addAttempt, appUserId, draw, duel, duelContext, finished, opponentName, won]);

  const playCell = async (cell: number) => {
    if (!duelContext || moveBusy || finished || !myTurn || board[cell] !== '.') return;
    setMoveBusy(true);
    setGameError(null);
    try {
      haptics.selection();
      const result = await playTicTacToeMove(duelContext.duelId, cell);
      setDuel(result);
    } catch (error) {
      setGameError(error instanceof Error ? error.message : t('errors.generic'));
      haptics.error();
    } finally {
      setMoveBusy(false);
    }
  };

  const leaveGame = async () => {
    if (duelContext && duel && !finished) {
      const confirmed = window.confirm(t('ticTacToe.exitConfirm'));
      if (!confirmed) return;
      try {
        await cancelDuel(duelContext.duelId);
      } catch {
        // Navigating home is still safe if cancellation cannot be sent.
      }
    }
    goHome();
  };

  useTelegramBackButton(() => {
    void leaveGame();
  });

  if (!duelContext) {
    return (
      <Screen>
        <TopBar title={t('games.ticTacToe.title')} onBack={goHome} />

        <div className="text-center">
          <div className="text-6xl" aria-hidden="true">❌⭕</div>
          <h1 className="mt-4 font-display text-3xl font-bold text-mist-100">
            {t('games.ticTacToe.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">
            {t('games.ticTacToe.description')}
          </p>
        </div>

        <Card className="mt-6">
          <div className="grid grid-cols-3 gap-2 opacity-90">
            {['X', 'O', 'X', 'O', 'X', '', '', 'O', ''].map((mark, index) => (
              <div
                key={index}
                className="flex aspect-square items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 font-display text-4xl font-black"
              >
                <span className={mark === 'X' ? 'text-violet-300' : 'text-gold-300'}>{mark}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
            <p className="font-semibold text-mist-200">{t('ticTacToe.friendOnlyTitle')}</p>
            <p className="mt-1 text-sm leading-relaxed text-mist-500">
              {t('ticTacToe.friendOnlyDescription')}
            </p>
          </div>
        </Card>

        <Button className="mt-5 w-full" onClick={() => void openFriends()}>
          👥 {t('ticTacToe.inviteFriend')}
        </Button>

        {friendsOpen && (
          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold text-mist-100">
              {t('setup.chooseFriend')}
            </h2>

            {friendsLoading ? (
              <p className="py-8 text-center text-sm text-mist-500">{t('common.loading')}</p>
            ) : friends.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-ink-600 px-3 py-6 text-center text-sm text-mist-500">
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
                    className="flex w-full items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/80 px-3 py-3 text-left transition-transform active:scale-[0.985] disabled:opacity-50"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600/20 font-display text-sm font-bold text-violet-200">
                      {friend.user.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-mist-100">
                        {friend.user.displayName}
                      </span>
                      {friend.user.username ? (
                        <span className="block truncate text-xs text-mist-500">
                          @{friend.user.username}
                        </span>
                      ) : null}
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

        {inviteError ? (
          <p className="mt-3 text-center text-xs text-signal-early">{inviteError}</p>
        ) : null}
      </Screen>
    );
  }

  if (!duel) {
    return (
      <Screen>
        <TopBar title={t('games.ticTacToe.title')} onBack={() => void leaveGame()} />
        <Card className="mt-6 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-violet-500/25" />
          <p className="mt-4 text-sm text-mist-500">{t('common.loading')}</p>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={t('games.ticTacToe.title')} onBack={() => void leaveGame()} />

      <div className="flex items-center justify-between gap-3">
        <PlayerBadge
          name={myName ?? t('common.you')}
          mark={myMark}
          active={!finished && myTurn}
          accent="violet"
        />
        <span className="font-display text-sm font-bold text-mist-600">VS</span>
        <PlayerBadge
          name={opponentName}
          mark={opponentMark}
          active={!finished && !myTurn}
          accent="gold"
        />
      </div>

      <Card className="mt-5">
        <div className="text-center">
          <p className="font-display text-xl font-bold text-mist-100">
            {finished
              ? won
                ? t('ticTacToe.youWon')
                : draw
                  ? t('ticTacToe.draw')
                  : t('ticTacToe.youLost')
              : myTurn
                ? t('ticTacToe.yourTurn')
                : t('ticTacToe.opponentTurn', { name: opponentName })}
          </p>
          <p className="mt-1 text-sm text-mist-500">
            {t('ticTacToe.youAreMark', { mark: myMark })}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-[2rem] border border-ink-600 bg-ink-900/80 p-3">
          {board.split('').map((mark, index) => {
            const isWinning = winning.includes(index);
            const disabled = mark !== '.' || !myTurn || finished || moveBusy;

            return (
              <button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => void playCell(index)}
                className={`flex aspect-square items-center justify-center rounded-2xl border font-display text-[clamp(2.6rem,15vw,4.8rem)] font-black transition-all active:scale-95 ${
                  isWinning
                    ? 'border-gold-300 bg-gold-500/20 shadow-[0_0_28px_rgba(246,196,83,0.24)]'
                    : mark === '.'
                      ? 'border-ink-600 bg-ink-800/90'
                      : 'border-ink-500 bg-ink-700/90'
                } ${disabled && mark === '.' ? 'opacity-75' : ''}`}
              >
                {mark === 'X' ? (
                  <span className="text-violet-300 drop-shadow-[0_0_18px_rgba(167,139,250,0.35)]">X</span>
                ) : mark === 'O' ? (
                  <span className="text-gold-300 drop-shadow-[0_0_18px_rgba(246,196,83,0.35)]">O</span>
                ) : (
                  <span className="text-ink-600">·</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-ink-600/60 bg-ink-800/70 p-3 text-center">
            <p className="font-mono text-lg font-bold text-mist-100">
              {duel?.tic_tac_toe_moves ?? 0}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-mist-500">
              {t('ticTacToe.moves')}
            </p>
          </div>
          <div className="rounded-xl border border-ink-600/60 bg-ink-800/70 p-3 text-center">
            <p className="font-mono text-lg font-bold text-mist-100">
              {board.split('').filter((cell) => cell === '.').length}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-mist-500">
              {t('ticTacToe.emptyCells')}
            </p>
          </div>
        </div>
      </Card>

      {gameError ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-center text-xs text-red-200">
          {gameError}
        </p>
      ) : null}

      {finished ? (
        <div className="mt-5 space-y-3">
          <Button
            className="w-full"
            onClick={() =>
              void shareGameResult(
                t('games.ticTacToe.title'),
                won
                  ? t('ticTacToe.shareWin', { name: opponentName })
                  : draw
                    ? t('ticTacToe.shareDraw', { name: opponentName })
                    : t('ticTacToe.shareLoss', { name: opponentName }),
              )
            }
          >
            📤 {t('result.shareResult')}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => navigate('/games/tic-tac-toe', { replace: true })}
          >
            👥 {t('ticTacToe.playAgain')}
          </Button>
          <Button className="w-full" variant="secondary" onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </div>
      ) : (
        <Button className="mt-5 w-full" variant="secondary" onClick={() => void leaveGame()}>
          {t('ticTacToe.leaveGame')}
        </Button>
      )}
    </Screen>
  );
}

function PlayerBadge({
  name,
  mark,
  active,
  accent,
}: {
  name: string;
  mark: 'X' | 'O';
  active: boolean;
  accent: 'violet' | 'gold';
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-3 ${
      active
        ? accent === 'violet'
          ? 'border-violet-400 bg-violet-500/15'
          : 'border-gold-400 bg-gold-500/15'
        : 'border-ink-600 bg-ink-800/75'
    }`}>
      <span className={`font-display text-2xl font-black ${
        mark === 'X' ? 'text-violet-300' : 'text-gold-300'
      }`}>
        {mark}
      </span>
      <span className="min-w-0 truncate text-sm font-semibold text-mist-100">{name}</span>
    </div>
  );
}
