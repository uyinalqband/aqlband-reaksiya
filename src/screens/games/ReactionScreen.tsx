import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { SignalDisc } from '@/components/games/reaction/SignalDisc';
import { GameSetupPanel } from '@/components/game/GameSetupPanel';
import { GameSessionSummary } from '@/components/game/GameSessionSummary';
import { DuelGameResult } from '@/components/game/DuelGameResult';
import { CompareCard } from '@/components/game/CompareCard';
import { Button } from '@/components/ui/Button';
import { ShareIcon } from '@/components/ui/icons';
import { useReactionGame } from '@/features/games/reaction/useReactionGame';
import { readDuelGameContext } from '@/features/duel/duelSession';
import { formatMs } from '@/features/gameSession/metrics';
import {
  DIFFICULTY_LABELS,
  REACTION_PROFILES,
  resolveDifficulty,
  shouldFinishSession,
  type GameSessionConfig,
} from '@/features/gameSession/config';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { getBestDurationValue, useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { encodeStartParam, useChallengeStore } from '@/store/challengeStore';
import { BOT_USERNAME } from '@/lib/config';
import { shareChallenge } from '@/lib/telegram';
import type { ChallengePayload } from '@/types';

interface SessionSummary {
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts: number;
  opponent: ChallengePayload | null;
}

export function ReactionScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useTelegramUser();
  const duelContext = useMemo(() => readDuelGameContext(location.state, 'reaction'), [location.state]);
  const { phase, resultMs, start, registerTap, reset } = useReactionGame();
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const attempts = useGameHistoryStore((state) => state.attempts);
  const appUserId = useOnlineStore((state) => state.appUserId);
  const consumeChallenge = useChallengeStore((state) => state.consume);

  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const scoresRef = useRef<number[]>([]);
  const correctRef = useRef(0);
  const errorsRef = useRef(0);
  const timeoutsRef = useRef(0);
  const roundHandledRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const duelStartedRef = useRef(false);

  const clearTransition = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTransition();
      reset();
    };
  }, [clearTransition, reset]);

  const startRound = useCallback((roundNumber: number, sessionConfig: GameSessionConfig) => {
    clearTransition();
    roundHandledRef.current = false;
    setRound(roundNumber);
    reset();
    const baseDifficulty = resolveDifficulty(sessionConfig, roundNumber);
    const profile = REACTION_PROFILES[baseDifficulty];
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      start(profile);
    }, 180);
  }, [clearTransition, reset, start]);

  const beginSession = useCallback((sessionConfig: GameSessionConfig) => {
    scoresRef.current = [];
    correctRef.current = 0;
    errorsRef.current = 0;
    timeoutsRef.current = 0;
    setSummary(null);
    setConfig(sessionConfig);
    startRound(1, sessionConfig);
  }, [startRound]);

  const finishSession = useCallback((sessionConfig: GameSessionConfig) => {
    const scores = scoresRef.current;
    const averageMs = scores.length > 0
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 5_000;
    const completedRounds = scores.length;
    const previousBest = getBestDurationValue(attempts, 'reaction');
    const opponent = duelContext ? null : consumeChallenge();

    setSummary({
      averageMs,
      completedRounds,
      correct: correctRef.current,
      errors: errorsRef.current,
      timeouts: timeoutsRef.current,
      opponent,
    });

    void addAttempt({
      id: duelContext && appUserId ? `duel-${duelContext.duelId}-${appUserId}` : undefined,
      gameId: 'reaction',
      value: averageMs,
      metric: 'duration_ms',
      meta: {
        mode: 'solo',
        difficulty: sessionConfig.difficulty,
        rounds: completedRounds,
        selectedRounds: sessionConfig.rounds === 'survival' ? 0 : sessionConfig.rounds,
        survival: sessionConfig.rounds === 'survival',
        correct: correctRef.current,
        errors: errorsRef.current,
        timeouts: timeoutsRef.current,
        isNewBest: previousBest === null || averageMs < previousBest,
      },
    });
  }, [addAttempt, appUserId, attempts, consumeChallenge, duelContext]);

  useEffect(() => {
    if (!duelContext || duelStartedRef.current) return;
    duelStartedRef.current = true;
    beginSession(duelContext.config);
  }, [beginSession, duelContext]);

  const completeRound = useCallback((scoreMs: number, success: boolean, timeout: boolean) => {
    if (!config) return;
    scoresRef.current.push(Math.max(1, Math.round(scoreMs)));
    if (success) correctRef.current += 1;
    else if (timeout) timeoutsRef.current += 1;
    else errorsRef.current += 1;

    const completedRounds = scoresRef.current.length;
    const failed = !success;
    if (shouldFinishSession(config, completedRounds, failed)) {
      finishSession(config);
      return;
    }

    startRound(round + 1, config);
  }, [config, finishSession, round, startRound]);

  useEffect(() => {
    if (!config || roundHandledRef.current) return;
    const baseDifficulty = resolveDifficulty(config, round);
    const profile = REACTION_PROFILES[baseDifficulty];

    if (phase === 'result' && resultMs !== null) {
      roundHandledRef.current = true;
      transitionTimerRef.current = window.setTimeout(() => completeRound(resultMs, true, false), 650);
    } else if (phase === 'tooSoon') {
      roundHandledRef.current = true;
      transitionTimerRef.current = window.setTimeout(
        () => completeRound(profile.timeoutMs + 1_000, false, false),
        700,
      );
    } else if (phase === 'timeout') {
      roundHandledRef.current = true;
      transitionTimerRef.current = window.setTimeout(
        () => completeRound(profile.timeoutMs + 700, false, true),
        700,
      );
    }
  }, [completeRound, config, phase, resultMs, round]);

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const changeSettings = useCallback(() => {
    clearTransition();
    reset();
    setSummary(null);
    setConfig(null);
  }, [clearTransition, reset]);
  const handleBack = duelContext ? goHome : config ? changeSettings : goHome;
  useTelegramBackButton(handleBack);

  const handleSurfaceTap = useCallback(() => {
    if (phase === 'countdown' || phase === 'go') registerTap();
  }, [phase, registerTap]);

  const resolvedDifficulty = useMemo(
    () => (config ? resolveDifficulty(config, round) : 'medium'),
    [config, round],
  );
  const profile = REACTION_PROFILES[resolvedDifficulty];

  if (!config) {
    if (duelContext) {
      return <div className="flex min-h-screen items-center justify-center text-sm text-mist-500">O'yin ochilmoqda...</div>;
    }
    return (
      <Screen>
        <TopBar title="O'yin sozlamalari" onBack={goHome} />
        <GameSetupPanel gameId="reaction" onStart={beginSession} />
      </Screen>
    );
  }

  if (summary) {
    if (duelContext) {
      return (
        <Screen>
          <TopBar title="Do'st bilan natija" onBack={goHome} />
          <DuelGameResult
            context={duelContext}
            title="Reaksiya"
            emoji="⚡"
            averageMs={summary.averageMs}
            completedRounds={summary.completedRounds}
            correct={summary.correct}
            errors={summary.errors}
            timeouts={summary.timeouts}
            config={config}
            onHome={goHome}
          />
        </Screen>
      );
    }

    const handleShare = () => {
      const displayName = user?.firstName ?? 'AqlBand';
      const startParam = encodeStartParam({ t: summary.averageMs, n: displayName, u: user?.id });
      shareChallenge(BOT_USERNAME, startParam, `Mening o'rtacha reaksiya natijam ${formatMs(summary.averageMs)} ms. Bellashamizmi?`);
    };

    return (
      <Screen>
        <TopBar title="Natija" onBack={goHome} />
        <GameSessionSummary
          title="Reaksiya"
          emoji="⚡"
          averageMs={summary.averageMs}
          completedRounds={summary.completedRounds}
          correct={summary.correct}
          errors={summary.errors}
          timeouts={summary.timeouts}
          config={config}
          onReplay={() => beginSession(config)}
          onChangeSettings={changeSettings}
          onHome={goHome}
        >
          {summary.opponent && (
            <div className="mt-4 w-full">
              <CompareCard
                yourTimeMs={summary.averageMs}
                opponentTimeMs={summary.opponent.t}
                opponentName={summary.opponent.n}
              />
            </div>
          )}
          <Button className="mt-4 w-full max-w-xs" variant="secondary" icon={<ShareIcon width={17} height={17} />} onClick={handleShare}>
            Natijani ulashish
          </Button>
        </GameSessionSummary>
      </Screen>
    );
  }

  const discLabel =
    phase === 'result' && resultMs !== null
      ? formatMs(resultMs)
      : phase === 'go'
        ? t('game.goHint')
        : phase === 'tooSoon'
          ? t('game.tooSoonTitle')
          : phase === 'timeout'
            ? t('game.timeoutTitle')
            : t('game.waiting');

  const discSublabel =
    phase === 'result'
      ? 'ms'
      : phase === 'tooSoon' || phase === 'timeout'
        ? 'Keyingi raund tayyorlanmoqda...'
        : phase === 'go'
          ? t('game.tapAnywhere')
          : t('game.armedHint');

  return (
    <div
      onPointerDown={handleSurfaceTap}
      className="flex min-h-full w-full select-none flex-col px-5"
      style={{
        touchAction: 'manipulation',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <TopBar title="Reaksiya" onBack={duelContext ? goHome : changeSettings} />
      <div className="flex items-center justify-between text-xs text-mist-500">
        <span>Raund {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
        <span>{DIFFICULTY_LABELS[resolvedDifficulty]}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <div style={{ transform: `scale(${profile.discScale})` }}>
          <SignalDisc phase={phase} label={discLabel} sublabel={discSublabel} />
        </div>
        <p className="max-w-[17rem] text-center text-sm text-mist-500">
          Yakuniy natija barcha raundlarning o'rtacha millisekund qiymati bilan hisoblanadi.
        </p>
      </div>
    </div>
  );
}
