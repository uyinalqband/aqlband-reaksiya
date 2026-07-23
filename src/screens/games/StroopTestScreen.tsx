import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { GameSetupPanel } from '@/components/game/GameSetupPanel';
import { GameSessionSummary } from '@/components/game/GameSessionSummary';
import { DuelGameResult } from '@/components/game/DuelGameResult';
import {
  DIFFICULTY_LABELS,
  STROOP_PROFILES,
  resolveDifficulty,
  shouldFinishSession,
  type GameSessionConfig,
} from '@/features/gameSession/config';
import { readDuelGameContext } from '@/features/duel/duelSession';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';

const FEEDBACK_MS = 420;

const COLORS = [
  { key: 'green', label: 'Yashil', bg: 'bg-green-500' },
  { key: 'red', label: 'Qizil', bg: 'bg-red-500' },
  { key: 'blue', label: "Ko'k", bg: 'bg-blue-500' },
  { key: 'yellow', label: 'Sariq', bg: 'bg-yellow-400' },
  { key: 'purple', label: 'Binafsha', bg: 'bg-purple-500' },
  { key: 'orange', label: "To'q sariq", bg: 'bg-orange-500' },
] as const;

type ColorKey = (typeof COLORS)[number]['key'];

interface SessionSummary {
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts: number;
}

function randomIndex(max: number): number {
  return Math.floor(Math.random() * max);
}

function createPrompt(colorCount: number): { wordIndex: number; renderIndex: number } {
  const renderIndex = randomIndex(colorCount);
  let wordIndex = randomIndex(colorCount);
  if (colorCount > 1 && Math.random() < 0.85) {
    while (wordIndex === renderIndex) wordIndex = randomIndex(colorCount);
  }
  return { wordIndex, renderIndex };
}

export function StroopTestScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const duelContext = useMemo(() => readDuelGameContext(location.state, 'stroop-test'), [location.state]);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const appUserId = useOnlineStore((state) => state.appUserId);

  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [wordIndex, setWordIndex] = useState(0);
  const [renderIndex, setRenderIndex] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const roundStartAtRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const correctRef = useRef(0);
  const errorsRef = useRef(0);
  const timeoutsRef = useRef(0);
  const roundTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const duelStartedRef = useRef(false);
  const clearTimers = useCallback(() => {
    if (roundTimerRef.current !== null) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

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
      gameId: 'stroop-test',
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

  const setupRound = useCallback((roundNumber: number, sessionConfig: GameSessionConfig) => {
    clearTimers();
    const difficulty = resolveDifficulty(sessionConfig, roundNumber);
    const profile = STROOP_PROFILES[difficulty];
    const prompt = createPrompt(profile.colorCount);

    setRound(roundNumber);
    setWordIndex(prompt.wordIndex);
    setRenderIndex(prompt.renderIndex);
    setFeedback(null);
    roundStartAtRef.current = performance.now();

    roundTimerRef.current = window.setTimeout(() => {
      roundTimerRef.current = null;
      timeoutsRef.current += 1;
      scoresRef.current.push(profile.timeoutMs + profile.wrongPenaltyMs);
      setFeedback('timeout');
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        const completedRounds = scoresRef.current.length;
        if (shouldFinishSession(sessionConfig, completedRounds, true)) finishSession(sessionConfig);
        else setupRound(roundNumber + 1, sessionConfig);
      }, FEEDBACK_MS);
    }, profile.timeoutMs);
  }, [clearTimers, finishSession]);

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

  const handleAnswer = (choiceKey: ColorKey) => {
    if (!config || feedback || summary) return;
    if (roundTimerRef.current !== null) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    const difficulty = resolveDifficulty(config, round);
    const profile = STROOP_PROFILES[difficulty];
    const elapsed = Math.max(1, performance.now() - roundStartAtRef.current);
    const isCorrect = choiceKey === COLORS[renderIndex].key;

    if (isCorrect) {
      correctRef.current += 1;
      scoresRef.current.push(elapsed);
      setFeedback('correct');
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
    } else {
      errorsRef.current += 1;
      scoresRef.current.push(elapsed + profile.wrongPenaltyMs);
      setFeedback('wrong');
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
    }

    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      const completedRounds = scoresRef.current.length;
      if (shouldFinishSession(config, completedRounds, !isCorrect)) finishSession(config);
      else setupRound(round + 1, config);
    }, FEEDBACK_MS);
  };

  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  const changeSettings = useCallback(() => {
    clearTimers();
    setSummary(null);
    setConfig(null);
  }, [clearTimers]);
  useTelegramBackButton(duelContext ? goHome : config ? changeSettings : goHome);

  const resolvedDifficulty = useMemo(
    () => (config ? resolveDifficulty(config, round) : 'medium'),
    [config, round],
  );
  const profile = STROOP_PROFILES[resolvedDifficulty];
  const visibleColors = COLORS.slice(0, profile.colorCount);

  if (!config) {
    if (duelContext) {
      return <div className="flex min-h-screen items-center justify-center text-sm text-mist-500">O'yin ochilmoqda...</div>;
    }
    return (
      <Screen>
        <TopBar title="O'yin sozlamalari" onBack={goHome} />
        <GameSetupPanel gameId="stroop-test" onStart={beginSession} />
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
            title="Stroop"
            emoji="🌈"
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
      <Screen>
        <TopBar title="Natija" onBack={goHome} />
        <GameSessionSummary
          title="Stroop"
          emoji="🌈"
          averageMs={summary.averageMs}
          completedRounds={summary.completedRounds}
          correct={summary.correct}
          errors={summary.errors}
          timeouts={summary.timeouts}
          config={config}
          onReplay={() => beginSession(config)}
          onChangeSettings={changeSettings}
          onHome={goHome}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Rang testi" onBack={duelContext ? goHome : changeSettings} />
      <div className="flex items-center justify-between text-xs text-mist-500">
        <span>Raund {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
        <span>{DIFFICULTY_LABELS[resolvedDifficulty]}</span>
      </div>

      <div className="flex flex-col items-center">
        <p className="mt-5 text-center text-sm text-mist-500">
          So'zga emas — <span className="font-semibold text-mist-300">rangga</span> qarab bosing!
        </p>

        <div className={`mt-7 flex h-36 w-36 items-center justify-center rounded-full ${COLORS[renderIndex].bg}`}>
          <span className="px-2 text-center font-display text-xl font-bold text-white drop-shadow">
            {COLORS[wordIndex].label.toUpperCase()}
          </span>
        </div>

        {feedback && (
          <p className={`mt-4 text-sm font-semibold ${feedback === 'correct' ? 'text-signal-go' : 'text-signal-early'}`}>
            {feedback === 'correct' ? "To'g'ri!" : feedback === 'timeout' ? 'Vaqt tugadi' : "Noto'g'ri!"}
          </p>
        )}

        <div className={`mt-7 grid w-full gap-2.5 ${profile.colorCount >= 5 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {visibleColors.map((color) => (
            <button
              key={color.key}
              type="button"
              onClick={() => handleAnswer(color.key)}
              disabled={Boolean(feedback)}
              className={`rounded-xl py-4 font-display text-sm font-bold text-white disabled:opacity-60 ${color.bg}`}
            >
              {color.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
