type MusicIntensity = 'calm' | 'focused' | 'tense' | 'critical';
type AudioChannel = 'music' | 'effect';

interface AudioState {
  musicEnabled: boolean;
  effectsEnabled: boolean;
  musicVolume: number;
  gameActive: boolean;
  searchActive: boolean;
  intensity: MusicIntensity;
}

let context: AudioContext | null = null;
let musicGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let gameTimer: number | null = null;
let searchTimer: number | null = null;
let gameStep = 0;
let searchStep = 0;

const state: AudioState = {
  musicEnabled: true,
  effectsEnabled: true,
  musicVolume: 0.38,
  gameActive: false,
  searchActive: false,
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
    musicGain = context.createGain();
    effectsGain = context.createGain();
    musicGain.gain.value = 0;
    effectsGain.gain.value = 0;
    musicGain.connect(context.destination);
    effectsGain.connect(context.destination);
  }
  return context;
}

function musicLevel(): number {
  if (!state.musicEnabled || !state.gameActive) return 0;
  return Math.max(0, Math.min(1, state.musicVolume)) * 0.2;
}

function effectsLevel(): number {
  return state.effectsEnabled ? 0.27 : 0;
}

function applyGain(
  gain: GainNode | null,
  target: number,
  fadeSeconds = 0.18,
): void {
  const audio = getContext();
  if (!audio || !gain) return;
  const now = audio.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
  gain.gain.linearRampToValueAtTime(target, now + fadeSeconds);
}

function applyMusicGain(fadeSeconds = 0.25): void {
  applyGain(musicGain, musicLevel(), fadeSeconds);
}

function applyEffectsGain(fadeSeconds = 0.08): void {
  applyGain(effectsGain, effectsLevel(), fadeSeconds);
}

function channelGain(channel: AudioChannel): GainNode | null {
  return channel === 'music' ? musicGain : effectsGain;
}

function channelEnabled(channel: AudioChannel): boolean {
  return channel === 'music'
    ? state.musicEnabled && state.gameActive
    : state.effectsEnabled;
}

function playTone(
  channel: AudioChannel,
  frequency: number,
  duration: number,
  startDelay: number,
  type: OscillatorType,
  gainValue: number,
  detune = 0,
): void {
  const audio = getContext();
  const destination = channelGain(channel);
  if (!audio || !destination || !channelEnabled(channel)) return;

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
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(end + 0.03);
}

function pulseNoise(
  channel: AudioChannel,
  duration: number,
  startDelay: number,
  gainValue: number,
  cutoff = 420,
): void {
  const audio = getContext();
  const destination = channelGain(channel);
  if (!audio || !destination || !channelEnabled(channel)) return;

  const length = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] =
      (Math.random() * 2 - 1) * Math.exp(-index / (length * 0.18));
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  const start = audio.currentTime + startDelay;

  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(start);
}

function clearGameTimer(): void {
  if (gameTimer !== null) {
    window.clearTimeout(gameTimer);
    gameTimer = null;
  }
}

function clearSearchTimer(): void {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer);
    searchTimer = null;
  }
}

function scheduleGameBar(): void {
  if (!state.gameActive || !state.musicEnabled) return;

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
  const root = roots[Math.floor(gameStep / 8) % roots.length];

  for (let beatIndex = 0; beatIndex < 8; beatIndex += 1) {
    const delay = beatIndex * beat;

    if (beatIndex % 2 === 0) {
      playTone('music', root, beat * 1.8, delay, 'sine', 0.18);
      playTone(
        'music',
        root * 2,
        beat * 1.5,
        delay + 0.015,
        'triangle',
        0.045,
        -4,
      );
    }

    if (intensity !== 'calm') {
      pulseNoise(
        'music',
        0.09,
        delay,
        intensity === 'critical' ? 0.085 : 0.055,
      );
    }

    if (intensity === 'tense' || intensity === 'critical') {
      playTone(
        'music',
        root * 3,
        0.11,
        delay + beat * 0.5,
        'triangle',
        0.042,
      );
    }

    if (intensity === 'critical') {
      playTone(
        'music',
        760,
        0.055,
        delay + beat * 0.75,
        'square',
        0.025,
      );
    }
  }

  const barDurationMs = beat * 8 * 1000;
  gameStep += 8;
  gameTimer = window.setTimeout(
    scheduleGameBar,
    Math.max(200, barDurationMs - 80),
  );
}

function scheduleSearchPulse(): void {
  if (!state.searchActive || !state.effectsEnabled) return;

  applyEffectsGain();
  const notes = [329.63, 392, 440, 392];
  const note = notes[searchStep % notes.length];
  playTone('effect', note, 0.18, 0, 'sine', 0.08);
  playTone('effect', note * 2, 0.09, 0.08, 'triangle', 0.035);
  if (searchStep % 2 === 0) {
    pulseNoise('effect', 0.08, 0, 0.028, 900);
  }
  searchStep += 1;
  searchTimer = window.setTimeout(scheduleSearchPulse, 1_150);
}

function playEffectSequence(
  notes: Array<{ frequency: number; delay: number; duration: number }>,
): void {
  if (!state.effectsEnabled) return;
  applyEffectsGain();
  for (const note of notes) {
    playTone(
      'effect',
      note.frequency,
      note.duration,
      note.delay,
      'triangle',
      0.11,
    );
  }
}

export const checkersMusic = {
  unlock(): void {
    const audio = getContext();
    if (audio?.state === 'suspended') void audio.resume();
  },

  configure(
    musicEnabled: boolean,
    volume: number,
    effectsEnabled = true,
  ): void {
    state.musicEnabled = musicEnabled;
    state.effectsEnabled = effectsEnabled;
    state.musicVolume = Math.max(0, Math.min(1, volume));

    if (!musicEnabled) clearGameTimer();
    else if (state.gameActive && gameTimer === null) scheduleGameBar();

    if (!effectsEnabled) clearSearchTimer();
    else if (state.searchActive && searchTimer === null) scheduleSearchPulse();

    applyMusicGain();
    applyEffectsGain();
  },

  start(initialIntensity: MusicIntensity = 'calm'): void {
    state.gameActive = true;
    state.intensity = initialIntensity;
    this.unlock();
    clearGameTimer();
    applyMusicGain(0.3);
    if (state.musicEnabled) scheduleGameBar();
  },

  setIntensity(intensity: MusicIntensity): void {
    if (state.intensity === intensity) return;
    state.intensity = intensity;
    if (state.gameActive && state.musicEnabled) {
      clearGameTimer();
      scheduleGameBar();
    }
  },

  startSearch(): void {
    state.searchActive = true;
    this.unlock();
    clearSearchTimer();
    searchStep = 0;
    if (state.effectsEnabled) scheduleSearchPulse();
  },

  stopSearch(): void {
    state.searchActive = false;
    clearSearchTimer();
  },

  matchFound(): void {
    this.stopSearch();
    playEffectSequence([
      { frequency: 392, delay: 0, duration: 0.14 },
      { frequency: 523.25, delay: 0.12, duration: 0.16 },
      { frequency: 659.25, delay: 0.25, duration: 0.24 },
    ]);
  },

  gameStart(): void {
    this.stopSearch();
    if (!state.effectsEnabled) return;
    applyEffectsGain();
    pulseNoise('effect', 0.18, 0, 0.12, 520);
    playEffectSequence([
      { frequency: 220, delay: 0, duration: 0.12 },
      { frequency: 440, delay: 0.12, duration: 0.16 },
      { frequency: 660, delay: 0.25, duration: 0.25 },
    ]);
  },

  stop(): void {
    state.gameActive = false;
    state.searchActive = false;
    clearGameTimer();
    clearSearchTimer();
    applyMusicGain(0.35);
  },

  suspend(): void {
    const audio = getContext();
    if (audio?.state === 'running') void audio.suspend();
  },

  resume(): void {
    const audio = getContext();
    if (audio?.state === 'suspended') void audio.resume();
    if (state.gameActive && state.musicEnabled && gameTimer === null) {
      scheduleGameBar();
    }
    if (state.searchActive && state.effectsEnabled && searchTimer === null) {
      scheduleSearchPulse();
    }
    applyMusicGain();
    applyEffectsGain();
  },

  move(): void {
    playEffectSequence([
      { frequency: 420, delay: 0, duration: 0.08 },
    ]);
  },

  capture(): void {
    if (!state.effectsEnabled) return;
    applyEffectsGain();
    pulseNoise('effect', 0.16, 0, 0.14);
    playTone('effect', 150, 0.2, 0, 'sawtooth', 0.08);
  },

  promotion(): void {
    playEffectSequence([
      { frequency: 523.25, delay: 0, duration: 0.15 },
      { frequency: 659.25, delay: 0.12, duration: 0.17 },
      { frequency: 783.99, delay: 0.24, duration: 0.24 },
    ]);
  },

  victory(): void {
    this.stop();
    playEffectSequence([
      { frequency: 392, delay: 0, duration: 0.18 },
      { frequency: 523.25, delay: 0.16, duration: 0.2 },
      { frequency: 659.25, delay: 0.32, duration: 0.32 },
    ]);
  },

  defeat(): void {
    this.stop();
    playEffectSequence([
      { frequency: 220, delay: 0, duration: 0.25 },
      { frequency: 174.61, delay: 0.18, duration: 0.35 },
    ]);
  },

  draw(): void {
    this.stop();
    playEffectSequence([
      { frequency: 293.66, delay: 0, duration: 0.22 },
      { frequency: 329.63, delay: 0.18, duration: 0.28 },
    ]);
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
