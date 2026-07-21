import { useCallback, useEffect, useMemo, useState } from 'react';
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

const GAME_ID = 'emoji-find';
const ROUNDS = 5;
const EMOJI_POOL = ['🍎', '🍌', '🍓', '🍍', '🍒', '🍋', '🥝', '🍇', '🍉', '🫐', '🥑', '🍊'];

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function EmojiFindScreen() {
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const addAttempt = useGameStatsStore((s) => s.addAttempt);
  const hydrateGameStats = useGameStatsStore((s) => s.hydrate);

  const [round, setRound] = useState(1);
  const [options, setOptions] = useState<string[]>(() => shuffled(EMOJI_POOL));
  const [target, setTarget] = useState<string>(() => EMOJI_POOL[0]);
  const [roundStartAt, setRoundStartAt] = useState(0);
  const [errorsThisRound, setErrorsThisRound] = useState(0);
  const [results, setResults] = useState<{ timeMs: number; errors: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [wrongTap, setWrongTap] = useState<string | null>(null);

  useEffect(() => {
    void hydrateGameStats();
  }, [hydrateGameStats]);

  const setupRound = useCallback(() => {
    setOptions(shuffled(EMOJI_POOL));
    setTarget(EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
    setErrorsThisRound(0);
    setRoundStartAt(performance.now());
  }, []);

  useEffect(() => {
    setupRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalStats = useMemo(() => {
    if (results.length === 0) return null;
    const avgMs = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    return { avgMs, totalErrors };
  }, [results]);

  const handleTap = (emoji: string) => {
    if (finished) return;

    if (emoji === target) {
      const elapsed = performance.now() - roundStartAt;
      const roundResult = { timeMs: elapsed, errors: errorsThisRound };
      const nextResults = [...results, roundResult];

      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();

      if (round >= ROUNDS) {
        setResults(nextResults);
        const avgMs = nextResults.reduce((sum, r) => sum + r.timeMs, 0) / nextResults.length;
        const totalErrors = nextResults.reduce((sum, r) => sum + r.errors, 0);
        void addAttempt(GAME_ID, Math.round(avgMs), { errors: totalErrors });
        setFinished(true);
      } else {
        setResults(nextResults);
        setRound((r) => r + 1);
        setupRound();
      }
    } else {
      setErrorsThisRound((e) => e + 1);
      setWrongTap(emoji);
      if (hapticsEnabled) haptics.error();
      if (soundEnabled) sfx.tooSoon();
      window.setTimeout(() => setWrongTap(null), 200);
    }
  };

  const handleRestart = () => {
    setRound(1);
    setResults([]);
    setFinished(false);
    setupRound();
  };

  return (
    <Screen>
      <TopBar title="Emojini top" onBack={goHome} />

      {!finished ? (
        <div className="flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
            {round}/{ROUNDS}
          </p>
          <p className="mt-4 text-sm text-mist-500">Toping va bosing:</p>
          <div className="mt-3 text-6xl">{target}</div>

          <div className="mt-8 grid w-full grid-cols-3 gap-3">
            {options.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleTap(emoji)}
                className={`flex aspect-square items-center justify-center rounded-2xl border text-4xl transition-colors ${
                  wrongTap === emoji
                    ? 'border-signal-early bg-signal-early/10'
                    : 'border-ink-600 bg-ink-800 active:bg-ink-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : (
        finalStats && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="mt-6 font-mono text-5xl font-bold text-mist-100">
              {Math.round(finalStats.avgMs)}
              <span className="ml-2 text-lg text-mist-500">ms</span>
            </div>
            <p className="text-sm text-mist-500">O'rtacha vaqt</p>
            <p className="text-sm text-mist-300">Xatolar: {finalStats.totalErrors}</p>

            <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
              <Button icon={<RotateIcon width={18} height={18} />} onClick={handleRestart}>
                Yana o'ynash
              </Button>
              <Button variant="secondary" onClick={goHome}>
                Bosh sahifa
              </Button>
            </div>
          </div>
        )
      )}
    </Screen>
  );
}
