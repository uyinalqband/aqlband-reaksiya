import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { getProgression } from '@/services/progressionService';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { getXpRankProgress, XP_RANKS } from '@/features/progression/ranks';
import { RankBadge } from '@/components/progression/RankBadge';
import type { ProgressionSnapshot } from '@/types/progression';

const labels = {
  uz: {
    title: 'Rivojlanish',
    totalXp: 'Jami XP',
    todayXp: 'Bugun',
    leaderboardRank: 'Umumiy reyting',
    rewardedGames: 'O‘yinlar',
    rank: 'Daraja',
    next: 'Keyingi darajagacha',
    max: 'Maksimum',
    details: 'Darajalar jadvali',
    tapHint: 'Darajani bosib batafsil ko‘ring',
  },
  en: {
    title: 'Progress',
    totalXp: 'Total XP',
    todayXp: 'Today',
    leaderboardRank: 'Global rank',
    rewardedGames: 'Games',
    rank: 'Rank',
    next: 'To next rank',
    max: 'Max',
    details: 'Rank table',
    tapHint: 'Tap the rank to see all tiers',
  },
  ru: {
    title: 'Прогресс',
    totalXp: 'Всего XP',
    todayXp: 'Сегодня',
    leaderboardRank: 'Общий рейтинг',
    rewardedGames: 'Игры',
    rank: 'Уровень',
    next: 'До следующего ранга',
    max: 'Максимум',
    details: 'Таблица рангов',
    tapHint: 'Нажмите на ранг, чтобы увидеть все уровни',
  },
} as const;

function ProgressStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-700/40 px-2 py-3 text-center">
      <p className={`font-mono text-base font-bold tabular-nums ${accent ? 'text-gold-400' : 'text-mist-100'}`}>
        {value}
      </p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-mist-500">{label}</p>
    </div>
  );
}

export function ProgressionCard() {
  const { i18n, t } = useTranslation();
  const language = (i18n.resolvedLanguage?.startsWith('ru')
    ? 'ru'
    : i18n.resolvedLanguage?.startsWith('en')
      ? 'en'
      : 'uz') as keyof typeof labels;
  const text = labels[language];

  const totalAttempts = useGameHistoryStore((state) => state.attempts.length);
  const updateRank = useOnlineStore((state) => state.updateRank);

  const [snapshot, setSnapshot] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRanks, setShowRanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProgression();
      setSnapshot(data);
      await updateRank(data.rank);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t, updateRank]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalXp = snapshot?.totalXp ?? 0;
  const progress = useMemo(() => getXpRankProgress(totalXp), [totalXp]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat('en-US'), []);

  return (
    <>
      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-mist-100">{text.title}</h2>
            <p className="mt-1 text-sm text-mist-500">{text.tapHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRanks(true)}
            className="rounded-2xl border border-violet-400/35 bg-violet-500/10 px-3 py-2 text-left transition-colors active:bg-violet-500/20"
          >
            <p className="text-[10px] uppercase tracking-wide text-violet-200">{text.rank}</p>
            <div className="mt-1">
              <RankBadge rank={progress.current} />
            </div>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <ProgressStat label={text.totalXp} value={numberFormatter.format(totalXp)} accent />
          <ProgressStat label={text.todayXp} value={numberFormatter.format(snapshot?.todayXp ?? 0)} />
          <ProgressStat label={text.leaderboardRank} value={snapshot?.rank ? `#${snapshot.rank}` : '—'} />
          <ProgressStat label={text.rewardedGames} value={String(snapshot?.totalRewardedGames ?? totalAttempts)} />
        </div>

        <div className="mt-4 rounded-2xl border border-ink-600/60 bg-ink-700/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-mist-200">{progress.current.name} {progress.current.division}</p>
              <p className="text-xs text-mist-500">
                {progress.next
                  ? `${text.next}: ${numberFormatter.format(progress.remainingXp)} XP`
                  : text.max}
              </p>
            </div>
            <p className="font-mono text-sm font-bold text-gold-400">{Math.round(progress.progressPercent)}%</p>
          </div>

          <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-gold-400"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-mist-700">
            <span>{numberFormatter.format(progress.current.minXp)} XP</span>
            <span>{progress.next ? `${numberFormatter.format(progress.next.minXp)} XP` : text.max}</span>
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-xs text-mist-500">{t('common.loading')}</p>
        ) : error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            {error}
          </button>
        ) : null}
      </Card>

      {showRanks ? (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm"
          onClick={() => setShowRanks(false)}
        >
          <Card
            className="max-h-[84vh] w-full max-w-md overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-mist-100">{text.details}</h2>
                <p className="text-sm text-mist-500">{text.rank}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRanks(false)}
                className="h-10 w-10 rounded-full bg-ink-700 text-xl text-mist-200 transition-colors active:bg-ink-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {XP_RANKS.map((rank) => {
                const active = rank.minXp === progress.current.minXp;
                return (
                  <div
                    key={`${rank.tier}-${rank.division}`}
                    className={`rounded-2xl border p-3 ${
                      active
                        ? 'border-violet-400/45 bg-violet-500/15'
                        : 'border-ink-600 bg-ink-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <RankBadge rank={rank} />
                      <span className="font-mono text-sm font-bold text-gold-400">
                        {numberFormatter.format(rank.minXp)} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
