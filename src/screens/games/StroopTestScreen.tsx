import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { RotateIcon } from '@/components/ui/icons';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';

const ROUNDS = 8;
const ROUND_TIMEOUT_MS = 2500;

const COLORS = [
  { key: 'green', label: 'Yashil', bg: 'bg-green-500' },
  { key: 'red', label: 'Qizil', bg: 'bg-red-500' },
  { key: 'blue', label: "Ko'k", bg: 'bg-blue-500' },
  { key: 'yellow', label: 'Sariq', bg: 'bg-yellow-400' },
] as const;

type ColorKey = (typeof COLORS)[number]['key'];

function randomColorIndex(): number {
  return Math.floor(Math.random() * COLORS.length);
}

export function StroopTestScreen() {
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);

  const [round, setRound] = useState(1);
  const [wordIndex, setWordIndex] = useState(randomColorIndex());
  const [renderIndex, setRenderIndex] = useState(randomColorIndex());
  const [roundStartAt, setRoundStartAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const correctCountRef = useRef(0);
  const errorsRef = useRef(0);
  const timeoutsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const roundTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

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

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();

    const totalScore = reactionTimesRef.current.reduce(
      (sum, milliseconds) => sum + Math.max(100, Math.round(2500 - milliseconds)),
      0,
    );
    const averageMs =
      reactionTimesRef.current.length > 0
        ? Math.round(
            reactionTimesRef.current.reduce((sum, milliseconds) => sum + milliseconds, 0) /
              reactionTimesRef.current.length,
          )
        : 0;

    void addAttempt({
      gameId: 'stroop-test',
      value: totalScore,
      metric: 'score',
      meta: {
        correct: correctCountRef.current,
        errors: errorsRef.current,
        timeouts: timeoutsRef.current,
        averageMs,
        rounds: ROUNDS,
      },
    });
    setFinished(true);
  }, [addAttempt, clearTimers]);

  const setupRound = useCallback((roundNumber: number) => {
    setWordIndex(randomColorIndex());
    setRenderIndex(randomColorIndex());
    setFeedback(null);
    setRound(roundNumber);
    setRoundStartAt(performance.now());
  }, []);

  useEffect(() => {
    setupRound(1);
  }, [setupRound]);

  useEffect(() => {
    if (finished || feedback) return;
    if (roundTimerRef.current !== null) window.clearTimeout(roundTimerRef.current);

    roundTimerRef.current = window.setTimeout(() => {
      roundTimerRef.current = null;
      timeoutsRef.current += 1;
      setFeedback('wrong');
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        if (round >= ROUNDS) finishGame();
        else setupRound(round + 1);
      }, 500);
    }, ROUND_TIMEOUT_MS);

    return () => {
      if (roundTimerRef.current !== null) {
        window.clearTimeout(roundTimerRef.current);
        roundTimerRef.current = null;
      }
    };
  }, [round, finished, feedback, finishGame, setupRound]);

  const handleAnswer = (choiceKey: ColorKey) => {
    if (feedback || finished) return;
    if (roundTimerRef.current !== null) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    const elapsed = performance.now() - roundStartAt;
    const isCorrect = choiceKey === COLORS[renderIndex].key;

    if (isCorrect) {
      correctCountRef.current += 1;
      reactionTimesRef.current.push(elapsed);
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
    } else {
      errorsRef.current += 1;
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
    }

    setFeedback(isCorrect ? 'correct' : 'wrong');
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      if (round >= ROUNDS) finishGame();
      else setupRound(round + 1);
    }, 400);
  };

  const handleRestart = () => {
    clearTimers();
    correctCountRef.current = 0;
    errorsRef.current = 0;
    timeoutsRef.current = 0;
    reactionTimesRef.current = [];
    finishedRef.current = false;
    setFinished(false);
    setupRound(1);
  };

  const finalScore = reactionTimesRef.current.reduce(
    (sum, milliseconds) => sum + Math.max(100, Math.round(2500 - milliseconds)),
    0,
  );
  const averageMs =
    reactionTimesRef.current.length > 0
      ? Math.round(
          reactionTimesRef.current.reduce((sum, milliseconds) => sum + milliseconds, 0) /
            reactionTimesRef.current.length,
        )
      : 0;

  return (
    <Screen>
      <TopBar title="Rang testi" onBack={goHome} />

      {!finished ? (
        <div className="flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
            {round}/{ROUNDS}
          </p>
          <p className="mt-4 text-center text-sm text-mist-500">
            So'zga emas — <span className="font-semibold text-mist-300">rangga</span> qarab bosing!
          </p>

          <div className={`mt-8 flex h-40 w-40 items-center justify-center rounded-full ${COLORS[renderIndex].bg}`}>
            <span className="font-display text-2xl font-bold text-white drop-shadow">
              {COLORS[wordIndex].label.toUpperCase()}
            </span>
          </div>

          {feedback && (
            <p className={`mt-4 text-sm font-semibold ${feedback === 'correct' ? 'text-signal-go' : 'text-signal-early'}`}>
              {feedback === 'correct' ? "To'g'ri!" : "Noto'g'ri / vaqt tugadi"}
            </p>
          )}

          <div className="mt-8 grid w-full grid-cols-2 gap-3">
            {COLORS.map((color) => (
              <button
                key={color.key}
                onClick={() => handleAnswer(color.key)}
                disabled={Boolean(feedback)}
                className={`rounded-2xl py-5 font-display text-lg font-bold text-white disabled:opacity-60 ${color.bg}`}
              >
                {color.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="mt-6 font-mono text-5xl font-bold text-mist-100">{finalScore}</div>
          <p className="text-sm text-mist-500">ball</p>
          <p className="text-sm text-mist-300">
            O'rtacha: {averageMs} ms &nbsp; Xato: {errorsRef.current} &nbsp; Kechikish: {timeoutsRef.current}
          </p>

          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <Button icon={<RotateIcon width={18} height={18} />} onClick={handleRestart}>
              Yana o'ynash
            </Button>
            <Button variant="secondary" onClick={goHome}>
              Bosh sahifa
            </Button>
          </div>
        </div>
      )}
    </Screen>
  );
}
