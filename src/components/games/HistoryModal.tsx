import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { formatAttemptResult, getGamePresentation } from '@/features/history/gameCatalog';

const META_LABEL_KEYS: Record<string, string> = {
  rounds: 'history.meta.rounds',
  correct: 'history.meta.correct',
  errors: 'history.meta.errors',
  difficulty: 'history.meta.difficulty',
  survival: 'history.meta.survival',
  memorySize: 'history.meta.memorySize',
  moves: 'history.meta.moves',
  mistakes: 'history.meta.mistakes',
  hints: 'history.meta.hints',
  clues: 'history.meta.clues',
  pairs: 'history.meta.pairs',
  attempts: 'history.meta.attempts',
  mode: 'history.meta.mode',
  nBack: 'history.meta.nBack',
  puzzleShuffle: 'history.meta.puzzleShuffle',
  failed: 'history.meta.failed',
  targetMs: 'history.meta.targetMs',
};

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function HistoryModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const attempts = useGameHistoryStore((state) => state.attempts).slice(0, 30);
  const locale = i18n.resolvedLanguage?.startsWith('ru')
    ? 'ru-RU'
    : i18n.resolvedLanguage?.startsWith('en')
      ? 'en-US'
      : 'uz-UZ';

  function formatValue(key: string, value: unknown): string {
    if (key === 'difficulty' && typeof value === 'string') {
      return t(`difficulty.${value}.title`, { defaultValue: value });
    }
    if (key === 'mode' && typeof value === 'string') {
      return t(`history.values.${value}`, { defaultValue: value });
    }
    if (typeof value === 'boolean') {
      return value ? t('common.yes') : t('common.no');
    }
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="max-h-[84vh] w-full max-w-md overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-mist-100">
              {t('history.title')}
            </h2>
            <p className="text-sm text-mist-500">{t('history.limit')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-ink-700 text-xl text-mist-200 transition-colors active:bg-ink-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {attempts.length === 0 ? (
            <p className="py-10 text-center text-sm text-mist-500">
              {t('history.empty')}
            </p>
          ) : (
            attempts.map((attempt) => {
              const game = getGamePresentation(attempt.gameId);
              const metaEntries = Object.entries(attempt.meta ?? {}).filter(
                ([, value]) => value !== undefined && value !== null && value !== '',
              );

              return (
                <div
                  key={attempt.id}
                  className="rounded-2xl border border-ink-600 bg-ink-900/60 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{game.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-semibold text-mist-100">
                        {game.title.startsWith('games.') ? t(game.title) : game.title}
                      </p>
                      <p className="text-xs text-mist-500">
                        {new Date(attempt.playedAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-base font-bold text-gold-400">
                      {attempt.gameId === 'tic-tac-toe'
                        ? t(`ticTacToe.outcomes.${String(attempt.meta?.outcome ?? 'loss')}`)
                        : formatAttemptResult(attempt)}
                    </span>
                  </div>

                  {metaEntries.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {metaEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-ink-600/60 bg-ink-700/55 px-3 py-2"
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-mist-600">
                            {META_LABEL_KEYS[key]
                              ? t(META_LABEL_KEYS[key])
                              : humanizeKey(key)}
                          </p>
                          <p className="mt-1 break-words text-xs font-medium text-mist-200">
                            {formatValue(key, value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
