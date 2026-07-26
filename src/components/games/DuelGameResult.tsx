import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CompareCard } from '@/components/games/CompareCard';
import {
  type GameSessionConfig,
} from '@/features/games/session/config';
import { formatMs } from '@/features/games/session/metrics';
import { shareGameResult } from '@/lib/share';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useOnlineStore } from '@/store/onlineStore';
import { submitDuelTime, subscribeToDuel } from '@/services/duelService';
import type { DuelGameContext, DuelRow } from '@/types/duel';

interface DuelGameResultProps {
  context: DuelGameContext;
  title: string;
  emoji: string;
  averageMs: number;
  completedRounds: number;
  correct: number;
  errors: number;
  timeouts?: number;
  config: GameSessionConfig;
  onHome: () => void;
}

export function DuelGameResult({
  context,
  title,
  emoji,
  averageMs,
  completedRounds,
  correct,
  errors,
  timeouts = 0,
  config,
  onHome,
}: DuelGameResultProps) {
  const { t } = useTranslation();
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const savedHistoryRef = useRef(false);
  const addAttempt = useGameHistoryStore((state) => state.addAttempt);
  const appUserId = useOnlineStore((state) => state.appUserId);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    void submitDuelTime(context.duelId, averageMs)
      .then((result) => setDuel(result))
      .catch((submitError) => {
        setError(submitError instanceof Error ? submitError.message : "Natijani yuborib bo'lmadi.");
      });
  }, [averageMs, context.duelId]);

  useEffect(() => {
    return subscribeToDuel(
      context.duelId,
      (result) => {
        setDuel(result);
        setError(null);
      },
      (pollError) => {
        setError(pollError instanceof Error ? pollError.message : 'Ulanishda xato yuz berdi.');
      },
    );
  }, [context.duelId]);

  const iAmHost = context.role === 'host';
  const myServerScore = duel ? (iAmHost ? duel.host_time_ms : duel.guest_time_ms) : null;
  const opponentScore = duel ? (iAmHost ? duel.guest_time_ms : duel.host_time_ms) : null;
  const effectiveMyScore = myServerScore ?? averageMs;

  useEffect(() => {
    if (
      !duel ||
      duel.status !== 'finished' ||
      myServerScore === null ||
      opponentScore === null ||
      savedHistoryRef.current ||
      !appUserId
    ) {
      return;
    }

    savedHistoryRef.current = true;
    const draw = myServerScore === opponentScore;
    const won = myServerScore < opponentScore;

    void addAttempt({
      id: `duel-${duel.id}-${appUserId}`,
      gameId: context.gameId,
      metric: 'duration_ms',
      value: myServerScore,
      meta: {
        multiplayer: true,
        opponent: context.opponentName,
        opponentTimeMs: opponentScore,
        outcome: draw ? 'draw' : won ? 'win' : 'loss',
        won,
        draw,
        role: context.role,
        difficulty: config.difficulty,
        rounds: config.rounds === 'survival' ? 0 : config.rounds,
        survival: config.rounds === 'survival',
        correct,
        errors,
        timeouts,
      },
    });
  }, [
    addAttempt,
    appUserId,
    config.difficulty,
    config.rounds,
    context.gameId,
    context.opponentName,
    context.role,
    correct,
    duel,
    errors,
    myServerScore,
    opponentScore,
    timeouts,
  ]);

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
          <span className="text-mist-500">Raqib</span>
          <span className="font-semibold text-mist-200">{context.opponentName}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">Rejim</span>
          <span className="font-semibold text-mist-200">{config.rounds === 'survival' ? t('setup.survival') : `${config.rounds} ${t('setup.rounds')}`}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-500">Qiyinlik</span>
          <span className="font-semibold text-mist-200">{t(`difficulty.${config.difficulty}.title`)}</span>
        </div>
      </Card>

      {opponentScore === null ? (
        <Card className="mt-4 w-full">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-violet-600/25" />
          <p className="mt-3 text-sm font-semibold text-mist-200">Raqib natijasini kutmoqdamiz...</p>
          <p className="mt-1 text-xs text-mist-500">Natija avtomatik yangilanadi.</p>
        </Card>
      ) : (
        <div className="mt-4 w-full">
          <CompareCard
            yourTimeMs={effectiveMyScore}
            opponentTimeMs={opponentScore}
            opponentName={context.opponentName}
          />
        </div>
      )}

      {error && <p className="mt-3 text-xs text-signal-early">{error}</p>}

      <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
        <Button onClick={() => void shareGameResult(title, `${formatMs(averageMs)} ms · ${context.opponentName} bilan duel`)}>
          📤 Natijani ulashish
        </Button>
        <Button variant="secondary" onClick={onHome}>Bosh sahifa</Button>
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
