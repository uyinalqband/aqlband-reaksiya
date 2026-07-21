import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { formatMs } from '@/features/game/logic';

interface CompareCardProps {
  yourTimeMs: number;
  opponentTimeMs: number;
  opponentName: string;
}

export function CompareCard({ yourTimeMs, opponentTimeMs, opponentName }: CompareCardProps) {
  const { t } = useTranslation();
  const youWin = yourTimeMs < opponentTimeMs;
  const tie = Math.round(yourTimeMs) === Math.round(opponentTimeMs);
  const diff = Math.abs(Math.round(yourTimeMs) - Math.round(opponentTimeMs));

  const statusText = tie ? t('compare.tie') : youWin ? t('compare.won') : t('compare.lost');
  const statusColor = tie ? 'text-gold-400' : youWin ? 'text-signal-go' : 'text-signal-early';

  return (
    <Card className="mt-2">
      <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-mist-500">{t('compare.title')}</h3>

      <div className="mt-4 flex items-center justify-center gap-4">
        <PlayerColumn label={t('compare.you')} timeMs={yourTimeMs} highlight={youWin && !tie} />
        <div className="text-mist-600 font-display text-sm font-semibold">VS</div>
        <PlayerColumn label={opponentName} timeMs={opponentTimeMs} highlight={!youWin && !tie} />
      </div>

      <p className={`mt-5 text-center font-display text-lg font-bold ${statusColor}`}>{statusText}</p>
      {!tie && (
        <p className="mt-1 text-center text-xs text-mist-500">{t('compare.diffFaster', { ms: diff })}</p>
      )}
    </Card>
  );
}

function PlayerColumn({ label, timeMs, highlight }: { label: string; timeMs: number; highlight: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-xs font-bold ${
          highlight ? 'border-gold-500 bg-gold-500/10 text-gold-400' : 'border-ink-600 bg-ink-700 text-mist-300'
        }`}
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
      <span className="max-w-[5.5rem] truncate text-xs text-mist-500">{label}</span>
      <span className="font-mono text-base font-semibold text-mist-100">{formatMs(timeMs)}</span>
    </div>
  );
}
