import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { getProgression } from '@/services/progressionService';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { getXpRankProgress } from '@/features/progression/ranks';
import { RankBadge } from '@/components/progression/RankBadge';
import type { ProgressionSnapshot } from '@/types/progression';

const labels = {
  uz: {
    title: 'Rivojlanish',
    totalXp: 'Jami XP',
    todayXp: 'Bugun',
    leaderboardRank: 'XP reytingi',
    nextRank: 'Keyingi unvongacha',
    highestRank: 'Eng yuqori unvon',
    loading: 'XP yuklanmoqda...',
    unavailable: "XP ma'lumotini yuklab bo'lmadi.",
    retry: 'Qayta urinish',
    max: 'MAX',
  },
  ru: {
    title: 'Прогресс',
    totalXp: 'Всего XP',
    todayXp: 'Сегодня',
    leaderboardRank: 'XP-рейтинг',
    nextRank: 'До следующего ранга',
    highestRank: 'Высший ранг',
    loading: 'Загрузка XP...',
    unavailable: 'Не удалось загрузить XP.',
    retry: 'Повторить',
    max: 'MAX',
  },
  en: {
    title: 'Progress',
    totalXp: 'Total XP',
    todayXp: 'Today',
    leaderboardRank: 'XP rank',
    nextRank: 'Until next rank',
    highestRank: 'Highest rank',
    loading: 'Loading XP...',
    unavailable: 'Could not load XP.',
    retry: 'Try again',
    max: 'MAX',
  },
} as const;

type SupportedLanguage = keyof typeof labels;

function supportedLanguage(value: string | undefined): SupportedLanguage {
  if (value?.startsWith('ru')) return 'ru';
  if (value?.startsWith('en')) return 'en';
  return 'uz';
}

export function ProgressionCard() {
  const { i18n } = useTranslation();
  const accountId = useOnlineStore((state) => state.appUserId);
  const accountDeleted = useOnlineStore((state) => state.accountDeleted);
  const attemptCount = useGameHistoryStore((state) => state.attempts.length);
  const [snapshot, setSnapshot] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const language = supportedLanguage(i18n.resolvedLanguage ?? i18n.language);
  const text = labels[language];

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ'),
    [language],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    if (accountDeleted) return;
    setLoading(true);
    setErrorMessage('');
    try {
      setSnapshot(await getProgression(signal));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'request_aborted') return;
      setErrorMessage(error instanceof Error && error.message ? error.message : text.unavailable);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accountDeleted, text.unavailable]);

  useEffect(() => {
    if (accountDeleted) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [accountId, accountDeleted, load]);

  useEffect(() => {
    if (attemptCount === 0 || accountDeleted) return;
    const timer = window.setTimeout(() => void load(), 1400);
    return () => window.clearTimeout(timer);
  }, [attemptCount, accountDeleted, load]);

  if (loading && !snapshot) {
    return (
      <Card className="mt-4">
        <p className="text-center text-sm text-mist-500">{text.loading}</p>
      </Card>
    );
  }

  if (errorMessage && !snapshot) {
    return (
      <Card className="mt-4 text-center">
        <p className="text-sm text-mist-500">{errorMessage}</p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-300"
          onClick={() => void load()}
        >
          {text.retry}
        </button>
      </Card>
    );
  }

  if (!snapshot) return null;

  const rankProgress = getXpRankProgress(snapshot.totalXp);
  const { current, next, remainingXp, progressPercent } = rankProgress;

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-mist-500">{text.title}</p>
          <p className="mt-1 truncate font-display text-2xl font-bold text-mist-100">
            {current.name} {current.division}
          </p>
          <RankBadge rank={current} compact className="mt-2" />
        </div>

        <div
          className={[
            'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border',
            current.toneClass,
          ].join(' ')}
          title={`${current.minXp}+ XP`}
        >
          <span className="text-2xl leading-none" aria-hidden="true">{current.emoji}</span>
          <span className="mt-1 font-mono text-[11px] font-bold">{current.division}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5">
        <ProgressStat label={text.totalXp} value={numberFormatter.format(snapshot.totalXp)} accent />
        <ProgressStat label={text.todayXp} value={`+${numberFormatter.format(snapshot.todayXp)}`} />
        <ProgressStat label={text.leaderboardRank} value={`#${numberFormatter.format(snapshot.rank)}`} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-mist-500">
            {next ? `${text.nextRank}: ${next.emoji} ${next.name} ${next.division}` : text.highestRank}
          </span>
          <span className="shrink-0 font-mono font-semibold text-mist-300">
            {next ? `${numberFormatter.format(remainingXp)} XP` : text.max}
          </span>
        </div>

        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-gold-400 transition-[width] duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-mist-700">
          <span>{numberFormatter.format(current.minXp)} XP</span>
          <span>{next ? `${numberFormatter.format(next.minXp)} XP` : text.max}</span>
        </div>
      </div>
    </Card>
  );
}

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
