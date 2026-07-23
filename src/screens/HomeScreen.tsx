import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { HistoryModal } from '@/components/games/HistoryModal';
import { GameBestLeaderboardModal } from '@/components/leaderboard/GameBestLeaderboardModal';
import { GAMES, type SoloGameId } from '@/features/games/catalog';
import { computeUnifiedMsStats, useGameHistoryStore } from '@/store/gameHistoryStore';
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
        // Keep the cached rank if the network is temporarily unavailable.
      }
    }

    void loadRank();
    return () => {
      cancelled = true;
    };
  }, [updateRank]);

  return (
    <Screen>
      <div>
        <p className="font-display text-3xl font-bold text-mist-100">
          {user?.firstName ?? 'AqlBand'}
        </p>
        <p className="mt-1 text-sm text-mist-500">{t('home.question')}</p>
      </div>

      <div className="mt-5 space-y-2">
        {GAMES.map((game, index) => (
          <motion.button
            key={game.id}
            type="button"
            onClick={() => navigate(game.route)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.25) }}
            className="flex min-h-[4rem] w-full items-center gap-4 rounded-2xl border border-ink-600/70 bg-ink-800/80 px-4 py-3 text-left shadow-card transition-transform active:scale-[0.985]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-700/80 text-2xl"
              aria-hidden="true"
            >
              {game.emoji}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-lg font-bold text-mist-100">
              {t(game.titleKey)}
            </span>
            <span className="shrink-0 text-2xl text-mist-600" aria-hidden="true">
              ›
            </span>
          </motion.button>
        ))}
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
      <div
        className={`font-mono text-[1.1rem] font-bold tabular-nums ${
          accent ? 'text-gold-400' : 'text-mist-100'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-mist-500">
        {label}
      </div>
    </button>
  );
}
