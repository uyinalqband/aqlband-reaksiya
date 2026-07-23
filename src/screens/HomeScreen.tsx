import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { HistoryModal } from '@/components/games/HistoryModal';
import { GameBestLeaderboardModal } from '@/components/leaderboard/GameBestLeaderboardModal';
import { GAMES, type SoloGameId } from '@/features/games/catalog';
import { computeUnifiedMsStats, getBestDurationValue, useGameHistoryStore } from '@/store/gameHistoryStore';
import { formatMs } from '@/features/games/session/metrics';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useOnlineStore } from '@/store/onlineStore';
import { getUserRank } from '@/services/leaderboardService';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useTelegramUser();
  const attempts = useGameHistoryStore((state) => state.attempts);
  const lastKnownRank = useOnlineStore((state) => state.lastKnownRank);
  const updateRank = useOnlineStore((state) => state.updateRank);

  const stats = useMemo(() => computeUnifiedMsStats(attempts), [attempts]);
  const bestGameId = useMemo<SoloGameId>(() => {
    const validGameIds = new Set(GAMES.map((game) => game.id));
    const bestAttempt = attempts
      .filter(
        (attempt) =>
          attempt.metric === 'duration_ms' &&
          validGameIds.has(attempt.gameId as SoloGameId),
      )
      .sort((left, right) => left.value - right.value)[0];

    return bestAttempt ? (bestAttempt.gameId as SoloGameId) : 'reaction';
  }, [attempts]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bestBoardOpen, setBestBoardOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRank() {
      try {
        const rank = await getUserRank();
        if (!cancelled) await updateRank(rank);
      } catch {
        // Keep the last cached rank.
      }
    }

    void loadRank();
    return () => {
      cancelled = true;
    };
  }, [updateRank]);

  const gameCards = GAMES;

  return (
    <Screen>
      <div>
        <p className="font-display text-3xl font-bold text-mist-100">
          {user?.firstName ?? 'AqlBand'}
        </p>
        <p className="mt-1 text-sm text-mist-500">{t('home.question')}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {gameCards.map((game, index) => {
          const best = getBestDurationValue(attempts, game.id);
          return (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => navigate(game.route)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex min-h-[12rem] flex-col rounded-[28px] border border-ink-600/70 bg-ink-800/80 p-5 text-left shadow-card transition-transform active:scale-[0.985]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-4xl">{game.emoji}</span>
                <span className="text-xl text-mist-600">›</span>
              </div>
              <h3 className="mt-5 font-display text-[1.7rem] font-bold leading-tight text-mist-100">
                {t(game.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-5 text-mist-500">
                {t(game.descriptionKey)}
              </p>
              <p className="mt-auto pt-3 font-mono text-lg font-semibold text-gold-400">
                {game.friendOnly ? t('games.friendOnly') : best !== null ? `${formatMs(best)} ms` : '—'}
              </p>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <MiniStat
          label={t('home.statBest')}
          value={stats.best !== null ? formatMs(stats.best) : '—'}
          onClick={() => setBestBoardOpen(true)}
          accent
        />
        <MiniStat
          label={t('home.statAverage')}
          value={stats.average !== null ? formatMs(stats.average) : '—'}
          onClick={() => setHistoryOpen(true)}
        />
        <MiniStat
          label={t('home.statAttempts')}
          value={String(stats.totalAttempts)}
          onClick={() => setHistoryOpen(true)}
        />
        <MiniStat
          label={t('nav.leaderboard')}
          value={lastKnownRank ? `#${lastKnownRank}` : '—'}
          onClick={() => navigate('/leaderboard')}
          accent
        />
      </div>

      {historyOpen ? <HistoryModal onClose={() => setHistoryOpen(false)} /> : null}
      {bestBoardOpen ? (
        <GameBestLeaderboardModal
          initialGameId={bestGameId}
          onClose={() => setBestBoardOpen(false)}
        />
      ) : null}
    </Screen>
  );
}

function MiniStat({
  label,
  value,
  onClick,
  accent = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-ink-600/70 bg-ink-800/80 px-2 py-4 text-center shadow-card transition-transform active:scale-[0.985]"
    >
      <div className={`font-mono text-[1.1rem] font-bold tabular-nums ${accent ? 'text-gold-400' : 'text-mist-100'}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-mist-500">
        {label}
      </div>
    </button>
  );
}
