import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { makeDuelGameState, readDuelGameContext } from '@/features/duel/duelSession';
import {
  cancelDuel,
  createDuel,
  offerCheckersDraw,
  playCheckersMove,
  resignCheckers,
  requestCheckersRematch,
  respondCheckersDraw,
  subscribeToDuel,
  type DuelResult,
} from '@/services/duelService';
import { getFriendList } from '@/services/friendService';
import {
  getRatedCheckersQueueStatus,
  joinRatedCheckersQueue,
  leaveRatedCheckersQueue,
} from '@/services/checkersPlatformService';
import { useOnlineStore } from '@/store/onlineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { haptics } from '@/lib/telegram';
import { checkersMusic, checkersMusicIntensity } from '@/lib/checkersMusic';
import type { FriendListEntry } from '@/types/friendship';
import type { MatchmakingStatus } from '@/types/checkersPlatform';
import type { GameSessionConfig } from '@/features/games/session/config';
import {
  CHECKERS_INITIAL_BOARD,
  coordinateToIndex,
  getCheckersLegalMoves,
  parseCheckersBoard,
  pieceSide,
  roleToSide,
  applyCheckersMove,
  type CheckersMove,
  type CheckersPiece,
} from '@/features/games/checkers/logic';

const GAME_ID = 'checkers' as const;
const TURN_TIME_MS = 60_000;
const DEFAULT_CONFIG: GameSessionConfig = {
  rounds: 1,
  difficulty: 'medium',
};

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function opponentRole(role: 'host' | 'guest'): 'host' | 'guest' {
  return role === 'host' ? 'guest' : 'host';
}

export function CheckersScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const appUserId = useOnlineStore((state) => state.appUserId);
  const musicEnabled = useSettingsStore((state) => state.musicEnabled);
  const musicVolume = useSettingsStore((state) => state.musicVolume);
  const toggleMusic = useSettingsStore((state) => state.toggleMusic);

  const duelContext = useMemo(
    () => readDuelGameContext(location.state, GAME_ID),
    [location.state],
  );

  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [duel, setDuel] = useState<DuelResult | null>(null);
  const [optimisticBoard, setOptimisticBoard] = useState<CheckersPiece[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const startHandledRef = useRef(false);
  const resultMusicPlayedRef = useRef(false);
  const [matchmaking, setMatchmaking] = useState<MatchmakingStatus | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [resultActionError, setResultActionError] = useState<string | null>(null);
  const [showMatchIntro, setShowMatchIntro] = useState(false);
  const introDuelRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!duelContext) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [duelContext]);

  useEffect(() => {
    const duelId = duel?.id;
    const duelStatus = duel?.status;
    const moveCount = duel?.checkers_moves ?? 0;
    const gameStartAt = duel?.game_start_at ?? null;

    if (
      !duelId ||
      duelStatus !== 'playing' ||
      moveCount !== 0 ||
      introDuelRef.current === duelId
    ) {
      return;
    }

    const startedAt = gameStartAt
      ? new Date(gameStartAt).getTime()
      : Date.now();
    if (Math.abs(Date.now() - startedAt) > 8_000) return;

    introDuelRef.current = duelId;
    setShowMatchIntro(true);
    const timer = window.setTimeout(() => {
      setShowMatchIntro(false);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    duel?.checkers_moves,
    duel?.game_start_at,
    duel?.id,
    duel?.status,
  ]);

  const role = duelContext?.role ?? 'host';
  const mySide = roleToSide(role);
  const opponentSide = roleToSide(opponentRole(role));
  const serverBoard = useMemo(
    () => parseCheckersBoard(duel?.checkers_board ?? CHECKERS_INITIAL_BOARD),
    [duel?.checkers_board],
  );
  const board = optimisticBoard ?? serverBoard;
  const forcedFrom = duel?.checkers_forced_from ?? null;
  const turnRole = duel?.checkers_turn ?? 'host';
  const playing = duel?.status === 'playing';
  const myTurn = playing && turnRole === role;
  const finished = duel?.status === 'finished' && Boolean(duel.checkers_winner);
  const winner = duel?.checkers_winner ?? null;
  const won = winner === role;
  const draw = winner === 'draw';
  const opponentName =
    duelContext?.opponentName ??
    (role === 'host' ? duel?.guest_name : duel?.host_name) ??
    t('checkers.opponent');
  const myName =
    role === 'host'
      ? duel?.host_name ?? t('common.you')
      : duel?.guest_name ?? t('common.you');

  const legalMoves = useMemo(
    () =>
      playing && myTurn && !finished
        ? getCheckersLegalMoves(board, mySide, forcedFrom)
        : [],
    [board, finished, forcedFrom, mySide, myTurn, playing],
  );
  const movesByFrom = useMemo(() => {
    const map = new Map<number, CheckersMove[]>();
    for (const move of legalMoves) {
      const current = map.get(move.from) ?? [];
      current.push(move);
      map.set(move.from, current);
    }
    return map;
  }, [legalMoves]);
  const selectedMoves = selectedIndex === null
    ? []
    : movesByFrom.get(selectedIndex) ?? [];

  useEffect(() => {
    if (!myTurn || finished) {
      setSelectedIndex(null);
      return;
    }

    if (forcedFrom !== null) {
      setSelectedIndex(forcedFrom);
      return;
    }

    if (
      selectedIndex !== null &&
      !movesByFrom.has(selectedIndex)
    ) {
      setSelectedIndex(null);
    }
  }, [finished, forcedFrom, movesByFrom, myTurn, selectedIndex]);

  useEffect(() => {
    if (
      !myTurn ||
      finished ||
      moveBusy ||
      forcedFrom !== null ||
      selectedIndex !== null ||
      movesByFrom.size !== 1
    ) {
      return;
    }
    const onlySource = movesByFrom.keys().next().value as number | undefined;
    if (typeof onlySource === 'number') setSelectedIndex(onlySource);
  }, [finished, forcedFrom, moveBusy, movesByFrom, myTurn, selectedIndex]);

  const serverOffsetMs = duel ? duel.serverNow - Date.now() : 0;
  const deadlineMs = duel?.checkers_turn_deadline_at
    ? new Date(duel.checkers_turn_deadline_at).getTime()
    : duel?.game_start_at
      ? new Date(duel.game_start_at).getTime() + TURN_TIME_MS
      : 0;
  const remainingMs = deadlineMs > 0
    ? Math.max(0, deadlineMs - (clockNow + serverOffsetMs))
    : TURN_TIME_MS;

  const myCaptures =
    role === 'host'
      ? duel?.checkers_host_captures ?? 0
      : duel?.checkers_guest_captures ?? 0;
  const opponentCaptures =
    role === 'host'
      ? duel?.checkers_guest_captures ?? 0
      : duel?.checkers_host_captures ?? 0;
  const drawOfferBy = duel?.checkers_draw_offer_by ?? null;
  const opponentOfferedDraw =
    drawOfferBy !== null && drawOfferBy !== role;
  const myDrawOfferPending = drawOfferBy === role;
  const ratedMatch = duel?.checkers_mode === 'rated';
  const ratingBefore =
    role === 'host'
      ? duel?.checkers_host_rating_before ?? null
      : duel?.checkers_guest_rating_before ?? null;
  const opponentRating =
    role === 'host'
      ? duel?.checkers_guest_rating_before ?? null
      : duel?.checkers_host_rating_before ?? null;
  const myRating = ratingBefore;
  const opponentUserId =
    role === 'host' ? duel?.guest_user_id ?? null : duel?.host_user_id ?? null;

  useEffect(() => {
    checkersMusic.configure(musicEnabled, musicVolume);
  }, [musicEnabled, musicVolume]);

  useEffect(() => {
    if (!duelContext || duel?.status !== 'playing' || finished) {
      if (!finished) checkersMusic.stop();
      return;
    }

    checkersMusic.start(
      checkersMusicIntensity(remainingMs, myTurn),
    );
    return () => checkersMusic.stop();
  }, [duelContext, duel?.status]);

  useEffect(() => {
    if (duel?.status !== 'playing' || finished) return;
    checkersMusic.setIntensity(
      checkersMusicIntensity(remainingMs, myTurn),
    );
  }, [duel?.status, finished, myTurn, remainingMs]);

  useEffect(() => {
    if (!finished || resultMusicPlayedRef.current) return;
    resultMusicPlayedRef.current = true;
    if (won) checkersMusic.victory();
    else if (draw) checkersMusic.draw();
    else checkersMusic.defeat();
  }, [draw, finished, won]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) checkersMusic.suspend();
      else checkersMusic.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      checkersMusic.stop();
    };
  }, []);


  const startRatedMatch = useCallback(async () => {
    if (!isSupabaseConfigured || !appUserId || queueBusy) {
      if (!isSupabaseConfigured || !appUserId) {
        setQueueError(t('setup.onlineRequired'));
      }
      return;
    }

    checkersMusic.unlock();
    setQueueBusy(true);
    setQueueError(null);
    try {
      const status = await joinRatedCheckersQueue();
      setMatchmaking(status);
      if (status.state === 'matched' && status.duelId && status.role) {
        navigate('/games/checkers', {
          state: makeDuelGameState({
            duelId: status.duelId,
            role: status.role,
            gameId: GAME_ID,
            config: DEFAULT_CONFIG,
            opponentName: status.opponentName ?? t('checkers.opponent'),
          }),
          replace: true,
        });
      }
    } catch (error) {
      setQueueError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setQueueBusy(false);
    }
  }, [appUserId, navigate, queueBusy, t]);

  const stopRatedSearch = useCallback(async () => {
    setQueueBusy(true);
    try {
      await leaveRatedCheckersQueue();
      setMatchmaking(null);
    } finally {
      setQueueBusy(false);
    }
  }, []);

  useEffect(() => {
    if (duelContext || matchmaking?.state !== 'searching') return;

    let stopped = false;
    const refresh = async () => {
      try {
        const status = await joinRatedCheckersQueue();
        if (stopped) return;
        setMatchmaking(status);
        if (status.state === 'matched' && status.duelId && status.role) {
          navigate('/games/checkers', {
            state: makeDuelGameState({
              duelId: status.duelId,
              role: status.role,
              gameId: GAME_ID,
              config: DEFAULT_CONFIG,
              opponentName: status.opponentName ?? t('checkers.opponent'),
            }),
            replace: true,
          });
        }
      } catch (error) {
        if (!stopped) {
          setQueueError(
            error instanceof Error ? error.message : t('errors.generic'),
          );
        }
      }
    };

    const timer = window.setInterval(() => void refresh(), 1500);
    void refresh();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [duelContext, matchmaking?.state, navigate, t]);

  const openFriends = useCallback(async () => {
    if (!isSupabaseConfigured || !appUserId) {
      setInviteError(t('setup.onlineRequired'));
      return;
    }

    checkersMusic.unlock();
    const nextOpen = !friendsOpen;
    setFriendsOpen(nextOpen);
    setInviteError(null);
    if (!nextOpen || friends.length > 0) return;

    setFriendsLoading(true);
    try {
      const entries = await getFriendList(appUserId);
      setFriends(entries.filter((entry) => entry.status === 'accepted'));
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : t('setup.friendsLoadError'),
      );
    } finally {
      setFriendsLoading(false);
    }
  }, [appUserId, friends.length, friendsOpen, t]);

  useEffect(() => {
    if (duelContext || startHandledRef.current) return;
    const requestedMode = (
      location.state as { startMode?: 'rated' | 'friendly' } | null
    )?.startMode;
    if (!requestedMode) return;
    startHandledRef.current = true;

    if (requestedMode === 'rated') {
      void startRatedMatch();
    } else {
      void openFriends();
    }
  }, [duelContext, location.state, openFriends, startRatedMatch]);

  useEffect(() => {
    if (duelContext) return;
    const requestedMode = (
      location.state as { startMode?: 'rated' | 'friendly' } | null
    )?.startMode;
    if (requestedMode) return;

    let cancelled = false;
    void getRatedCheckersQueueStatus()
      .then((status) => {
        if (cancelled || status.state === 'idle') return;
        setMatchmaking(status);
        if (status.state === 'matched' && status.duelId && status.role) {
          navigate('/games/checkers', {
            state: makeDuelGameState({
              duelId: status.duelId,
              role: status.role,
              gameId: GAME_ID,
              config: DEFAULT_CONFIG,
              opponentName: status.opponentName ?? t('checkers.opponent'),
            }),
            replace: true,
          });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [duelContext, location.state, navigate]);

  const inviteFriend = async (friend: FriendListEntry) => {
    if (invitingId) return;
    checkersMusic.unlock();
    setInvitingId(friend.user.id);
    setInviteError(null);

    try {
      const created = await createDuel(friend.user.id, GAME_ID, DEFAULT_CONFIG);
      setDuel(created);
      setFriendsOpen(false);
      navigate('/games/checkers', {
        replace: true,
        state: makeDuelGameState({
          duelId: created.id,
          role: 'host',
          gameId: GAME_ID,
          config: DEFAULT_CONFIG,
          opponentName: friend.user.displayName,
        }),
      });
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : t('setup.inviteError'),
      );
    } finally {
      setInvitingId(null);
    }
  };

  const makeMove = async (move: CheckersMove) => {
    if (!duelContext || moveBusy || !playing || !myTurn || finished) return;

    setMoveBusy(true);
    setGameError(null);
    try {
      haptics.selection();
      const beforeCaptures =
        role === 'host'
          ? duel?.checkers_host_captures ?? 0
          : duel?.checkers_guest_captures ?? 0;
      const beforePromotions =
        role === 'host'
          ? duel?.checkers_host_promotions ?? 0
          : duel?.checkers_guest_promotions ?? 0;

      setOptimisticBoard(applyCheckersMove(board, move));
      setSelectedIndex(null);

      const result = await playCheckersMove(
        duelContext.duelId,
        move.from,
        move.to,
      );
      setDuel(result);
      setOptimisticBoard(null);
      setSelectedIndex(result.checkers_forced_from ?? null);

      const afterCaptures =
        role === 'host'
          ? result.checkers_host_captures ?? 0
          : result.checkers_guest_captures ?? 0;
      const afterPromotions =
        role === 'host'
          ? result.checkers_host_promotions ?? 0
          : result.checkers_guest_promotions ?? 0;

      if (afterPromotions > beforePromotions) checkersMusic.promotion();
      else if (afterCaptures > beforeCaptures) checkersMusic.capture();
      else checkersMusic.move();

      if (result.checkers_winner === role) haptics.success();
    } catch (error) {
      setOptimisticBoard(null);
      haptics.error();
      setGameError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setMoveBusy(false);
    }
  };

  const handleSquare = (index: number) => {
    if (!playing || !myTurn || finished || moveBusy) return;

    const targetMove = selectedMoves.find((move) => move.to === index);
    if (targetMove) {
      void makeMove(targetMove);
      return;
    }

    if (pieceSide(board[index]) === mySide && movesByFrom.has(index)) {
      if (selectedIndex === index && forcedFrom === null) {
        setSelectedIndex(null);
      } else {
        setSelectedIndex(index);
        haptics.selection();
      }
      return;
    }

    if (forcedFrom === null) setSelectedIndex(null);
  };

  const resign = async () => {
    if (!duelContext || finished || actionBusy) return;
    if (!window.confirm(t('checkers.resignConfirm'))) return;

    setActionBusy('resign');
    setGameError(null);
    try {
      setDuel(await resignCheckers(duelContext.duelId));
    } catch (error) {
      setGameError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setActionBusy(null);
    }
  };

  const offerDraw = async () => {
    if (!duelContext || finished || actionBusy || drawOfferBy) return;

    setActionBusy('draw');
    setGameError(null);
    try {
      setDuel(await offerCheckersDraw(duelContext.duelId));
    } catch (error) {
      setGameError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setActionBusy(null);
    }
  };

  const answerDraw = async (accept: boolean) => {
    if (!duelContext || actionBusy) return;

    setActionBusy(accept ? 'accept-draw' : 'reject-draw');
    setGameError(null);
    try {
      setDuel(await respondCheckersDraw(duelContext.duelId, accept));
    } catch (error) {
      setGameError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setActionBusy(null);
    }
  };

  const resetFinishedSession = () => {
    setDuel(null);
    setOptimisticBoard(null);
    setSelectedIndex(null);
    setMoveBusy(false);
    setActionBusy(null);
    setGameError(null);
    setResultActionError(null);
    resultMusicPlayedRef.current = false;
    startHandledRef.current = false;
  };

  const playAnotherMatch = () => {
    const nextMode = ratedMatch ? 'rated' : 'friendly';
    resetFinishedSession();
    navigate('/games/checkers', {
      replace: true,
      state: {
        startMode: nextMode,
        restartAt: Date.now(),
      },
    });
  };

  const requestRematch = async () => {
    if (!duelContext || !opponentUserId || rematchBusy) return;

    setRematchBusy(true);
    setResultActionError(null);
    try {
      const created = await requestCheckersRematch(
        duelContext.duelId,
      );
      resultMusicPlayedRef.current = false;
      introDuelRef.current = null;
      setOptimisticBoard(null);
      setSelectedIndex(null);
      setDuel(created);
      navigate('/games/checkers', {
        replace: true,
        state: makeDuelGameState({
          duelId: created.id,
          role: 'host',
          gameId: GAME_ID,
          config: DEFAULT_CONFIG,
          opponentName,
        }),
      });
    } catch (error) {
      setResultActionError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setRematchBusy(false);
    }
  };

  const leaveGame = useCallback(async () => {
    if (!duelContext || !duel) {
      if (matchmaking?.state === 'searching') {
        try {
          await leaveRatedCheckersQueue();
        } catch {
          // Leaving the screen remains safe if queue cleanup is delayed.
        }
      }
      goHome();
      return;
    }

    if (finished) {
      goHome();
      return;
    }

    if (duel.status === 'playing') {
      if (!window.confirm(t('checkers.leaveAsResignConfirm'))) return;
      try {
        await resignCheckers(duelContext.duelId);
      } catch {
        // The timeout or opponent action may have finished the game already.
      }
      goHome();
      return;
    }

    if (!window.confirm(t('checkers.exitConfirm'))) return;
    try {
      await cancelDuel(duelContext.duelId);
    } catch {
      // Leaving the lobby is still safe if cancellation cannot be sent.
    }
    goHome();
  }, [duel, duelContext, finished, goHome, matchmaking?.state, t]);

  useTelegramBackButton(() => {
    void leaveGame();
  });

  const handleMusicToggle = async () => {
    checkersMusic.unlock();
    const nextEnabled = !musicEnabled;
    await toggleMusic();
    checkersMusic.configure(nextEnabled, musicVolume);
  };

  if (!duelContext) {
    const searching = matchmaking?.state === 'searching';

    if (searching) {
      return (
        <Screen>
          <TopBar
            title={t('games.checkers.title')}
            onBack={() => void leaveGame()}
          />
          <div className="flex min-h-[68vh] flex-col items-center justify-center text-center">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-500/10">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/10" />
              <span className="relative text-4xl">⚔️</span>
            </div>
            <h1 className="mt-6 font-display text-2xl font-extrabold text-mist-100">
              {t('v2.searchingOpponent')}
            </h1>
            <p className="mt-2 font-mono text-sm font-bold text-emerald-300">
              ±{matchmaking?.expandedRange ?? 100} ELO
            </p>
            <Button
              className="mt-8 w-full max-w-xs"
              variant="secondary"
              disabled={queueBusy}
              onClick={() => void stopRatedSearch()}
            >
              {t('common.cancel')}
            </Button>
            {queueError ? (
              <p className="mt-4 max-w-xs text-xs text-red-300">
                {queueError}
              </p>
            ) : null}
          </div>
        </Screen>
      );
    }

    if (friendsOpen) {
      return (
        <Screen>
          <TopBar
            title={t('v2.friendMatch')}
            onBack={() => setFriendsOpen(false)}
          />
          <div className="mb-5">
            <h1 className="font-display text-2xl font-extrabold text-mist-100">
              {t('setup.chooseFriend')}
            </h1>
            <p className="mt-2 text-sm text-mist-500">
              {t('v2.friendRatingSafe')}
            </p>
          </div>

          {friendsLoading ? (
            <Card className="text-center">
              <p className="py-8 text-sm text-mist-500">
                {t('common.loading')}
              </p>
            </Card>
          ) : friends.length === 0 ? (
            <Card className="text-center">
              <p className="py-8 text-sm text-mist-500">
                {t('setup.noFriends')}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {friends.map((friend) => (
                <button
                  key={friend.friendshipId}
                  type="button"
                  disabled={Boolean(invitingId)}
                  onClick={() => void inviteFriend(friend)}
                  className="glass-panel flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left active:scale-[0.985] disabled:opacity-50"
                >
                  <UserAvatar
                    name={friend.user.displayName}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-mist-100">
                      {friend.user.displayName}
                    </span>
                    {friend.user.username ? (
                      <span className="block truncate text-xs text-mist-600">
                        @{friend.user.username}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-bold text-violet-300">
                    {invitingId === friend.user.id
                      ? t('setup.sending')
                      : t('setup.invite')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {inviteError ? (
            <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-3 text-center text-xs text-red-200">
              {inviteError}
            </p>
          ) : null}
        </Screen>
      );
    }

    return (
      <Screen>
        <TopBar
          title={t('games.checkers.title')}
          onBack={() => void leaveGame()}
        />

        <section className="premium-border rounded-3xl bg-gradient-to-br from-[#182B48] via-[#101B2A] to-[#08101A] p-5 text-center">
          <div className="text-6xl" aria-hidden="true">⚪⚫</div>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-mist-100">
            {t('games.checkers.title')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-mist-500">
            {t('checkers.firstMoveTwoMinutes')}
          </p>
        </section>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            disabled={queueBusy}
            onClick={() => void startRatedMatch()}
            className="rounded-3xl bg-gradient-to-r from-violet-500 to-violet-600 p-5 text-left shadow-glow disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-xl font-extrabold text-white">
                ⚔️ {t('v2.findOpponent')}
              </p>
              <span className="text-2xl">→</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void openFriends()}
            className="glass-panel rounded-3xl p-5 text-left active:scale-[0.985]"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-xl font-extrabold text-mist-100">
                👥 {t('v2.friendMatch')}
              </p>
              <span className="text-2xl text-mist-600">→</span>
            </div>
          </button>
        </div>

        {queueError ? (
          <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-3 text-center text-xs text-red-200">
            {queueError}
          </p>
        ) : null}
      </Screen>
    );
  }

  if (!duel) {
    return (
      <Screen>
        <TopBar
          title={t('games.checkers.title')}
          onBack={() => void leaveGame()}
        />
        <div className="flex min-h-[62vh] items-center justify-center">
          <div className="h-14 w-14 animate-pulse rounded-3xl bg-violet-500/20" />
        </div>
      </Screen>
    );
  }

  if (duel.status === 'invited' || duel.status === 'waiting') {
    return (
      <Screen>
        <TopBar
          title={t('games.checkers.title')}
          onBack={() => void leaveGame()}
        />
        <div className="flex min-h-[64vh] flex-col items-center justify-center text-center">
          <UserAvatar name={opponentName} size="xl" />
          <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">
            {opponentName}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-mist-500">
            {t('duel.waitingAcceptance')}
          </p>
          <Button
            className="mt-8 w-full max-w-xs"
            variant="secondary"
            onClick={() => void leaveGame()}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (duel.status === 'ready_check' || duel.status === 'countdown') {
    return (
      <Screen>
        <TopBar
          title={t('games.checkers.title')}
          onBack={() => void leaveGame()}
        />
        <div className="flex min-h-[62vh] items-center justify-center">
          <div className="h-14 w-14 animate-pulse rounded-3xl bg-emerald-500/20" />
        </div>
      </Screen>
    );
  }



  if (showMatchIntro) {
    return (
      <Screen>
        <TopBar
          title={t('games.checkers.title')}
          onBack={() => void leaveGame()}
          hideAvatar
        />
        <div className="flex min-h-[66vh] flex-col items-center justify-center text-center">
          <div className="flex items-center gap-5">
            <UserAvatar currentUser name={myName} size="xl" active />
            <span className="text-3xl" aria-hidden="true">⚔️</span>
            <UserAvatar name={opponentName} size="xl" active />
          </div>
          <h1 className="mt-7 font-display text-3xl font-extrabold text-mist-100">
            {myName} <span className="text-mist-600">vs</span> {opponentName}
          </h1>
          <p className="mt-3 text-sm font-semibold text-emerald-300">
            {t('duel.openingGame')}
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="pb-8">
      <TopBar
        title={t('games.checkers.title')}
        onBack={() => void leaveGame()}
        hideAvatar
      />

      <PlayerPanel
        name={opponentName}
        side={opponentSide}
        active={!finished && !myTurn}
        rating={opponentRating}
        time={
          !finished && !myTurn
            ? formatClock(remainingMs)
            : '—:—'
        }
        captures={opponentCaptures}
        capturedSide={mySide}
      />


      <div className="premium-border mx-auto aspect-square w-[93%] max-w-[25rem] overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#293D57] via-[#101B2B] to-[#070D15] p-2 shadow-[0_28px_65px_-28px_rgba(0,0,0,.98)]">
        <div className="grid h-full grid-cols-8 overflow-hidden rounded-[1.25rem] border border-white/10">
          {Array.from({ length: 64 }, (_, visualIndex) => {
            const visualRow = Math.floor(visualIndex / 8);
            const visualColumn = visualIndex % 8;
            const canonicalRow = role === 'guest' ? 7 - visualRow : visualRow;
            const canonicalColumn = role === 'guest' ? 7 - visualColumn : visualColumn;
            const index = coordinateToIndex(canonicalRow, canonicalColumn);
            const dark = index !== null;

            if (!dark) {
              return (
                <div
                  key={visualIndex}
                  className="bg-gradient-to-br from-[#AFC0D5] to-[#8296AD]"
                />
              );
            }

            const piece = board[index];
            const selected = selectedIndex === index;
            const targetMove = selectedMoves.find((move) => move.to === index);
            const movable = movesByFrom.has(index);
            const forced = forcedFrom === index;

            return (
              <button
                key={visualIndex}
                type="button"
                disabled={!myTurn || finished || moveBusy}
                onClick={() => handleSquare(index)}
                className={`relative flex touch-manipulation items-center justify-center bg-gradient-to-br from-[#304965] to-[#1D3048] select-none ${
                  selected
                    ? 'z-10 shadow-[inset_0_0_0_4px_rgba(134,105,255,.95),inset_0_0_24px_rgba(134,105,255,.38)]'
                    : forced
                      ? 'shadow-[inset_0_0_0_4px_rgba(242,172,50,.9)]'
                      : movable && myTurn
                        ? 'shadow-[inset_0_0_0_1px_rgba(91,229,181,.25)]'
                        : ''
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {targetMove ? (
                  <span
                    className={`pointer-events-none absolute z-10 rounded-full ${
                      targetMove.captured !== null
                        ? 'h-[52%] w-[52%] border-[3px] border-gold-300 bg-gold-300/16 shadow-[0_0_20px_rgba(242,172,50,.35)]'
                        : 'h-[22%] w-[22%] bg-emerald-300 shadow-[0_0_16px_rgba(91,229,181,.65)]'
                    }`}
                  />
                ) : null}

                {piece !== '.' ? (
                  <CheckersPieceView
                    piece={piece}
                    movable={movable && myTurn && !finished}
                    selected={selected}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <PlayerPanel
          name={myName}
          side={mySide}
          active={!finished && myTurn}
          rating={myRating}
          time={
            !finished && myTurn
              ? formatClock(remainingMs)
              : '—:—'
          }
          captures={myCaptures}
          capturedSide={opponentSide}
          currentUser
          musicEnabled={musicEnabled}
          onMusicToggle={() => void handleMusicToggle()}
        />
      </div>

      {opponentOfferedDraw && !finished ? (
        <Card className="mt-4 border-gold-400/35 bg-gold-500/10">
          <p className="font-display text-lg font-bold text-mist-100">
            🤝 {t('checkers.drawOfferTitle')}
          </p>
          <p className="mt-1 text-sm text-mist-500">
            {t('checkers.drawOfferDescription', { name: opponentName })}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              size="md"
              disabled={Boolean(actionBusy)}
              onClick={() => void answerDraw(true)}
            >
              {t('checkers.acceptDraw')}
            </Button>
            <Button
              size="md"
              variant="secondary"
              disabled={Boolean(actionBusy)}
              onClick={() => void answerDraw(false)}
            >
              {t('checkers.rejectDraw')}
            </Button>
          </div>
        </Card>
      ) : null}

      {myDrawOfferPending && !finished ? (
        <p className="mt-3 rounded-xl border border-gold-400/25 bg-gold-500/10 px-3 py-3 text-center text-xs text-gold-200">
          {t('checkers.drawOfferPending')}
        </p>
      ) : null}

      {gameError ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-center text-xs text-red-200">
          {gameError}
        </p>
      ) : null}

      {!finished ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="md"
            disabled={
              Boolean(actionBusy) ||
              Boolean(drawOfferBy) ||
              duel.status !== 'playing'
            }
            onClick={() => void offerDraw()}
          >
            🤝 {t('checkers.offerDraw')}
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={Boolean(actionBusy) || duel.status !== 'playing'}
            onClick={() => void resign()}
          >
            🏳️ {t('checkers.resign')}
          </Button>
        </div>
      ) : null}

      {finished ? (
        <CheckersResultModal
          duel={duel}
          viewerRole={role}
          ratedMatch={ratedMatch}
          resultReason={duel.checkers_result_reason ?? 'unknown'}
          rematchBusy={rematchBusy}
          actionError={resultActionError}
          onRematch={() => void requestRematch()}
          onPlayAgain={playAnotherMatch}
          onHome={goHome}
        />
      ) : null}
    </Screen>
  );
}


function CheckersResultModal({
  duel,
  viewerRole,
  ratedMatch,
  resultReason,
  rematchBusy,
  actionError,
  onRematch,
  onPlayAgain,
  onHome,
}: {
  duel: DuelResult;
  viewerRole: 'host' | 'guest';
  ratedMatch: boolean;
  resultReason: string;
  rematchBusy: boolean;
  actionError: string | null;
  onRematch: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();

  const participant = (participantRole: 'host' | 'guest') => {
    const before =
      participantRole === 'host'
        ? duel.checkers_host_rating_before ?? 1200
        : duel.checkers_guest_rating_before ?? 1200;
    const delta =
      participantRole === 'host'
        ? duel.checkers_host_rating_delta ?? 0
        : duel.checkers_guest_rating_delta ?? 0;
    const after =
      participantRole === 'host'
        ? duel.checkers_host_rating_after ?? before + delta
        : duel.checkers_guest_rating_after ?? before + delta;

    return {
      role: participantRole,
      name:
        participantRole === 'host'
          ? duel.host_name
          : duel.guest_name ?? t('checkers.opponent'),
      before,
      after,
      delta: ratedMatch ? delta : 0,
      currentUser: participantRole === viewerRole,
    };
  };

  const host = participant('host');
  const guest = participant('guest');
  const winnerRole = duel.checkers_winner;
  const winner =
    winnerRole === 'host' ? host : winnerRole === 'guest' ? guest : null;
  const loser =
    winnerRole === 'host' ? guest : winnerRole === 'guest' ? host : null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+.75rem)] pt-6 backdrop-blur-md">
      <Card
        padded={false}
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#0B1523] shadow-[0_30px_90px_-35px_rgba(0,0,0,1)]"
      >
        <div className="border-b border-white/8 bg-gradient-to-br from-violet-500/16 via-transparent to-emerald-500/10 px-5 py-5 text-center">
          <div className="text-5xl">
            {winner ? '🏆' : '🤝'}
          </div>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-mist-100">
            {winner
              ? t('checkers.matchFinished')
              : t('checkers.draw')}
          </h2>
          <p className="mt-1 text-sm text-mist-500">
            {t(`checkers.reasons.${resultReason}`)}
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          {winner && loser ? (
            <>
              <ResultPlayerRow
                label={t('checkers.winnerLabel')}
                player={winner}
                positive
                ratedMatch={ratedMatch}
              />
              <ResultPlayerRow
                label={t('checkers.loserLabel')}
                player={loser}
                positive={false}
                ratedMatch={ratedMatch}
              />
            </>
          ) : (
            <>
              <ResultPlayerRow
                label={t('checkers.drawPlayerLabel')}
                player={host}
                ratedMatch={ratedMatch}
              />
              <ResultPlayerRow
                label={t('checkers.drawPlayerLabel')}
                player={guest}
                ratedMatch={ratedMatch}
              />
            </>
          )}

          {!ratedMatch ? (
            <p className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 text-center text-xs text-mist-500">
              {t('v2.friendRatingSafe')}
            </p>
          ) : null}

          {actionError ? (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-center text-xs text-red-200">
              {actionError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              disabled={rematchBusy || !duel.guest_user_id}
              onClick={onRematch}
            >
              🔁 {rematchBusy ? t('common.loading') : t('checkers.rematch')}
            </Button>
            <Button variant="secondary" onClick={onPlayAgain}>
              ⚔️ {t('checkers.playAnother')}
            </Button>
          </div>
          <Button className="w-full" variant="ghost" onClick={onHome}>
            {t('result.homeCta')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ResultPlayerRow({
  label,
  player,
  positive,
  ratedMatch,
}: {
  label: string;
  player: {
    name: string;
    before: number;
    after: number;
    delta: number;
    currentUser: boolean;
  };
  positive?: boolean;
  ratedMatch: boolean;
}) {
  const deltaText =
    player.delta > 0
      ? `+${player.delta}`
      : String(player.delta);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-ink-800/70 px-3 py-3">
      <UserAvatar
        currentUser={player.currentUser}
        name={player.name}
        size="md"
        active={positive}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
          positive ? 'text-emerald-300' : 'text-mist-500'
        }`}>
          {label}
        </p>
        <p className="mt-1 truncate font-display text-base font-extrabold text-mist-100">
          {player.name}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-base font-black text-gold-300">
          🏆 {player.after}
        </p>
        <p className={`mt-1 font-mono text-xs font-black ${
          player.delta > 0
            ? 'text-emerald-300'
            : player.delta < 0
              ? 'text-red-300'
              : 'text-mist-500'
        }`}>
          {ratedMatch ? `${deltaText} ELO` : '0 ELO'}
        </p>
      </div>
    </div>
  );
}

function CheckersPieceView({
  piece,
  movable,
  selected,
}: {
  piece: 'w' | 'W' | 'b' | 'B';
  movable: boolean;
  selected: boolean;
}) {
  const white = piece === 'w' || piece === 'W';
  const king = piece === 'W' || piece === 'B';

  return (
    <span
      className={`pointer-events-none relative flex h-[79%] w-[79%] items-center justify-center rounded-full border-[2px] transition-transform duration-100 ${
        white
          ? 'border-white/80 bg-gradient-to-br from-[#FFFFFF] via-[#DDE8F3] to-[#8FA4BA] shadow-[inset_-5px_-7px_10px_rgba(45,67,91,.35),inset_4px_4px_8px_rgba(255,255,255,.9),0_7px_12px_rgba(0,0,0,.42)]'
          : 'border-[#59677A] bg-gradient-to-br from-[#4B5B70] via-[#172234] to-[#05090F] shadow-[inset_-5px_-7px_10px_rgba(0,0,0,.72),inset_4px_4px_8px_rgba(153,176,205,.25),0_7px_12px_rgba(0,0,0,.55)]'
      } ${
        movable
          ? 'ring-2 ring-emerald-300/55 ring-offset-1 ring-offset-[#243A55]'
          : ''
      } ${selected ? 'scale-110' : ''}`}
    >
      <span
        className={`absolute inset-[15%] rounded-full border-2 ${
          white
            ? 'border-[#8498AE]/45 shadow-[inset_0_2px_4px_rgba(255,255,255,.8)]'
            : 'border-[#8596AA]/25 shadow-[inset_0_2px_5px_rgba(255,255,255,.12)]'
        }`}
      />
      <span
        className={`absolute inset-[27%] rounded-full border ${
          white ? 'border-[#6E8198]/30' : 'border-[#AFC2D8]/15'
        }`}
      />
      {king ? (
        <span className="relative z-10 text-[clamp(.68rem,4vw,1.45rem)] drop-shadow-[0_3px_5px_rgba(0,0,0,.55)]">
          ♛
        </span>
      ) : null}
    </span>
  );
}

function PlayerPanel({
  name,
  side,
  active,
  rating,
  time,
  captures,
  capturedSide,
  currentUser = false,
  musicEnabled,
  onMusicToggle,
}: {
  name: string;
  side: 'white' | 'black';
  active: boolean;
  rating: number | null;
  time: string;
  captures: number;
  capturedSide: 'white' | 'black';
  currentUser?: boolean;
  musicEnabled?: boolean;
  onMusicToggle?: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 transition-colors ${
        active
          ? 'border-emerald-300/30 bg-ink-800/82'
          : 'border-white/10 bg-ink-800/72'
      }`}
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          currentUser={currentUser}
          name={name}
          size="sm"
          active={active}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-display text-sm font-extrabold text-mist-100">
              {name}
            </p>
            <span
              className={`h-4 w-4 shrink-0 rounded-full border ${
                side === 'white'
                  ? 'border-white/80 bg-gradient-to-br from-white to-[#AFC0D5]'
                  : 'border-[#59677A] bg-gradient-to-br from-[#46566B] to-[#05090F]'
              }`}
            />
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            <span className="font-mono font-black text-gold-300">
              🏆 {rating ?? 1200}
            </span>
            <span
              className={`font-mono font-black tabular-nums ${
                active ? 'text-emerald-300' : 'text-mist-600'
              }`}
            >
              ⏱ {time}
            </span>
          </div>
        </div>
        {onMusicToggle ? (
          <button
            type="button"
            onClick={onMusicToggle}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base active:scale-95 ${
              musicEnabled
                ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-black/15 text-mist-600'
            }`}
            aria-label="music"
          >
            {musicEnabled ? '♫' : '♪̸'}
          </button>
        ) : null}
      </div>

      <CapturedStones count={captures} side={capturedSide} />
    </div>
  );
}

function CapturedStones({
  count,
  side,
}: {
  count: number;
  side: 'white' | 'black';
}) {
  const visible = Math.max(0, Math.min(12, count));
  return (
    <div className="mt-2 flex min-h-3.5 flex-wrap items-center gap-1" aria-label="captured pieces">
      {visible === 0 ? (
        Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className="h-3 w-3 rounded-full border border-white/5 bg-black/10 opacity-35"
          />
        ))
      ) : (
        Array.from({ length: visible }, (_, index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full border shadow-[0_2px_4px_rgba(0,0,0,.45)] ${
              side === 'white'
                ? 'border-white/70 bg-gradient-to-br from-white to-[#AFC0D5]'
                : 'border-[#59677A] bg-gradient-to-br from-[#46566B] to-[#05090F]'
            }`}
          />
        ))
      )}
    </div>
  );
}
