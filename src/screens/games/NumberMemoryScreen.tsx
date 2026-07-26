import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { GameSessionSummary } from '@/components/games/GameSessionSummary';
import { DuelGameResult } from '@/components/games/DuelGameResult';
import {
  MEMORY_PROFILES,
  getSoloGameSession,
  progressiveExtraRound,
  resolveDifficulty,
  shouldFinishSession,
  type GameSessionConfig,
} from '@/features/games/session/config';
import { readDuelGameContext } from '@/features/duel/duelSession';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';
import { createRoundRandom, randomInteger, shuffleRandom, type RandomSource } from '@/features/games/shared/random';

const FEEDBACK_MS = 650;

type Phase = 'memorize' | 'recall' | 'feedback';

interface SessionSummary {
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts: number;
}

function randomNumber(digits: number, random: RandomSource): number {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return randomInteger(random, min, max);
}

function generateOptions(correct: number, digits: number, optionCount: number, random: RandomSource): number[] {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  const values = new Set<number>([correct]);
  const spread = Math.max(20, 10 ** Math.max(1, digits - 2));

  while (values.size < optionCount) {
    let candidate = correct + randomInteger(random, -spread, spread - 1);
    if (candidate === correct) candidate += 1;
    candidate = Math.min(max, Math.max(min, candidate));
    values.add(candidate);
  }

  return shuffleRandom(Array.from(values), random);
}

function getRoundProfile(config: GameSessionConfig, round: number) {
  const base = MEMORY_PROFILES[resolveDifficulty(config, round)];
  const extra = progressiveExtraRound(config, round);

  return {
    ...base,
    digits: Math.min(12, base.digits + extra),
    memorizeMs: Math.max(500, base.memorizeMs - extra * 75),
    recallTimeoutMs: Math.max(1_200, base.recallTimeoutMs - extra * 60),
    optionCount: Math.min(8, base.optionCount + Math.floor((extra + 1) / 2)),
    wrongPenaltyMs: base.wrongPenaltyMs + extra * 90,
  };
}

export function NumberMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const duelContext = useMemo(() => readDuelGameContext(location.state, 'number-memory'), [location.state]);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const appUserId = useOnlineStore((state) => state.appUserId);

  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [correctNumber, setCorrectNumber] = useState(1234);
  const [options, setOptions] = useState<number[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const scoresRef = useRef<number[]>([]);
  const correctRef = useRef(0);
  const errorsRef = useRef(0);
  const timeoutsRef = useRef(0);
  const recallStartedAtRef = useRef(0);
  const memorizeTimerRef = useRef<number | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const duelStartedRef = useRef(false);
  const clearTimers = useCallback(() => {
    for (const timerRef of [memorizeTimerRef, answerTimerRef, feedbackTimerRef]) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setupRound = useCallback((roundNumber: number, sessionConfig: GameSessionConfig) => {
    clearTimers();
    const profile = getRoundProfile(sessionConfig, roundNumber);
    const random = createRoundRandom(duelContext?.duelId, 'number-memory', roundNumber);
    const number = randomNumber(profile.digits, random);

    setRound(roundNumber);
    setCorrectNumber(number);
    setOptions(generateOptions(number, profile.digits, profile.optionCount, random));
    setLastCorrect(null);
    setPhase('memorize');

    memorizeTimerRef.current = window.setTimeout(() => {
      memorizeTimerRef.current = null;
      recallStartedAtRef.current = performance.now();
      setPhase('recall');
    }, profile.memorizeMs);
  }, [clearTimers, duelContext?.duelId]);

  const beginSession = useCallback((sessionConfig: GameSessionConfig) => {
    scoresRef.current = [];
    correctRef.current = 0;
    errorsRef.current = 0;
    timeoutsRef.current = 0;
    setSummary(null);
    setConfig(sessionConfig);
    setupRound(1, sessionConfig);
  }, [setupRound]);

  useEffect(() => {
    if (!duelContext || duelStartedRef.current) return;
    duelStartedRef.current = true;
    beginSession(duelContext.config);
  }, [beginSession, duelContext]);

  useEffect(() => {
    if (duelContext || config) return;
    beginSession(getSoloGameSession('number-memory'));
  }, [beginSession, config, duelContext]);

  const finishSession = useCallback((sessionConfig: GameSessionConfig) => {
    clearTimers();
    const completedRounds = scoresRef.current.length;
    const averageMs = completedRounds > 0
      ? Math.round(scoresRef.current.reduce((sum, value) => sum + value, 0) / completedRounds)
      : 60_000;

    setSummary({
      averageMs,
      completedRounds,
      correct: correctRef.current,
      errors: errorsRef.current,
      timeouts: timeoutsRef.current,
    });

    void addAttempt({
      id: duelContext && appUserId ? `duel-${duelContext.duelId}-${appUserId}` : undefined,
      gameId: 'number-memory',
      value: averageMs,
      metric: 'duration_ms',
      meta: {
        difficulty: sessionConfig.difficulty,
        rounds: completedRounds,
        selectedRounds: sessionConfig.rounds === 'survival' ? 0 : sessionConfig.rounds,
        survival: sessionConfig.rounds === 'survival',
        correct: correctRef.current,
        errors: errorsRef.current,
        timeouts: timeoutsRef.current,
      },
    });
  }, [addAttempt, appUserId, clearTimers, duelContext]);

  const completeRound = useCallback((scoreMs: number, success: boolean, timedOut = false) => {
    if (!config) return;
    scoresRef.current.push(Math.max(1, Math.round(scoreMs)));
    if (success) correctRef.current += 1;
    else if (timedOut) timeoutsRef.current += 1;
    else errorsRef.current += 1;

    const completedRounds = scoresRef.current.length;
    if (shouldFinishSession(config, completedRounds, !success)) {
      finishSession(config);
    } else {
      setupRound(round + 1, config);
    }
  }, [config, finishSession, round, setupRound]);

  useEffect(() => {
    if (!config || phase !== 'recall' || summary) return;
    const profile = getRoundProfile(config, round);

    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
    answerTimerRef.current = window.setTimeout(() => {
      answerTimerRef.current = null;
      setLastCorrect(false);
      setPhase('feedback');
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
      feedbackTimerRef.current = window.setTimeout(() => {
        feedbackTimerRef.current = null;
        completeRound(profile.recallTimeoutMs + profile.wrongPenaltyMs, false, true);
      }, FEEDBACK_MS);
    }, profile.recallTimeoutMs);

    return () => {
      if (answerTimerRef.current !== null) {
        window.clearTimeout(answerTimerRef.current);
        answerTimerRef.current = null;
      }
    };
  }, [completeRound, config, hapticsEnabled, phase, round, soundEnabled, summary]);

  const handleAnswer = (choice: number) => {
    if (!config || phase !== 'recall') return;
    if (answerTimerRef.current !== null) {
      window.clearTimeout(answerTimerRef.current);
      answerTimerRef.current = null;
    }

    const profile = getRoundProfile(config, round);
    const elapsed = Math.max(1, performance.now() - recallStartedAtRef.current);
    const isCorrect = choice === correctNumber;

    setLastCorrect(isCorrect);
    setPhase('feedback');
    if (isCorrect) {
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
    } else {
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      completeRound(isCorrect ? elapsed : elapsed + profile.wrongPenaltyMs, isCorrect);
    }, FEEDBACK_MS);
  };

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const resolvedDifficulty = useMemo(
    () => (config ? resolveDifficulty(config, round) : 'medium'),
    [config, round],
  );
  const profile = getRoundProfile(config ?? getSoloGameSession('number-memory'), round);

  if (!config) {
    return (
      <Screen className="mini-game-screen">
        <TopBar title={t('common.loading')} onBack={goHome} />
        <div className="flex min-h-[55vh] items-center justify-center">
          <div className="h-14 w-14 animate-pulse rounded-3xl bg-violet-500/20" />
        </div>
      </Screen>
    );
  }

  if (summary) {
    if (duelContext) {
      return (
        <Screen className="mini-game-screen">
          <TopBar title={t('result.duelTitle')} onBack={goHome} />
          <DuelGameResult
            context={duelContext}
            title={t('games.numberMemory.title')}
            emoji="🧠"
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

    return (
      <Screen className="mini-game-screen">
        <TopBar title={t('result.title')} onBack={goHome} />
        <GameSessionSummary
          title={t('games.numberMemory.title')}
          emoji="🧠"
          averageMs={summary.averageMs}
          completedRounds={summary.completedRounds}
          correct={summary.correct}
          errors={summary.errors}
          timeouts={summary.timeouts}
          config={config}
          onReplay={() => beginSession(config)}
          onChangeSettings={goHome}
          onHome={goHome}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={t('games.numberMemory.title')} onBack={goHome} />
      <div className="flex items-center justify-between text-xs text-mist-500">
        <span>{t('gameplay.round')} {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
        <span>{t(`difficulty.${resolvedDifficulty}.title`)}</span>
      </div>

      <div className="flex flex-col items-center">
        {phase === 'memorize' && (
          <>
            <p className="mt-10 text-sm text-mist-500">{t('gameplay.rememberNumber')}</p>
            <div className={`mt-5 max-w-full break-all text-center font-mono font-bold text-mist-100 ${
              profile.digits >= 10 ? 'text-3xl' : profile.digits >= 7 ? 'text-4xl' : profile.digits >= 6 ? 'text-5xl' : 'text-6xl'
            }`}>
              {correctNumber}
            </div>
            <p className="mt-4 text-xs text-mist-600">{t('gameplay.digitsCount', { count: profile.digits })}</p>
          </>
        )}

        {phase === 'recall' && (
          <>
            <p className="mt-9 text-sm text-mist-500">{t('gameplay.whichNumber')}</p>
            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleAnswer(option)}
                  className="rounded-2xl border border-ink-600 bg-ink-800 py-5 font-mono text-xl font-bold text-mist-100 active:bg-ink-700"
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'feedback' && (
          <div className="mt-16 flex flex-col items-center gap-2">
            <p className={`text-2xl font-bold ${lastCorrect ? 'text-signal-go' : 'text-signal-early'}`}>
              {lastCorrect ? "To'g'ri!" : "Noto'g'ri yoki vaqt tugadi!"}
            </p>
            {!lastCorrect && <p className="text-sm text-mist-500">To'g'ri javob: {correctNumber}</p>}
          </div>
        )}
      </div>
    </Screen>
  );
}
