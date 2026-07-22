import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RotateIcon } from '@/components/ui/icons';
import {
  DIFFICULTY_LABELS,
  selectedRoundsLabel,
  type GameSessionConfig,
} from '@/features/gameSession/config';
import { formatMs } from '@/features/game/logic';

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
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-5xl" aria-hidden="true">{emoji}</div>
      <p className="mt-3 text-sm font-semibold text-mist-300">{title} yakunlandi</p>
      <div className="mt-4 font-mono text-5xl font-bold tabular-nums text-mist-100">
        {formatMs(averageMs)}
        <span className="ml-2 text-base text-mist-500">ms</span>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wider text-mist-600">O'rtacha natija</p>

      <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
        <SummaryStat value={String(completedRounds)} label="Raund" />
        <SummaryStat value={String(correct)} label="To'g'ri" accent />
        <SummaryStat value={String(errors + timeouts)} label="Xato" />
      </div>

      <Card className="mt-4 w-full text-left">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">Rejim</span>
          <span className="font-semibold text-mist-200">{selectedRoundsLabel(config.rounds)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">Qiyinlik</span>
          <span className="font-semibold text-mist-200">{DIFFICULTY_LABELS[config.difficulty]}</span>
        </div>
      </Card>

      {children}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Button icon={<RotateIcon width={18} height={18} />} onClick={onReplay}>
          Yana o'ynash
        </Button>
        <Button variant="secondary" onClick={onChangeSettings}>
          Sozlamalarni o'zgartirish
        </Button>
        <Button variant="ghost" onClick={onHome}>
          Bosh sahifa
        </Button>
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
