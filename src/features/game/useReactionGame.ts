import { useCallback, useEffect, useRef, useState } from 'react';
import type { GamePhase } from '@/types';
import { randomCountdownDelay, REACTION_TIMEOUT_MS } from './logic';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';
import { useSettingsStore } from '@/store/settingsStore';

interface ReactionGameApi {
  phase: GamePhase;
  resultMs: number | null;
  /** Starts a new round: idle -> countdown -> go. */
  start: () => void;
  /** Registers a tap; behavior depends on current phase. */
  registerTap: () => void;
  /** Resets back to idle without starting a new round. */
  reset: () => void;
}

export function useReactionGame(): ReactionGameApi {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [resultMs, setResultMs] = useState<number | null>(null);

  const goAtRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);

  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

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

  const start = useCallback(() => {
    clearTimers();
    setResultMs(null);
    setPhase('countdown');
    if (soundEnabled) sfx.start();

    const delay = randomCountdownDelay();
    countdownTimerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase('go');
      if (soundEnabled) sfx.go();
      if (hapticsEnabled) haptics.impact('medium');

      timeoutTimerRef.current = window.setTimeout(() => {
        setPhase('timeout');
        goAtRef.current = null;
      }, REACTION_TIMEOUT_MS);
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
      return;
    }

    // Taps while idle / result / tooSoon / timeout are handled by screen-level CTAs, not here.
  }, [phase, clearTimers, soundEnabled, hapticsEnabled]);

  const reset = useCallback(() => {
    clearTimers();
    goAtRef.current = null;
    setResultMs(null);
    setPhase('idle');
  }, [clearTimers]);

  return { phase, resultMs, start, registerTap, reset };
}
