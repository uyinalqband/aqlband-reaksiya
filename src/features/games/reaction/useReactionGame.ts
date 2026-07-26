import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactionGamePhase, ReactionRoundOptions } from '@/features/games/reaction/types';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';
import { useSettingsStore } from '@/store/settingsStore';
import type { RandomSource } from '@/features/games/shared/random';


const DEFAULT_OPTIONS: ReactionRoundOptions = {
  countdownMinMs: 1_500,
  countdownMaxMs: 4_200,
  timeoutMs: 3_000,
};

interface ReactionGameApi {
  phase: ReactionGamePhase;
  resultMs: number | null;
  start: (options?: ReactionRoundOptions, random?: RandomSource) => void;
  registerTap: () => void;
  reset: () => void;
}

export function useReactionGame(): ReactionGameApi {
  const [phase, setPhase] = useState<ReactionGamePhase>('idle');
  const [resultMs, setResultMs] = useState<number | null>(null);

  const goAtRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);

  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

  const clearTimers = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (timeoutTimerRef.current !== null) {
      window.clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback((options: ReactionRoundOptions = DEFAULT_OPTIONS, random: RandomSource = Math.random) => {
    clearTimers();
    setResultMs(null);
    setPhase('countdown');
    if (soundEnabled) sfx.start();

    const min = Math.max(250, Math.round(options.countdownMinMs));
    const max = Math.max(min, Math.round(options.countdownMaxMs));
    const delay = Math.round(min + random() * (max - min));

    countdownTimerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase('go');
      if (soundEnabled) sfx.go();
      if (hapticsEnabled) haptics.impact('medium');

      timeoutTimerRef.current = window.setTimeout(() => {
        setPhase('timeout');
        goAtRef.current = null;
      }, Math.max(500, Math.round(options.timeoutMs)));
    }, delay);
  }, [clearTimers, soundEnabled, hapticsEnabled]);

  const registerTap = useCallback(() => {
    if (phase === 'countdown') {
      clearTimers();
      setPhase('tooSoon');
      if (soundEnabled) sfx.tooSoon();
      if (hapticsEnabled) haptics.error();
      return;
    }

    if (phase === 'go' && goAtRef.current !== null) {
      clearTimers();
      const elapsed = performance.now() - goAtRef.current;
      goAtRef.current = null;
      setResultMs(elapsed);
      setPhase('result');
      if (hapticsEnabled) haptics.success();
    }
  }, [phase, clearTimers, soundEnabled, hapticsEnabled]);

  const reset = useCallback(() => {
    clearTimers();
    goAtRef.current = null;
    setResultMs(null);
    setPhase('idle');
  }, [clearTimers]);

  return { phase, resultMs, start, registerTap, reset };
}
