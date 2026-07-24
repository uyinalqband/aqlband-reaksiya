import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getGameDefinition, type SoloGameId } from '@/features/games/catalog';
import {
  DEFAULT_GAME_SESSION,
  DIFFICULTIES,
  type Difficulty,
  type GameSessionConfig,
  type RoundSelection,
} from '@/features/games/session/config';

interface Props {
  gameId: SoloGameId;
  onStart: (config: GameSessionConfig) => void;
}

const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function GameSetupPanel({ gameId, onStart }: Props) {
  const { t } = useTranslation();
  const game = getGameDefinition(gameId)!;
  const isSudoku = gameId === 'sudoku';
  const availableRounds = isSudoku ? ([1, 2, 3] as const) : ROUNDS;

  const [rounds, setRounds] = useState<RoundSelection>(
    isSudoku ? 1 : DEFAULT_GAME_SESSION.rounds,
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    DEFAULT_GAME_SESSION.difficulty,
  );
  const [memorySize, setMemorySize] = useState(4);
  const [nBack, setNBack] = useState(2);
  const [puzzleShuffle, setPuzzleShuffle] = useState(40);

  const config: GameSessionConfig = {
    rounds,
    difficulty,
    memorySize,
    nBack,
    puzzleShuffle,
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl" aria-hidden="true">{game.emoji}</div>
        <h1 className="mt-3 font-display text-2xl font-extrabold">
          {t(game.titleKey)}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mist-500">
          {t(game.descriptionKey)}
        </p>
        <span className="mt-3 inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          {t('v2.soloTraining')}
        </span>
      </div>

      <Card>
        <h3 className="text-sm font-bold">{t('setup.rounds')}</h3>
        <div className={`mt-3 grid gap-2 ${isSudoku ? 'grid-cols-3' : 'grid-cols-5'}`}>
          {availableRounds.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setRounds(count)}
              className={`h-10 rounded-xl border font-mono font-bold ${
                rounds === count
                  ? 'border-violet-400 bg-violet-500 text-white shadow-glow'
                  : 'border-mist-400/10 bg-ink-900/55 text-mist-500'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        {!isSudoku ? (
          <button
            type="button"
            onClick={() => setRounds('survival')}
            className={`mt-2 h-11 w-full rounded-xl border text-sm font-bold ${
              rounds === 'survival'
                ? 'border-gold-400 bg-gold-500/15 text-gold-300'
                : 'border-mist-400/10 bg-ink-900/55 text-mist-500'
            }`}
          >
            ♾️ {t('setup.survival')}
          </button>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-sm font-bold">{t('setup.difficulty')}</h3>
        <div className="mt-3 space-y-2">
          {DIFFICULTIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setDifficulty(item)}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                difficulty === item
                  ? 'border-violet-400 bg-violet-500/15'
                  : 'border-mist-400/10 bg-ink-900/55'
              }`}
            >
              <p className="text-sm font-bold">{t(`difficulty.${item}.title`)}</p>
              <p className="mt-1 text-xs text-mist-600">
                {t(`difficulty.${item}.description`)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {game.customSetup === 'memory' ? (
        <Card>
          <h3 className="text-sm font-bold">{t('setup.memorySize')}</h3>
          <input
            type="range"
            min="3"
            max="8"
            value={memorySize}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setMemorySize(Number(event.target.value))
            }
            className="mt-4 w-full"
          />
          <p className="mt-2 text-center font-mono text-gold-300">{memorySize}</p>
        </Card>
      ) : null}

      {game.customSetup === 'nback' ? (
        <Card>
          <h3 className="text-sm font-bold">N-Back</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setNBack(value)}
                className={`h-11 rounded-xl border ${
                  nBack === value
                    ? 'border-violet-400 bg-violet-500'
                    : 'border-mist-400/10 bg-ink-900/55'
                }`}
              >
                {value}-Back
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {game.customSetup === 'puzzle' ? (
        <Card>
          <h3 className="text-sm font-bold">{t('setup.shuffle')}</h3>
          <input
            type="range"
            min="10"
            max="120"
            step="10"
            value={puzzleShuffle}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setPuzzleShuffle(Number(event.target.value))
            }
            className="mt-4 w-full"
          />
          <p className="mt-2 text-center font-mono text-gold-300">
            {puzzleShuffle}
          </p>
        </Card>
      ) : null}

      <Card>
        <h3 className="text-sm font-bold">{t('setup.howTo')}</h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-mist-400">
          {t(game.instructionsKey)}
        </p>
      </Card>

      <Button className="w-full" onClick={() => onStart(config)}>
        {t('setup.start')}
      </Button>
    </div>
  );
}
