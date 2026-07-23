import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { GameSetupPanel } from '@/components/games/GameSetupPanel';
import { GameSessionSummary } from '@/components/games/GameSessionSummary';
import { DuelGameResult } from '@/components/games/DuelGameResult';
import {
  EMOJI_PROFILES,
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
import { createRoundRandom, shuffleRandom, type RandomSource } from '@/features/games/shared/random';

const EMOJI_POOL = [
  '🍎', '🍌', '🍓', '🍍', '🍒', '🍋', '🥝', '🍇', '🍉', '🫐',
  '🥑', '🍊', '🥭', '🍐', '🍑', '🥥', '🍅', '🌽', '🥕', '🍄',
  '🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐙', '🦋', '🐝',
];

interface SessionSummary {
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts: number;
}

function buildRound(optionCount: number, random: RandomSource): { target: string; options: string[] } {
  const options = shuffleRandom(EMOJI_POOL, random).slice(0, optionCount);
  const target = options[Math.floor(random() * options.length)];
  return { target, options: shuffleRandom(options, random) };
}

export function EmojiFindScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const duelContext = useMemo(() => readDuelGameContext(location.state, 'emoji-find'), [location.state]);
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const appUserId = useOnlineStore((state) => state.appUserId);

  const [config, setConfig] = useState<GameSessionConfig | null>(null);
  const [round, setRound] = useState(1);
  const [options, setOptions] = useState<string[]>([]);
  const [target, setTarget] = useState('🍎');
  const [errorsThisRound, setErrorsThisRound] = useState(0);
  const [wrongTap, setWrongTap] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const roundStartAtRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const correctRef = useRef(0);
  const errorsRef = useRef(0);
  const timeoutsRef = useRef(0);
  const wrongTapTimerRef = useRef<number | null>(null);
  const roundTimerRef = useRef<number | null>(null);

  const duelStartedRef = useRef(false);
  const clearTimers = useCallback(() => {
    if (wrongTapTimerRef.current !== null) {
      window.clearTimeout(wrongTapTimerRef.current);
      wrongTapTimerRef.current = null;
    }
    if (roundTimerRef.current !== null) {
      window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setupRound = useCallback((roundNumber: number, sessionConfig: GameSessionConfig) => {
    clearTimers();
    const difficulty = resolveDifficulty(sessionConfig, roundNumber);
    const profile = EMOJI_PROFILES[difficulty];
    const random = createRoundRandom(duelContext?.duelId, 'emoji-find', roundNumber);
    const next = buildRound(profile.optionCount, random);
    setRound(roundNumber);
    setOptions(next.options);
    setTarget(next.target);
    setErrorsThisRound(0);
    setWrongTap(null);
    roundStartAtRef.current = performance.now();
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

  const finishSession = useCallback((sessionConfig: GameSessionConfig) => {
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
      gameId: 'emoji-find',
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
  }, [addAttempt, appUserId, duelContext]);

  const completeRound = useCallback((scoreMs: number, success: boolean, timedOut = false) => {
    if (!config) return;
    scoresRef.current.push(Math.max(1, Math.round(scoreMs)));
    if (success) correctRef.current += 1;
    if (timedOut) timeoutsRef.current += 1;
    const completedRounds = scoresRef.current.length;

    if (shouldFinishSession(config, completedRounds, !success)) {
      finishSession(config);
    } else {
      setupRound(round + 1, config);
    }
  }, [config, finishSession, round, setupRound]);

  const handleTap = (emoji: string) => {
    if (!config || summary) return;
    const difficulty = resolveDifficulty(config, round);
    const profile = EMOJI_PROFILES[difficulty];
    const elapsed = performance.now() - roundStartAtRef.current;

    if (emoji === target) {
      if (roundTimerRef.current !== null) {
        window.clearTimeout(roundTimerRef.current);
        roundTimerRef.current = null;
      }
      if (hapticsEnabled) haptics.success();
      if (soundEnabled) sfx.success();
      completeRound(elapsed + errorsThisRound * profile.errorPenaltyMs, true);
      return;
    }

    errorsRef.current += 1;
    setErrorsThisRound((value) => value + 1);
    setWrongTap(emoji);
    if (hapticsEnabled) haptics.error();
    if (soundEnabled) sfx.tooSoon();

    if (config.rounds === 'survival') {
      if (roundTimerRef.current !== null) {
        window.clearTimeout(roundTimerRef.current);
        roundTimerRef.current = null;
      }
      completeRound(elapsed + profile.errorPenaltyMs * 2, false);
      return;
    }

    if (wrongTapTimerRef.current !== null) window.clearTimeout(wrongTapTimerRef.current);
    wrongTapTimerRef.current = window.setTimeout(() => {
      setWrongTap(null);
      wrongTapTimerRef.current = null;
    }, 220);
  };

  useEffect(() => {
    if (!config || summary || options.length === 0) return;
    const difficulty = resolveDifficulty(config, round);
    const timeoutMs = EMOJI_PROFILES[difficulty].timeoutMs;
    if (roundTimerRef.current !== null) window.clearTimeout(roundTimerRef.current);
    roundTimerRef.current = window.setTimeout(() => {
      roundTimerRef.current = null;
      completeRound(timeoutMs + EMOJI_PROFILES[difficulty].errorPenaltyMs, false, true);
    }, timeoutMs);
    return () => {
      if (roundTimerRef.current !== null) {
        window.clearTimeout(roundTimerRef.current);
        roundTimerRef.current = null;
      }
    };
  }, [completeRound, config, options.length, round, summary]);

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
  const profile = EMOJI_PROFILES[resolvedDifficulty];

  if (!config) {
    if (duelContext) {
      return <div className="flex min-h-screen items-center justify-center text-sm text-mist-500">O'yin ochilmoqda...</div>;
    }
    return (
      <Screen>
        <TopBar title={t('setup.title')} onBack={goHome} />
        <GameSetupPanel gameId="emoji-find" onStart={beginSession} />
      </Screen>
    );
  }

  if (summary) {
    if (duelContext) {
      return (
        <Screen>
          <TopBar title={t('result.duelTitle')} onBack={goHome} />
          <DuelGameResult
            context={duelContext}
            title={t('games.emoji.title')}
            emoji="🍎"
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
        <TopBar title={t('result.title')} onBack={goHome} />
        <GameSessionSummary
          title={t('games.emoji.title')}
          emoji="🍎"
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

  const gridStyle = { gridTemplateColumns: `repeat(${profile.columns}, minmax(0, 1fr))` };
  const emojiSize = profile.columns >= 5 ? 'text-2xl' : profile.columns === 4 ? 'text-3xl' : 'text-4xl';

  return (
    <Screen>
      <TopBar title={t('games.emoji.title')} onBack={duelContext ? goHome : changeSettings} />
      <div className="flex items-center justify-between text-xs text-mist-500">
        <span>{t('gameplay.round')} {round}{config.rounds === 'survival' ? '' : `/${config.rounds}`}</span>
        <span>{t(`difficulty.${resolvedDifficulty}.title`)}</span>
      </div>

      <div className="flex flex-col items-center">
        <p className="mt-5 text-sm text-mist-500">{t('gameplay.findAndTap')}</p>
        <div className="mt-3 text-6xl">{target}</div>

        <div className="mt-7 grid w-full gap-2.5" style={gridStyle}>
          {options.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              onClick={() => handleTap(emoji)}
              className={`flex aspect-square items-center justify-center rounded-xl border transition-colors ${emojiSize} ${
                wrongTap === emoji
                  ? 'border-signal-early bg-signal-early/10'
                  : 'border-ink-600 bg-ink-800 active:bg-ink-700'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-mist-600">Xatolar: {errorsRef.current}</p>
      </div>
    </Screen>
  );
}
