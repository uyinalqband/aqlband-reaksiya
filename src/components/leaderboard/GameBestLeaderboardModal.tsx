import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { GAMES, type SoloGameId } from '@/features/games/catalog';
import { formatMs } from '@/features/games/session/metrics';
import { getGameBestLeaderboard, type GameBestLeaderboardRow } from '@/services/gameLeaderboardService';

const SOLO_MS_GAMES = GAMES.map((game) => ({
  id: game.id,
  emoji: game.emoji,
  titleKey: game.titleKey,
}));

function resolveUsername(username: string | null) {
  return username ? `@${username}` : '';
}

function LeaderboardRow({
  row,
  currentUser = false,
}: {
  row: GameBestLeaderboardRow;
  currentUser?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${
      currentUser
        ? 'border-violet-400/45 bg-violet-500/15'
        : 'border-ink-600 bg-ink-900/60'
    }`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
        currentUser ? 'bg-violet-500 text-white' : 'bg-ink-700 text-mist-300'
      }`}>
        #{row.rank}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold text-mist-100">
          {row.displayName}
          {currentUser ? <span className="ml-1 text-sm text-violet-200">({t('common.you')})</span> : null}
        </p>
        {row.username ? (
          <p className="truncate text-xs text-mist-500">{resolveUsername(row.username)}</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="font-mono text-lg font-bold tabular-nums text-gold-400">
          {formatMs(row.bestMs)} ms
        </p>
      </div>
    </div>
  );
}

export function GameBestLeaderboardModal({
  initialGameId = 'reaction',
  onClose,
}: {
  initialGameId?: SoloGameId;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedGameId, setSelectedGameId] = useState<SoloGameId>(initialGameId);
  const [rows, setRows] = useState<GameBestLeaderboardRow[]>([]);
  const [currentUser, setCurrentUser] = useState<GameBestLeaderboardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedGame = useMemo(
    () => SOLO_MS_GAMES.find((item) => item.id === selectedGameId) ?? SOLO_MS_GAMES[0],
    [selectedGameId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getGameBestLeaderboard(selectedGameId, 30);
        if (cancelled) return;
        setRows(result.rows);
        setCurrentUser(result.currentUser);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedGameId, t]);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="max-h-[86vh] w-full max-w-md overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-mist-100">
              {t('home.bestLeaderboardTitle')}
            </h2>
            <p className="text-sm text-mist-500">
              {selectedGame ? `${selectedGame.emoji} ${t(selectedGame.titleKey)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-ink-700 text-xl text-mist-200 transition-colors active:bg-ink-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex gap-2">
            {SOLO_MS_GAMES.map((game) => {
              const active = game.id === selectedGameId;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGameId(game.id)}
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-violet-400 bg-violet-500/20 text-white'
                      : 'border-ink-600 bg-ink-800 text-mist-300'
                  }`}
                >
                  <span className="block text-lg">{game.emoji}</span>
                  <span className="block max-w-[7rem] truncate text-xs font-semibold">
                    {t(game.titleKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="py-10 text-center text-sm text-mist-500">{t('common.loading')}</p>
          ) : error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-200">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-mist-500">
              {t('home.noGameLeaderboard')}
            </p>
          ) : (
            rows.map((row) => (
              <LeaderboardRow
                key={`${row.userId}-${row.rank}`}
                row={row}
                currentUser={currentUser?.userId === row.userId}
              />
            ))
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-gold-400/25 bg-gold-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-300">
            {t('home.yourPosition')}
          </p>
          {currentUser ? (
            <div className="mt-2">
              <LeaderboardRow row={currentUser} currentUser />
            </div>
          ) : (
            <p className="mt-2 text-sm text-mist-400">{t('home.notRankedYet')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
