import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { GameSetupPanel } from '@/components/game/GameSetupPanel';
import { GameSessionSummary } from '@/components/game/GameSessionSummary';
import {
  DIFFICULTY_LABELS,
  MEMORY_PROFILES,
  resolveDifficulty,
  shouldFinishSession,
  type GameSessionConfig,
} from '@/features/gameSession/config';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';

const FEEDBACK_MS = 650;

type Phase = 'memorize' | 'recall' | 'feedback';

interface SessionSummary {
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts: number;
}

function randomNumber(digits: number): number {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateOptions(correct: number, digits: number, optionCount: number): number[] {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  const values = new Set<number>([correct]);
  const spread = Math.max(20, 10 ** Math.max(1, digits - 2));

  while (values.size < optionCount) {
    let candidate = correct + (Math.floor(Math.random() * spread * 2) - spread);
    if (candidate === correct) candidate += 1;
    candidate = Math.min(max, Math.max(min, candidate));
    values.add(candidate);
  }

  const result = Array.from(values);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function NumberMemoryScreen() {
  const navigate = useNavigate();
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);

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
    const difficulty = resolveDifficulty(sessionConfig, roundNumber);
    const profile = MEMORY_PROFILES[difficulty];
    const number = randomNumber(profile.digits);

    setRound(roundNumber);
    setCorrectNumber(number);
    setOptions(generateOptions(number, profile.digits, profile.optionCount));
    setLastCorrect(null);
    setPhase('memorize');

    memorizeTimerRef.current = window.setTimeout(() => {
      memorizeTimerRef.current = null;
      recallStartedAtRef.current = performance.now();
      setPhase('recall');
    }, profile.memorizeMs);
  }, [clearTimers]);

  const beginSession = useCallback((sessionConfig: GameSessionConfig) => {
    scoresRef.current = [];
    correctRef.current = 0;
    errorsRef.current = 0;
    timeoutsRef.current = 0;
    setSummary(null);
    setConfig(sessionConfig);
    setupRound(1, sessionConfig);
  }, [setupRound]);

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
  }, [addAttempt, clearTimers]);

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
    const difficulty = resolveDifficulty(config, round);
    const profile = MEMORY_PROFILES[difficulty];

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

    const difficulty = resolveDifficulty(config, round);
    const profile = MEMORY_PROFILES[difficulty];
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
  const changeSettings = useCallback(() => {
    clearTimers();
    setSummary(null);
    setConfig(null);
  }, [clearTimers]);
  useTelegramBackButton(config ? changeSettings : goHome);

  const resolvedDifficulty = useMemo(
    () => (config ? resolveDifficulty(config, round) : 'medium'),
    [config, round],
  );
  const profile = MEMORY_PROFILES[resolvedDifficulty];

  if (!config) {
    return (
      <Screen>
        <TopBar title="O'yin sozlamalari" onBack={goHome} />
        <GameSetupPanel gameId="number-memory" onStart={beginSession} />
      </Screen>
    );
  }

  if (summary) {
    return (
      <Screen>
        <TopBar title="Natija" onBack={goHome} />
        <GameSessionSummary
          title="Memory"
          emoji="🧠"
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
      <TopBar title="Sonni eslab qol" onBack={changeSettings} />
      <div className="flex items-center justify-between text-xs text-mist-500">
        <span>Raund {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
        <span>{DIFFICULTY_LABELS[resolvedDifficulty]}</span>
      </div>

      <div className="flex flex-col items-center">
        {phase === 'memorize' && (
          <>
            <p className="mt-10 text-sm text-mist-500">Eslab qoling!</p>
            <div className={`mt-5 font-mono font-bold text-mist-100 ${profile.digits >= 6 ? 'text-5xl' : 'text-6xl'}`}>
              {correctNumber}
            </div>
            <p className="mt-4 text-xs text-mist-600">{profile.digits} xonali son</p>
          </>
        )}

        {phase === 'recall' && (
          <>
            <p className="mt-9 text-sm text-mist-500">Qaysi son edi?</p>
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
