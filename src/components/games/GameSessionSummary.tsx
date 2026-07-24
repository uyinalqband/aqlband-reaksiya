import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { RotateIcon } from '@/components/ui/icons';
import type { GameSessionConfig } from '@/features/games/session/config';
import { formatMs } from '@/features/games/session/metrics';
import { shareGameResult } from '@/lib/share';

interface GameSessionSummaryProps {
  title: string;
  emoji: string;
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts?: number;
  config: GameSessionConfig;
  onReplay: () => void;
  onChangeSettings?: () => void;
  onHome: () => void;
  children?: ReactNode;
}

export function GameSessionSummary({
  title,
  emoji,
  averageMs,
  completedRounds,
  correct,
  errors,
  timeouts = 0,
  onReplay,
  onHome,
  children,
}: GameSessionSummaryProps) {
  const { t } = useTranslation();
  const resultText = `${formatMs(averageMs)} ms · ${completedRounds} ${t('gameplay.roundsCompleted')}`;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-[#1A2B49] via-[#0E1828] to-[#08111C] p-5 text-center shadow-glow">
      <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/15 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-white/10 bg-white/5 text-5xl shadow-inner" aria-hidden="true">
          {emoji}
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
          {title}
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-mist-100">
          {t('result.completed')}
        </h2>

        <div className="mt-5 font-mono text-5xl font-black tabular-nums text-gold-300">
          {formatMs(averageMs)}
          <span className="ml-2 text-sm text-mist-500">ms</span>
        </div>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-mist-600">
          {t('result.averageResult')}
        </p>

        <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
          <SummaryStat value={String(completedRounds)} label={t('gameplay.round')} />
          <SummaryStat value={String(correct)} label={t('result.correct')} accent />
          <SummaryStat value={String(errors + timeouts)} label={t('result.errors')} />
        </div>

        {children}

        <div className="mt-6 flex w-full flex-col gap-3">
          <Button onClick={() => void shareGameResult(title, resultText)}>
            📤 {t('result.shareResult')}
          </Button>
          <Button icon={<RotateIcon width={18} height={18} />} onClick={onReplay}>
            {t('result.playAgainCta')}
          </Button>
          <Button variant="ghost" onClick={onHome}>
            {t('result.homeCta')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-2 py-3 ${
      accent
        ? 'border-emerald-300/25 bg-emerald-500/10'
        : 'border-white/10 bg-black/15'
    }`}>
      <p className={`font-mono text-xl font-black ${accent ? 'text-emerald-300' : 'text-mist-100'}`}>
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-mist-600">
        {label}
      </p>
    </div>
  );
}
