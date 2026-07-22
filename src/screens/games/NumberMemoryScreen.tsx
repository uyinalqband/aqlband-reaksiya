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

const ROUNDS = 5;
const DIGITS = 4;
const MEMORIZE_MS = 2500;
const FEEDBACK_MS = 900;

function randomNumber(digits: number): number {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateOptions(correct: number, digits: number): number[] {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  const values = new Set<number>([correct]);

  while (values.size < 4) {
    let candidate = correct + (Math.floor(Math.random() * 200) - 100);
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

type Phase = 'memorize' | 'recall' | 'feedback' | 'finished';

export function NumberMemoryScreen() {
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [correctNumber, setCorrectNumber] = useState(() => randomNumber(DIGITS));
  const [options, setOptions] = useState<number[]>(() => generateOptions(correctNumber, DIGITS));
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const feedbackTimerRef = useRef<number | null>(null);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearFeedbackTimer, [clearFeedbackTimer]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const timer = window.setTimeout(() => setPhase('recall'), MEMORIZE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, round]);

  const setupRound = useCallback((roundNumber: number) => {
    const number = randomNumber(DIGITS);
    setCorrectNumber(number);
    setOptions(generateOptions(number, DIGITS));
    setLastCorrect(null);
    setPhase('memorize');
    setRound(roundNumber);
  }, []);

  const handleAnswer = (choice: number) => {
    if (phase !== 'recall') return;
    const isCorrect = choice === correctNumber;
    const finalCorrect = correctCount + (isCorrect ? 1 : 0);
    setLastCorrect(isCorrect);
    setPhase('feedback');

    if (isCorrect) {
      setCorrectCount(finalCorrect);
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
    } else {
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
    }

    clearFeedbackTimer();
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      if (round >= ROUNDS) {
        void addAttempt({
          gameId: 'number-memory',
          value: finalCorrect,
          metric: 'correct_count',
          meta: { rounds: ROUNDS, digits: DIGITS },
        });
        setPhase('finished');
      } else {
        setupRound(round + 1);
      }
    }, FEEDBACK_MS);
  };

  const handleRestart = () => {
    clearFeedbackTimer();
    setCorrectCount(0);
    setupRound(1);
  };

  return (
    <Screen>
      <TopBar title="Sonni eslab qol" onBack={goHome} />

      {phase !== 'finished' ? (
        <div className="flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
            {round}/{ROUNDS}
          </p>

          {phase === 'memorize' && (
            <>
              <p className="mt-8 text-sm text-mist-500">Eslab qoling!</p>
              <div className="mt-4 font-mono text-6xl font-bold text-mist-100">{correctNumber}</div>
            </>
          )}

          {phase === 'recall' && (
            <>
              <p className="mt-8 text-sm text-mist-500">Qaysi son edi?</p>
              <div className="mt-6 grid w-full grid-cols-2 gap-3">
                {options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className="rounded-2xl border border-ink-600 bg-ink-800 py-6 font-mono text-2xl font-bold text-mist-100 active:bg-ink-700"
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
                {lastCorrect ? "To'g'ri!" : "Noto'g'ri!"}
              </p>
              {!lastCorrect && <p className="text-sm text-mist-500">To'g'ri javob: {correctNumber}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="mt-6 font-mono text-5xl font-bold text-mist-100">
            {correctCount}/{ROUNDS}
          </div>
          <p className="text-sm text-mist-500">To'g'ri javoblar</p>

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
