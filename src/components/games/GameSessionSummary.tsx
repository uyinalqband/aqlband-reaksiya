import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RotateIcon } from '@/components/ui/icons';
import {
  type GameSessionConfig,
} from '@/features/games/session/config';
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
  onChangeSettings: () => void;
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
  config,
  onReplay,
  onChangeSettings,
  onHome,
  children,
}: GameSessionSummaryProps) {
  const { t } = useTranslation();
  const resultText = `${formatMs(averageMs)} ms · ${completedRounds} ${t('gameplay.roundsCompleted')}`;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-5xl" aria-hidden="true">{emoji}</div>
      <p className="mt-3 text-sm font-semibold text-mist-300">{title} {t('result.completed')}</p>
      <div className="mt-4 font-mono text-5xl font-bold tabular-nums text-mist-100">
        {formatMs(averageMs)}
        <span className="ml-2 text-base text-mist-500">ms</span>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wider text-mist-600">{t('result.averageResult')}</p>

      <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
        <SummaryStat value={String(completedRounds)} label={t('gameplay.round')} />
        <SummaryStat value={String(correct)} label={t('result.correct')} accent />
        <SummaryStat value={String(errors + timeouts)} label={t('result.errors')} />
      </div>

      <Card className="mt-4 w-full text-left">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">{t('result.mode')}</span>
          <span className="font-semibold text-mist-200">{config.rounds === 'survival' ? t('setup.survival') : `${config.rounds} ${t('setup.rounds')}`}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">{t('setup.difficulty')}</span>
          <span className="font-semibold text-mist-200">{t(`difficulty.${config.difficulty}.title`)}</span>
        </div>
      </Card>

      {children}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Button onClick={() => void shareGameResult(title, resultText)}>📤 {t('result.shareResult')}</Button>
        <Button icon={<RotateIcon width={18} height={18} />} onClick={onReplay}>{t('result.playAgainCta')}</Button>
        <Button variant="secondary" onClick={onChangeSettings}>{t('result.changeSettings')}</Button>
        <Button variant="ghost" onClick={onHome}>{t('result.homeCta')}</Button>
      </div>
    </div>
  );
}

function SummaryStat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/80 px-2 py-3">
      <p className={`font-mono text-lg font-bold ${accent ? 'text-gold-400' : 'text-mist-100'}`}>{value}</p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-mist-500">{label}</p>
    </div>
  );
}
