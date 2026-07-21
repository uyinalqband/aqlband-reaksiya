import { useCallback, useEffect, useState } from 'react';
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

const GAME_ID = 'number-memory';
const ROUNDS = 5;
const DIGITS = 4;
const MEMORIZE_MS = 2500;
const FEEDBACK_MS = 900;

function randomNumber(digits: number): number {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateOptions(correct: number, digits: number): number[] {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const set = new Set<number>([correct]);
  while (set.size < 4) {
    let candidate = correct + (Math.floor(Math.random() * 200) - 100);
    if (candidate === correct) candidate += 1;
    if (candidate < min) candidate = min + Math.floor(Math.random() * 50);
    if (candidate > max) candidate = max - Math.floor(Math.random() * 50);
    set.add(candidate);
  }
  const arr = Array.from(set);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Phase = 'memorize' | 'recall' | 'feedback' | 'finished';

export function NumberMemoryScreen() {
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const addAttempt = useGameStatsStore((s) => s.addAttempt);
  const hydrateGameStats = useGameStatsStore((s) => s.hydrate);

  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('memorize');
  const [correctNumber, setCorrectNumber] = useState(() => randomNumber(DIGITS));
  const [options, setOptions] = useState<number[]>(() => generateOptions(correctNumber, DIGITS));
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    void hydrateGameStats();
  }, [hydrateGameStats]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const timer = window.setTimeout(() => setPhase('recall'), MEMORIZE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, round]);

  const setupRound = useCallback((roundNumber: number) => {
    const num = randomNumber(DIGITS);
    setCorrectNumber(num);
    setOptions(generateOptions(num, DIGITS));
    setPhase('memorize');
    setRound(roundNumber);
  }, []);

  const handleAnswer = (choice: number) => {
    if (phase !== 'recall') return;
    const isCorrect = choice === correctNumber;
    setLastCorrect(isCorrect);
    setPhase('feedback');

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
    } else {
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
    }

    window.setTimeout(() => {
      if (round >= ROUNDS) {
        const finalCorrect = correctCount + (isCorrect ? 1 : 0);
        void addAttempt(GAME_ID, finalCorrect, {});
        setPhase('finished');
      } else {
        setupRound(round + 1);
      }
    }, FEEDBACK_MS);
  };

  const handleRestart = () => {
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
                {options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className="rounded-2xl border border-ink-600 bg-ink-800 py-6 font-mono text-2xl font-bold text-mist-100 active:bg-ink-700"
                  >
                    {opt}
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
