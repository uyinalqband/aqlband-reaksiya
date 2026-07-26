let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.62;
let variation = 0;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = volume * 0.32;
    master.connect(ctx.destination);
  }
  return ctx;
}

function unlock(): void {
  const audio = getContext();
  if (audio?.state === 'suspended') void audio.resume();
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gainPeak: number,
  startAtMs = 0,
  endFrequency?: number,
): void {
  const audio = getContext();
  if (!audio || !master || !enabled) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + startAtMs / 1000;
  const end = start + durationMs / 1000;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(endFrequency, end);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(end + 0.025);
}

function noise(durationMs: number, gainPeak: number, cutoff = 700): void {
  const audio = getContext();
  if (!audio || !master || !enabled) return;
  const duration = durationMs / 1000;
  const buffer = audio.createBuffer(
    1,
    Math.ceil(audio.sampleRate * duration),
    audio.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] =
      (Math.random() * 2 - 1) * Math.exp(-index / (data.length * 0.16));
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(gainPeak, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
}

function next(base: number): number {
  variation = (variation + 1) % 5;
  return base * [0.985, 1.012, 0.996, 1.02, 0.99][variation];
}

export const sfx = {
  configure(soundEnabled: boolean, effectsVolume = 0.62): void {
    enabled = soundEnabled;
    volume = Math.max(0, Math.min(1, effectsVolume));
    const audio = getContext();
    if (!audio || !master) return;
    const now = audio.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.linearRampToValueAtTime(
      enabled ? volume * 0.32 : 0,
      now + 0.08,
    );
  },

  unlock,

  suspend(): void {
    if (ctx?.state === 'running') void ctx.suspend();
  },

  resume(): void {
    unlock();
  },

  start(): void {
    tone(next(310), 85, 'sine', 0.12, 0, 390);
  },

  go(): void {
    tone(720, 125, 'triangle', 0.18, 0, 980);
    tone(1220, 70, 'sine', 0.08, 55);
  },

  tooSoon(): void {
    tone(185, 210, 'sawtooth', 0.1, 0, 115);
    noise(95, 0.035, 420);
  },

  timeout(): void {
    tone(330, 170, 'triangle', 0.1, 0, 210);
    tone(190, 220, 'sine', 0.08, 130);
  },

  success(): void {
    tone(620, 105, 'sine', 0.15);
    tone(830, 120, 'triangle', 0.13, 85);
    tone(1100, 190, 'sine', 0.1, 175);
  },

  invite(): void {
    tone(next(510), 105, 'sine', 0.11);
    tone(next(760), 140, 'triangle', 0.09, 135);
  },

  select(): void {
    tone(next(480), 48, 'sine', 0.065);
  },

  notification(): void {
    tone(660, 90, 'sine', 0.1);
    tone(880, 130, 'triangle', 0.085, 80);
  },
};
