import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { RotateIcon } from '@/components/ui/icons';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameStatsStore } from '@/store/gameStatsStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';

const GAME_ID = 'stroop-test';
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

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const addAttempt = useGameStatsStore((s) => s.addAttempt);
  const hydrateGameStats = useGameStatsStore((s) => s.hydrate);

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
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    void hydrateGameStats();
  }, [hydrateGameStats]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishGame = useCallback(() => {
    const totalBall = reactionTimesRef.current.reduce(
      (sum, ms) => sum + Math.max(100, Math.round(2500 - ms)),
      0,
    );
    void addAttempt(GAME_ID, totalBall, {
      errors: errorsRef.current,
      timeouts: timeoutsRef.current,
    });
    setFinished(true);
  }, [addAttempt]);

  const setupRound = useCallback((roundNumber: number) => {
    setWordIndex(randomColorIndex());
    setRenderIndex(randomColorIndex());
    setFeedback(null);
    setRound(roundNumber);
    setRoundStartAt(performance.now());
  }, []);

  useEffect(() => {
    setupRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finished || feedback) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timeoutsRef.current += 1;
      setFeedback('wrong');
      window.setTimeout(() => {
        if (round >= ROUNDS) finishGame();
        else setupRound(round + 1);
      }, 500);
    }, ROUND_TIMEOUT_MS);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, finished, feedback]);

  const handleAnswer = (choiceKey: ColorKey) => {
    if (feedback || finished) return;
    clearTimer();
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
    window.setTimeout(() => {
      if (round >= ROUNDS) finishGame();
      else setupRound(round + 1);
    }, 400);
  };

  const handleRestart = () => {
    correctCountRef.current = 0;
    errorsRef.current = 0;
    timeoutsRef.current = 0;
    reactionTimesRef.current = [];
    setFinished(false);
    setupRound(1);
  };

  const finalBall = reactionTimesRef.current.reduce(
    (sum, ms) => sum + Math.max(100, Math.round(2500 - ms)),
    0,
  );
  const avgMs =
    reactionTimesRef.current.length > 0
      ? Math.round(
          reactionTimesRef.current.reduce((sum, ms) => sum + ms, 0) / reactionTimesRef.current.length,
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

          <div
            className={`mt-8 flex h-40 w-40 items-center justify-center rounded-full ${COLORS[renderIndex].bg}`}
          >
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
          <div className="mt-6 font-mono text-5xl font-bold text-mist-100">{finalBall}</div>
          <p className="text-sm text-mist-500">ball</p>
          <p className="text-sm text-mist-300">
            O'rtacha: {avgMs} ms &nbsp; Xato: {errorsRef.current} &nbsp; Kechikish: {timeoutsRef.current}
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
