import type { SoloGameId } from '@/features/games/catalog';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'very-hard' | 'progressive';
export type FixedRoundCount = 1|2|3|4|5|6|7|8|9|10;
export type RoundSelection = FixedRoundCount | 'survival';

export interface GameSessionConfig {
  rounds: RoundSelection;
  difficulty: Difficulty;
  memorySize?: number;
  nBack?: number;
  puzzleShuffle?: number;
}

export const DEFAULT_GAME_SESSION: GameSessionConfig = { rounds: 5, difficulty: 'medium' };

/** Fixed fast-play configuration used by all solo mini-games in AqlBand V2. */
export const MAX_SOLO_SESSION: GameSessionConfig = {
  rounds: 1,
  difficulty: 'very-hard',
  memorySize: 8,
  nBack: 3,
  puzzleShuffle: 120,
};
export const DIFFICULTIES: Difficulty[] = ['easy','medium','hard','very-hard','progressive'];

export function difficultyIndex(difficulty: Difficulty, round: number): number {
  if (difficulty === 'easy') return 0;
  if (difficulty === 'medium') return 1;
  if (difficulty === 'hard') return 2;
  if (difficulty === 'very-hard') return 3;
  return Math.min(3, Math.floor((round-1)/2));
}

export function targetRounds(config: GameSessionConfig): number {
  return config.rounds === 'survival' ? 100 : config.rounds;
}

export function shouldFinishSession(config: GameSessionConfig, completed: number, failed: boolean): boolean {
  if (config.rounds === 'survival') return failed || completed >= 100;
  return completed >= config.rounds;
}

export function isGameSessionConfig(value: unknown): value is GameSessionConfig {
  if (!value || typeof value !== 'object') return false;
  const raw=value as Partial<GameSessionConfig>;
  const rounds=raw.rounds;
  return (rounds==='survival'||(Number.isInteger(rounds)&&Number(rounds)>=1&&Number(rounds)<=10))
    && DIFFICULTIES.includes(raw.difficulty as Difficulty);
}

export type { SoloGameId };

export const DIFFICULTY_LABELS: Record<Difficulty,string> = {
  easy:'Oson', medium:"O'rta", hard:'Qiyin', 'very-hard':'Juda qiyin', progressive:'Qiyinlashib boruvchi',
};

export function selectedRoundsLabel(rounds: RoundSelection): string {
  return rounds==='survival'?'Yutqazgungacha':`${rounds} raund`;
}

export type BaseDifficulty='easy'|'medium'|'hard'|'very-hard';
export function resolveDifficulty(config:GameSessionConfig,roundNumber:number):BaseDifficulty{
  const index=difficultyIndex(config.difficulty,roundNumber);
  return (['easy','medium','hard','very-hard'] as const)[index];
}

export const REACTION_PROFILES={
 easy:{countdownMinMs:1600,countdownMaxMs:3000,timeoutMs:3200,discScale:1},
 medium:{countdownMinMs:1400,countdownMaxMs:4200,timeoutMs:2700,discScale:.94},
 hard:{countdownMinMs:1000,countdownMaxMs:4800,timeoutMs:2100,discScale:.86},
 'very-hard':{countdownMinMs:700,countdownMaxMs:5200,timeoutMs:1500,discScale:.78},
} as const;
export const EMOJI_PROFILES={
 easy:{optionCount:9,columns:3,errorPenaltyMs:450,timeoutMs:10000},
 medium:{optionCount:12,columns:3,errorPenaltyMs:500,timeoutMs:8000},
 hard:{optionCount:16,columns:4,errorPenaltyMs:550,timeoutMs:6000},
 'very-hard':{optionCount:20,columns:5,errorPenaltyMs:650,timeoutMs:4500},
} as const;
export const MEMORY_PROFILES={
 easy:{digits:3,memorizeMs:3000,recallTimeoutMs:6000,optionCount:3,wrongPenaltyMs:1500},
 medium:{digits:4,memorizeMs:2300,recallTimeoutMs:4500,optionCount:4,wrongPenaltyMs:1700},
 hard:{digits:5,memorizeMs:1700,recallTimeoutMs:3200,optionCount:4,wrongPenaltyMs:1900},
 'very-hard':{digits:6,memorizeMs:1100,recallTimeoutMs:2200,optionCount:6,wrongPenaltyMs:2100},
} as const;
export const STROOP_PROFILES={
 easy:{colorCount:3,timeoutMs:3200,wrongPenaltyMs:700},
 medium:{colorCount:4,timeoutMs:2500,wrongPenaltyMs:850},
 hard:{colorCount:5,timeoutMs:1850,wrongPenaltyMs:1000},
 'very-hard':{colorCount:6,timeoutMs:1350,wrongPenaltyMs:1200},
} as const;

export const GAME_SETUP_COPY: Record<string,{title:string;emoji:string;subtitle:string;instructions:string[]}> = {
 reaction:{title:'Reaksiya',emoji:'⚡',subtitle:'Signalni kuting.',instructions:['Signalni kuting','Yashilda bosing','O‘rtacha vaqt hisoblanadi']},
 'emoji-find':{title:'Emoji',emoji:'🍎',subtitle:'Emojini toping.',instructions:['Nishonni ko‘ring','Toping','Xatodan saqlaning']},
 'number-memory':{title:'Memory',emoji:'🧠',subtitle:'Raqamni eslang.',instructions:['Eslab qoling','Variantni tanlang','Tez javob bering']},
 'stroop-test':{title:'Stroop',emoji:'🌈',subtitle:'Rangga qarang.',instructions:['So‘zni emas rangni tanlang','Tez javob bering','Xatodan saqlaning']},
};
