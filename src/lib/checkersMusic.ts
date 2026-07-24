type MusicIntensity = 'calm' | 'focused' | 'tense' | 'critical';

interface MusicState {
  enabled: boolean;
  volume: number;
  active: boolean;
  intensity: MusicIntensity;
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;

const state: MusicState = {
  enabled: true,
  volume: 0.38,
  active: false,
  intensity: 'calm',
};

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) return null;
  if (!context) {
    context = new AudioCtx();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
  }
  return context;
}

function effectiveGain(): number {
  if (!state.enabled || !state.active) return 0;
  return Math.max(0, Math.min(1, state.volume)) * 0.22;
}

function applyMasterGain(fadeSeconds = 0.25): void {
  const audio = getContext();
  if (!audio || !master) return;
  const now = audio.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(effectiveGain(), now + fadeSeconds);
}

function playTone(
  frequency: number,
  duration: number,
  startDelay: number,
  type: OscillatorType,
  gainValue: number,
  detune = 0,
): void {
  const audio = getContext();
  if (!audio || !master || !state.enabled || !state.active) return;

  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + startDelay;
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(start);
  oscillator.stop(end + 0.03);
}

function pulseNoise(duration: number, startDelay: number, gainValue: number): void {
  const audio = getContext();
  if (!audio || !master || !state.enabled || !state.active) return;

  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (length * 0.18));
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  const start = audio.currentTime + startDelay;

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
}

function scheduleBar(): void {
  if (!state.active || !state.enabled) return;

  const intensity = state.intensity;
  const tempo =
    intensity === 'critical'
      ? 112
      : intensity === 'tense'
        ? 96
        : intensity === 'focused'
          ? 82
          : 70;
  const beat = 60 / tempo;
  const roots = [110, 123.47, 98, 110];
  const root = roots[Math.floor(step / 8) % roots.length];

  for (let beatIndex = 0; beatIndex < 8; beatIndex += 1) {
    const delay = beatIndex * beat;

    if (beatIndex % 2 === 0) {
      playTone(root, beat * 1.8, delay, 'sine', 0.18);
      playTone(root * 2, beat * 1.5, delay + 0.015, 'triangle', 0.045, -4);
    }

    if (intensity !== 'calm') {
      pulseNoise(0.09, delay, intensity === 'critical' ? 0.085 : 0.055);
    }

    if (intensity === 'tense' || intensity === 'critical') {
      playTone(root * 3, 0.11, delay + beat * 0.5, 'triangle', 0.042);
    }

    if (intensity === 'critical') {
      playTone(760, 0.055, delay + beat * 0.75, 'square', 0.025);
    }
  }

  const barDurationMs = beat * 8 * 1000;
  step += 8;
  timer = window.setTimeout(scheduleBar, Math.max(200, barDurationMs - 80));
}

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

export const checkersMusic = {
  unlock(): void {
    const audio = getContext();
    if (audio?.state === 'suspended') void audio.resume();
  },

  configure(enabled: boolean, volume: number): void {
    state.enabled = enabled;
    state.volume = Math.max(0, Math.min(1, volume));
    if (!enabled) {
      clearTimer();
    } else if (state.active && timer === null) {
      scheduleBar();
    }
    applyMasterGain();
  },

  start(initialIntensity: MusicIntensity = 'calm'): void {
    state.active = true;
    state.intensity = initialIntensity;
    this.unlock();
    clearTimer();
    applyMasterGain(0.35);
    scheduleBar();
  },

  setIntensity(intensity: MusicIntensity): void {
    if (state.intensity === intensity) return;
    state.intensity = intensity;
    if (state.active && state.enabled) {
      clearTimer();
      scheduleBar();
    }
  },

  stop(): void {
    state.active = false;
    clearTimer();
    applyMasterGain(0.45);
  },

  suspend(): void {
    const audio = getContext();
    if (audio?.state === 'running') void audio.suspend();
  },

  resume(): void {
    if (!state.active || !state.enabled) return;
    const audio = getContext();
    if (audio?.state === 'suspended') void audio.resume();
    if (timer === null) scheduleBar();
    applyMasterGain();
  },

  move(): void {
    if (!state.enabled) return;
    playTone(420, 0.08, 0, 'triangle', 0.08);
  },

  capture(): void {
    if (!state.enabled) return;
    pulseNoise(0.16, 0, 0.14);
    playTone(150, 0.2, 0, 'sawtooth', 0.08);
  },

  promotion(): void {
    if (!state.enabled) return;
    playTone(523.25, 0.15, 0, 'sine', 0.11);
    playTone(659.25, 0.17, 0.12, 'sine', 0.1);
    playTone(783.99, 0.24, 0.24, 'triangle', 0.09);
  },

  victory(): void {
    if (!state.enabled) return;
    this.stop();
    state.active = true;
    applyMasterGain(0.05);
    playTone(392, 0.18, 0, 'sine', 0.12);
    playTone(523.25, 0.2, 0.16, 'sine', 0.12);
    playTone(659.25, 0.32, 0.32, 'triangle', 0.1);
    window.setTimeout(() => {
      state.active = false;
      applyMasterGain(0.4);
    }, 900);
  },

  defeat(): void {
    if (!state.enabled) return;
    this.stop();
    state.active = true;
    applyMasterGain(0.05);
    playTone(220, 0.25, 0, 'triangle', 0.1);
    playTone(174.61, 0.35, 0.18, 'sine', 0.09);
    window.setTimeout(() => {
      state.active = false;
      applyMasterGain(0.4);
    }, 760);
  },

  draw(): void {
    if (!state.enabled) return;
    this.stop();
    state.active = true;
    applyMasterGain(0.05);
    playTone(293.66, 0.22, 0, 'sine', 0.08);
    playTone(329.63, 0.28, 0.18, 'triangle', 0.075);
    window.setTimeout(() => {
      state.active = false;
      applyMasterGain(0.4);
    }, 700);
  },
};

export function checkersMusicIntensity(
  remainingMs: number,
  myTurn: boolean,
): MusicIntensity {
  if (!myTurn) return 'calm';
  if (remainingMs <= 10_000) return 'critical';
  if (remainingMs <= 25_000) return 'tense';
  if (remainingMs <= 60_000) return 'focused';
  return 'calm';
}
