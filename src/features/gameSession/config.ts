import type { GameId } from '@/store/gameHistoryStore';

export type SoloGameId = Exclude<GameId, 'duel-reaction'>;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard' | 'progressive';
export type FixedRoundCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type RoundSelection = FixedRoundCount | 'survival';

export interface GameSessionConfig {
  rounds: RoundSelection;
  difficulty: Difficulty;
}

export const DEFAULT_GAME_SESSION: GameSessionConfig = {
  rounds: 5,
  difficulty: 'medium',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Oson',
  medium: "O'rta",
  hard: 'Qiyin',
  'very-hard': 'Juda qiyin',
  progressive: 'Qiyinlashib boruvchi',
};

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: "Kattaroq elementlar va ko'proq vaqt",
  medium: "Muvozanatli standart rejim",
  hard: "Ko'proq chalg'ituvchi va kamroq vaqt",
  'very-hard': "Eng tez va eng murakkab rejim",
  progressive: "Har raundda qiyinlik oshib boradi",
};

export const GAME_SETUP_COPY: Record<
  SoloGameId,
  { title: string; emoji: string; subtitle: string; instructions: string[] }
> = {
  reaction: {
    title: 'Reaksiya',
    emoji: '⚡',
    subtitle: "Signal yashil bo'lishi bilan imkon qadar tez bosing.",
    instructions: [
      "Signal chiqishini kuting — oldin bosish xato hisoblanadi.",
      "Yashil rang paydo bo'lishi bilan ekranning istalgan joyini bosing.",
      "Yakuniy natija barcha raundlarning o'rtacha vaqti bilan hisoblanadi.",
    ],
  },
  'emoji-find': {
    title: 'Emoji',
    emoji: '🍎',
    subtitle: "Ko'rsatilgan emojini jadval ichidan tez toping.",
    instructions: [
      "Yuqorida ko'rsatilgan emojini eslab qoling.",
      "Jadval ichidan aynan shu emojini topib bosing.",
      "Noto'g'ri bosish vaqtga jarima qo'shadi; yutqazgungacha rejimida o'yin tugaydi.",
    ],
  },
  'number-memory': {
    title: 'Memory',
    emoji: '🧠',
    subtitle: "Ko'rsatilgan sonni eslab qolib, variantlardan toping.",
    instructions: [
      "Son ekranda qisqa vaqt ko'rinadi.",
      "Son yashirilgach, to'g'ri variantni tanlang.",
      "Natija javob tanlash tezligining o'rtacha millisekund qiymati bilan hisoblanadi.",
    ],
  },
  'stroop-test': {
    title: 'Stroop',
    emoji: '🌈',
    subtitle: "So'zga emas, uning yozilgan rangiga qarab javob bering.",
    instructions: [
      "Markazdagi so'zning ma'nosini e'tiborsiz qoldiring.",
      "So'z qaysi rangda yozilgan bo'lsa, o'sha rang tugmasini bosing.",
      "Noto'g'ri javob va vaqt tugashi natijaga jarima qo'shadi.",
    ],
  },
};

const BASE_DIFFICULTIES = ['easy', 'medium', 'hard', 'very-hard'] as const;
export type BaseDifficulty = (typeof BASE_DIFFICULTIES)[number];

export function resolveDifficulty(config: GameSessionConfig, roundNumber: number): BaseDifficulty {
  if (config.difficulty !== 'progressive') return config.difficulty;

  if (config.rounds === 'survival') {
    return BASE_DIFFICULTIES[Math.min(BASE_DIFFICULTIES.length - 1, Math.floor((roundNumber - 1) / 3))];
  }

  if (config.rounds <= 1) return 'medium';
  const progress = (roundNumber - 1) / (config.rounds - 1);
  const index = Math.min(BASE_DIFFICULTIES.length - 1, Math.floor(progress * BASE_DIFFICULTIES.length));
  return BASE_DIFFICULTIES[index];
}

export function selectedRoundsLabel(rounds: RoundSelection): string {
  return rounds === 'survival' ? 'Yutqazgungacha' : `${rounds} raund`;
}

export function shouldFinishSession(
  config: GameSessionConfig,
  completedRounds: number,
  roundFailed: boolean,
): boolean {
  if (config.rounds === 'survival') return roundFailed || completedRounds >= 100;
  return completedRounds >= config.rounds;
}

export function isGameSessionConfig(value: unknown): value is GameSessionConfig {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<GameSessionConfig>;
  const roundsValid = raw.rounds === 'survival' || (Number.isInteger(raw.rounds) && Number(raw.rounds) >= 1 && Number(raw.rounds) <= 10);
  return roundsValid && Boolean(raw.difficulty && raw.difficulty in DIFFICULTY_LABELS);
}

export interface ReactionDifficultyProfile {
  countdownMinMs: number;
  countdownMaxMs: number;
  timeoutMs: number;
  discScale: number;
}

export const REACTION_PROFILES: Record<BaseDifficulty, ReactionDifficultyProfile> = {
  easy: { countdownMinMs: 1_600, countdownMaxMs: 3_000, timeoutMs: 3_200, discScale: 1 },
  medium: { countdownMinMs: 1_400, countdownMaxMs: 4_200, timeoutMs: 2_700, discScale: 0.94 },
  hard: { countdownMinMs: 1_000, countdownMaxMs: 4_800, timeoutMs: 2_100, discScale: 0.86 },
  'very-hard': { countdownMinMs: 700, countdownMaxMs: 5_200, timeoutMs: 1_500, discScale: 0.78 },
};

export interface EmojiDifficultyProfile {
  optionCount: number;
  columns: number;
  errorPenaltyMs: number;
  timeoutMs: number;
}

export const EMOJI_PROFILES: Record<BaseDifficulty, EmojiDifficultyProfile> = {
  easy: { optionCount: 9, columns: 3, errorPenaltyMs: 450, timeoutMs: 10_000 },
  medium: { optionCount: 12, columns: 3, errorPenaltyMs: 500, timeoutMs: 8_000 },
  hard: { optionCount: 16, columns: 4, errorPenaltyMs: 550, timeoutMs: 6_000 },
  'very-hard': { optionCount: 20, columns: 5, errorPenaltyMs: 650, timeoutMs: 4_500 },
};

export interface MemoryDifficultyProfile {
  digits: number;
  memorizeMs: number;
  recallTimeoutMs: number;
  optionCount: number;
  wrongPenaltyMs: number;
}

export const MEMORY_PROFILES: Record<BaseDifficulty, MemoryDifficultyProfile> = {
  easy: { digits: 3, memorizeMs: 3_000, recallTimeoutMs: 6_000, optionCount: 3, wrongPenaltyMs: 1_500 },
  medium: { digits: 4, memorizeMs: 2_300, recallTimeoutMs: 4_500, optionCount: 4, wrongPenaltyMs: 1_700 },
  hard: { digits: 5, memorizeMs: 1_700, recallTimeoutMs: 3_200, optionCount: 4, wrongPenaltyMs: 1_900 },
  'very-hard': { digits: 6, memorizeMs: 1_100, recallTimeoutMs: 2_200, optionCount: 6, wrongPenaltyMs: 2_100 },
};

export interface StroopDifficultyProfile {
  colorCount: number;
  timeoutMs: number;
  wrongPenaltyMs: number;
}

export const STROOP_PROFILES: Record<BaseDifficulty, StroopDifficultyProfile> = {
  easy: { colorCount: 3, timeoutMs: 3_200, wrongPenaltyMs: 700 },
  medium: { colorCount: 4, timeoutMs: 2_500, wrongPenaltyMs: 850 },
  hard: { colorCount: 5, timeoutMs: 1_850, wrongPenaltyMs: 1_000 },
  'very-hard': { colorCount: 6, timeoutMs: 1_350, wrongPenaltyMs: 1_200 },
};
