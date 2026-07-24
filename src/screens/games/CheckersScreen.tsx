import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { readDuelGameContext } from '@/features/duel/duelSession';
import {
  cancelDuel,
  createDuel,
  offerCheckersDraw,
  playCheckersMove,
  resignCheckers,
  respondCheckersDraw,
  subscribeToDuel,
  type DuelResult,
} from '@/services/duelService';
import { getFriendList } from '@/services/friendService';
import { useOnlineStore } from '@/store/onlineStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { haptics } from '@/lib/telegram';
import { shareGameResult } from '@/lib/share';
import type { FriendListEntry } from '@/types/friendship';
import type { GameSessionConfig } from '@/features/games/session/config';
import {
  CHECKERS_INITIAL_BOARD,
  countCheckersPieces,
  coordinateToIndex,
  getCheckersLegalMoves,
  parseCheckersBoard,
  pieceSide,
  roleToSide,
  type CheckersMove,
} from '@/features/games/checkers/logic';

const GAME_ID = 'checkers' as const;
const TURN_TIME_MS = 60_000;
const DEFAULT_CONFIG: GameSessionConfig = {
  rounds: 1,
  difficulty: 'medium',
};

function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `0:${String(seconds).padStart(2, '0')}`;
}

function opponentRole(role: 'host' | 'guest'): 'host' | 'guest' {
  return role === 'host' ? 'guest' : 'host';
}

export function CheckersScreen() {
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

  const [duel, setDuel] = useState<DuelResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
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

  useEffect(() => {
    if (!duelContext) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [duelContext]);

  const role = duelContext?.role ?? 'host';
  const mySide = roleToSide(role);
  const opponentSide = roleToSide(opponentRole(role));
  const board = useMemo(
    () => parseCheckersBoard(duel?.checkers_board ?? CHECKERS_INITIAL_BOARD),
    [duel?.checkers_board],
  );
  const forcedFrom = duel?.checkers_forced_from ?? null;
  const turnRole = duel?.checkers_turn ?? 'host';
  const myTurn = turnRole === role;
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
      myTurn && !finished
        ? getCheckersLegalMoves(board, mySide, forcedFrom)
        : [],
    [board, finished, forcedFrom, mySide, myTurn],
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

  const serverOffsetMs = duel ? duel.serverNow - Date.now() : 0;
  const deadlineMs = duel?.checkers_turn_deadline_at
    ? new Date(duel.checkers_turn_deadline_at).getTime()
    : duel?.game_start_at
      ? new Date(duel.game_start_at).getTime() + TURN_TIME_MS
      : 0;
  const remainingMs = deadlineMs > 0
    ? Math.max(0, deadlineMs - (clockNow + serverOffsetMs))
    : TURN_TIME_MS;

  const whitePieces = countCheckersPieces(board, 'white');
  const blackPieces = countCheckersPieces(board, 'black');
  const myPieces = mySide === 'white' ? whitePieces : blackPieces;
  const opponentPieces = opponentSide === 'white' ? whitePieces : blackPieces;
  const myCaptures =
    role === 'host'
      ? duel?.checkers_host_captures ?? 0
      : duel?.checkers_guest_captures ?? 0;
  const opponentCaptures =
    role === 'host'
      ? duel?.checkers_guest_captures ?? 0
      : duel?.checkers_host_captures ?? 0;
  const myPromotions =
    role === 'host'
      ? duel?.checkers_host_promotions ?? 0
      : duel?.checkers_guest_promotions ?? 0;
  const drawOfferBy = duel?.checkers_draw_offer_by ?? null;
  const opponentOfferedDraw =
    drawOfferBy !== null && drawOfferBy !== role;
  const myDrawOfferPending = drawOfferBy === role;

  useEffect(() => {
    if (
      !duelContext ||
      !duel ||
      !finished ||
      savedResultRef.current ||
      !appUserId
    ) {
      return;
    }

    savedResultRef.current = true;
    const outcome = won ? 'win' : draw ? 'draw' : 'loss';
    const durationMs =
      duel.finished_at && duel.game_start_at
        ? Math.max(
            0,
            new Date(duel.finished_at).getTime() -
              new Date(duel.game_start_at).getTime(),
          )
        : 0;

    void addAttempt({
      id: `checkers-${duel.id}-${appUserId}`,
      gameId: GAME_ID,
      metric: 'correct_count',
      value: won ? 1 : 0,
      meta: {
        multiplayer: true,
        outcome,
        opponent: opponentName,
        moves: duel.checkers_moves ?? 0,
        captured: myCaptures,
        opponentCaptured: opponentCaptures,
        promotions: myPromotions,
        durationMs,
        color: mySide,
        resultReason: duel.checkers_result_reason ?? 'unknown',
        role,
        won,
        draw,
      },
    });
  }, [
    addAttempt,
    appUserId,
    draw,
    duel,
    duelContext,
    finished,
    myCaptures,
    myPromotions,
    mySide,
    opponentCaptures,
    opponentName,
    role,
    won,
  ]);

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
      setInviteError(
        error instanceof Error ? error.message : t('setup.friendsLoadError'),
      );
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
      navigate('/duel', {
        state: { duelId: created.id, role: 'host' },
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
    if (!duelContext || moveBusy || !myTurn || finished) return;

    setMoveBusy(true);
    setGameError(null);
    try {
      haptics.selection();
      const result = await playCheckersMove(
        duelContext.duelId,
        move.from,
        move.to,
      );
      setDuel(result);
      setSelectedIndex(result.checkers_forced_from ?? null);
      if (result.checkers_winner === role) haptics.success();
    } catch (error) {
      haptics.error();
      setGameError(
        error instanceof Error ? error.message : t('errors.generic'),
      );
    } finally {
      setMoveBusy(false);
    }
  };

  const handleSquare = (index: number) => {
    if (!myTurn || finished || moveBusy) return;

    const targetMove = selectedMoves.find((move) => move.to === index);
    if (targetMove) {
      void makeMove(targetMove);
      return;
    }

    if (pieceSide(board[index]) === mySide && movesByFrom.has(index)) {
      setSelectedIndex(index);
      haptics.selection();
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

  const leaveGame = useCallback(async () => {
    if (!duelContext || !duel) {
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
  }, [duel, duelContext, finished, goHome, t]);

  useTelegramBackButton(() => {
    void leaveGame();
  });

  if (!duelContext) {
    return (
      <Screen>
        <TopBar title={t('games.checkers.title')} onBack={goHome} />

        <div className="text-center">
          <div className="text-6xl" aria-hidden="true">⚪⚫</div>
          <h1 className="mt-4 font-display text-3xl font-bold text-mist-100">
            {t('games.checkers.title')}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">
            {t('games.checkers.description')}
          </p>
        </div>

        <Card className="mt-6">
          <CheckersPreview />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <LobbyFeature icon="⏱️" text={t('checkers.oneMinuteRule')} />
            <LobbyFeature icon="⚔️" text={t('checkers.mandatoryCapture')} />
            <LobbyFeature icon="🤝" text={t('checkers.drawAndResign')} />
            <LobbyFeature icon="👑" text={t('checkers.flyingKings')} />
          </div>

          <div className="mt-4 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
            <p className="font-semibold text-mist-200">
              {t('checkers.friendOnlyTitle')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-mist-500">
              {t('checkers.friendOnlyDescription')}
            </p>
          </div>
        </Card>

        <Button className="mt-5 w-full" onClick={() => void openFriends()}>
          👥 {t('checkers.inviteFriend')}
        </Button>

        {friendsOpen && (
          <Card className="mt-4">
            <h2 className="font-display text-lg font-bold text-mist-100">
              {t('setup.chooseFriend')}
            </h2>

            {friendsLoading ? (
              <p className="py-8 text-center text-sm text-mist-500">
                {t('common.loading')}
              </p>
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
                      {invitingId === friend.user.id
                        ? t('setup.sending')
                        : t('setup.invite')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {inviteError ? (
          <p className="mt-3 text-center text-xs text-signal-early">
            {inviteError}
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
        <Card className="mt-6 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-violet-500/25" />
          <p className="mt-4 text-sm text-mist-500">{t('common.loading')}</p>
        </Card>
      </Screen>
    );
  }

  const statusText = finished
    ? won
      ? t('checkers.youWon')
      : draw
        ? t('checkers.draw')
        : t('checkers.youLost')
    : forcedFrom !== null && myTurn
      ? t('checkers.continueCapture')
      : myTurn
        ? t('checkers.yourTurn')
        : t('checkers.opponentTurn', { name: opponentName });

  return (
    <Screen>
      <TopBar
        title={t('games.checkers.title')}
        onBack={() => void leaveGame()}
      />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <PlayerBadge
          name={myName}
          side={mySide}
          active={!finished && myTurn}
          pieces={myPieces.total}
          kings={myPieces.kings}
        />
        <div className="text-center">
          <p
            className={`font-mono text-xl font-black tabular-nums ${
              remainingMs <= 10_000 && !finished
                ? 'text-red-400'
                : 'text-gold-400'
            }`}
          >
            {finished ? '—' : formatClock(remainingMs)}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-mist-600">
            {t('checkers.turnTime')}
          </p>
        </div>
        <PlayerBadge
          name={opponentName}
          side={opponentSide}
          active={!finished && !myTurn}
          pieces={opponentPieces.total}
          kings={opponentPieces.kings}
        />
      </div>

      <Card className="mt-4" padded={false}>
        <div className="flex items-center justify-between border-b border-ink-600/60 px-4 py-3">
          <div>
            <p className="font-display text-lg font-bold text-mist-100">
              {statusText}
            </p>
            <p className="mt-0.5 text-xs text-mist-500">
              {role === 'host'
                ? t('checkers.youAreWhite')
                : t('checkers.youAreBlack')}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-mono font-bold text-gold-400">
              {duel.checkers_moves ?? 0}
            </p>
            <p className="text-mist-600">{t('checkers.moves')}</p>
          </div>
        </div>

        <div className="mx-auto aspect-square w-full max-w-[28rem] border-x-4 border-b-4 border-[#5A331D] bg-[#D9B27C] p-1 shadow-[0_20px_50px_-25px_rgba(0,0,0,0.95)]">
          <div className="grid h-full grid-cols-8">
            {Array.from({ length: 64 }, (_, visualIndex) => {
              const visualRow = Math.floor(visualIndex / 8);
              const visualColumn = visualIndex % 8;
              const canonicalRow =
                role === 'guest' ? 7 - visualRow : visualRow;
              const canonicalColumn =
                role === 'guest' ? 7 - visualColumn : visualColumn;
              const index = coordinateToIndex(
                canonicalRow,
                canonicalColumn,
              );
              const dark = index !== null;

              if (!dark) {
                return (
                  <div
                    key={visualIndex}
                    className="bg-[#E8C99A]"
                  />
                );
              }

              const piece = board[index];
              const selected = selectedIndex === index;
              const target = selectedMoves.some((move) => move.to === index);
              const captureTarget = selectedMoves.some(
                (move) => move.to === index && move.captured !== null,
              );
              const movable = movesByFrom.has(index);
              const forced = forcedFrom === index;

              return (
                <button
                  key={visualIndex}
                  type="button"
                  onClick={() => handleSquare(index)}
                  disabled={!myTurn || finished || moveBusy}
                  className={`relative flex items-center justify-center bg-[#7A482B] transition-all ${
                    selected
                      ? 'z-10 shadow-[inset_0_0_0_4px_rgba(167,139,250,0.95)]'
                      : forced
                        ? 'shadow-[inset_0_0_0_4px_rgba(250,204,21,0.95)]'
                        : ''
                  }`}
                >
                  {target ? (
                    <span
                      className={`absolute z-10 rounded-full ${
                        captureTarget
                          ? 'h-[48%] w-[48%] border-4 border-gold-300 bg-gold-300/25'
                          : 'h-[22%] w-[22%] bg-violet-200/90'
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

        <div className="grid grid-cols-4 gap-2 border-t border-ink-600/60 px-3 py-3">
          <GameStat
            label={t('checkers.captured')}
            value={String(myCaptures)}
          />
          <GameStat
            label={t('checkers.opponentCaptured')}
            value={String(opponentCaptures)}
          />
          <GameStat
            label={t('checkers.promotions')}
            value={String(myPromotions)}
          />
          <GameStat
            label={t('checkers.remaining')}
            value={String(myPieces.total)}
          />
        </div>
      </Card>

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

      {finished ? (
        <div className="mt-5 space-y-3">
          <Card>
            <div className="text-center">
              <div className="text-5xl">
                {won ? '🏆' : draw ? '🤝' : '🎯'}
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-mist-100">
                {statusText}
              </p>
              <p className="mt-1 text-sm text-mist-500">
                {t(
                  `checkers.reasons.${
                    duel.checkers_result_reason ?? 'unknown'
                  }`,
                )}
              </p>
            </div>
          </Card>

          <Button
            className="w-full"
            onClick={() =>
              void shareGameResult(
                t('games.checkers.title'),
                won
                  ? t('checkers.shareWin', { name: opponentName })
                  : draw
                    ? t('checkers.shareDraw', { name: opponentName })
                    : t('checkers.shareLoss', { name: opponentName }),
              )
            }
          >
            📤 {t('result.shareResult')}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() =>
              navigate('/games/checkers', { replace: true })
            }
          >
            👥 {t('checkers.playAgain')}
          </Button>
          <Button className="w-full" variant="ghost" onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </div>
      ) : (
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
      )}
    </Screen>
  );
}

function LobbyFeature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/70 px-3 py-3 text-center">
      <div className="text-xl">{icon}</div>
      <p className="mt-1 text-[11px] font-medium leading-snug text-mist-400">
        {text}
      </p>
    </div>
  );
}

function CheckersPreview() {
  const board = parseCheckersBoard(CHECKERS_INITIAL_BOARD);

  return (
    <div className="mx-auto aspect-square w-full max-w-[18rem] border-4 border-[#5A331D] bg-[#D9B27C] p-1">
      <div className="grid h-full grid-cols-8">
        {Array.from({ length: 64 }, (_, visualIndex) => {
          const row = Math.floor(visualIndex / 8);
          const column = visualIndex % 8;
          const index = coordinateToIndex(row, column);

          if (index === null) {
            return <div key={visualIndex} className="bg-[#E8C99A]" />;
          }

          const piece = board[index];
          return (
            <div
              key={visualIndex}
              className="flex items-center justify-center bg-[#7A482B]"
            >
              {piece !== '.' ? (
                <CheckersPieceView
                  piece={piece}
                  movable={false}
                  selected={false}
                  compact
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckersPieceView({
  piece,
  movable,
  selected,
  compact = false,
}: {
  piece: 'w' | 'W' | 'b' | 'B';
  movable: boolean;
  selected: boolean;
  compact?: boolean;
}) {
  const white = piece === 'w' || piece === 'W';
  const king = piece === 'W' || piece === 'B';

  return (
    <span
      className={`relative flex ${
        compact ? 'h-[72%] w-[72%]' : 'h-[78%] w-[78%]'
      } items-center justify-center rounded-full border-[3px] shadow-[0_5px_8px_rgba(0,0,0,0.38)] transition-transform ${
        white
          ? 'border-[#D8C9A8] bg-gradient-to-br from-[#FFF8E8] to-[#D8C7A4]'
          : 'border-[#161219] bg-gradient-to-br from-[#4A414D] to-[#17131A]'
      } ${
        movable
          ? 'ring-2 ring-violet-300/65 ring-offset-1 ring-offset-[#7A482B]'
          : ''
      } ${selected ? 'scale-105' : ''}`}
    >
      <span
        className={`absolute inset-[17%] rounded-full border ${
          white
            ? 'border-[#B7A47E]/80'
            : 'border-[#6C6170]/70'
        }`}
      />
      {king ? (
        <span className="relative z-10 text-[clamp(0.7rem,4vw,1.55rem)] drop-shadow">
          👑
        </span>
      ) : null}
    </span>
  );
}

function PlayerBadge({
  name,
  side,
  active,
  pieces,
  kings,
}: {
  name: string;
  side: 'white' | 'black';
  active: boolean;
  pieces: number;
  kings: number;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-3 ${
        active
          ? 'border-violet-400/55 bg-violet-500/15'
          : 'border-ink-600 bg-ink-800/75'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-5 w-5 shrink-0 rounded-full border shadow ${
            side === 'white'
              ? 'border-[#D8C9A8] bg-[#F5EBD6]'
              : 'border-[#211A23] bg-[#332B35]'
          }`}
        />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-mist-100">
          {name}
        </p>
      </div>
      <p className="mt-2 font-mono text-[11px] text-mist-500">
        {pieces} · 👑 {kings}
      </p>
    </div>
  );
}

function GameStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-600/55 bg-ink-800/70 px-2 py-2 text-center">
      <p className="font-mono text-sm font-bold text-mist-100">{value}</p>
      <p className="mt-1 text-[8px] uppercase tracking-wide text-mist-600">
        {label}
      </p>
    </div>
  );
}
