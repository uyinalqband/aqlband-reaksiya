import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  DEFAULT_GAME_SESSION,
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  GAME_SETUP_COPY,
  type Difficulty,
  type GameSessionConfig,
  type RoundSelection,
  type SoloGameId,
} from '@/features/gameSession/config';

interface GameSetupPanelProps {
  gameId: SoloGameId;
  onStart: (config: GameSessionConfig) => void;
}

const FIXED_ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'very-hard', 'progressive'];

export function GameSetupPanel({ gameId, onStart }: GameSetupPanelProps) {
  const copy = GAME_SETUP_COPY[gameId];
  const [rounds, setRounds] = useState<RoundSelection>(DEFAULT_GAME_SESSION.rounds);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_GAME_SESSION.difficulty);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl" aria-hidden="true">{copy.emoji}</div>
        <h2 className="mt-3 font-display text-2xl font-bold text-mist-100">{copy.title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">{copy.subtitle}</p>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Raundlar soni</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {FIXED_ROUNDS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setRounds(count)}
              className={`h-10 rounded-xl border font-mono text-sm font-bold transition-colors ${
                rounds === count
                  ? 'border-violet-400 bg-violet-600 text-white shadow-glow'
                  : 'border-ink-600 bg-ink-800 text-mist-400'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRounds('survival')}
          className={`mt-2.5 h-11 w-full rounded-xl border text-sm font-semibold transition-colors ${
            rounds === 'survival'
              ? 'border-gold-400/70 bg-gold-500/15 text-gold-300'
              : 'border-ink-600 bg-ink-800 text-mist-400'
          }`}
        >
          ♾️ Yutqazgungacha
        </button>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Qiyinlik darajasi</h3>
        <div className="mt-3 space-y-2">
          {DIFFICULTIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDifficulty(item)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                difficulty === item
                  ? 'border-violet-400/70 bg-violet-600/20'
                  : 'border-ink-600 bg-ink-800/70'
              }`}
            >
              <div>
                <p className={`text-sm font-semibold ${difficulty === item ? 'text-violet-200' : 'text-mist-200'}`}>
                  {DIFFICULTY_LABELS[item]}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-mist-500">{DIFFICULTY_DESCRIPTIONS[item]}</p>
              </div>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                  difficulty === item ? 'border-violet-300 bg-violet-400' : 'border-mist-700'
                }`}
              />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-mist-200">Qanday o'ynaladi?</h3>
        <div className="mt-3 space-y-3">
          {copy.instructions.map((instruction, index) => (
            <div key={instruction} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/25 font-mono text-xs font-bold text-violet-300">
                {index + 1}
              </span>
              <p className="pt-0.5 text-xs leading-relaxed text-mist-400">{instruction}</p>
            </div>
          ))}
        </div>
      </Card>

      <Button className="w-full" onClick={() => onStart({ rounds, difficulty })}>
        O'yinni boshlash
      </Button>
    </div>
  );
}
