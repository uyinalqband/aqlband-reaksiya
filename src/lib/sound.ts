let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(frequency: number, durationMs: number, type: OscillatorType, gainPeak: number, startAtMs = 0): void {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;

  const startTime = audioCtx.currentTime + startAtMs / 1000;
  const endTime = startTime + durationMs / 1000;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

export const sfx = {
  /** Short neutral tick when the round begins. */
  start(): void {
    tone(320, 90, 'sine', 0.05);
  },
  /** Bright rising cue the instant the "go" signal appears. */
  go(): void {
    tone(880, 140, 'triangle', 0.08);
  },
  /** Buzzy low tone for a false start. */
  tooSoon(): void {
    tone(160, 220, 'sawtooth', 0.06);
  },
  /** Celebratory two-note chime for a result / new best. */
  success(): void {
    tone(660, 110, 'sine', 0.07);
    tone(990, 160, 'sine', 0.06, 100);
  },
  /** Repeating attention cue for the two-player ready lobby. */
  invite(): void {
    tone(520, 120, 'sine', 0.055);
    tone(760, 150, 'triangle', 0.05, 150);
  },
};
