import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { SignalDisc } from '@/components/game/SignalDisc';
import { CompareCard } from '@/components/game/CompareCard';
import { ShareIcon } from '@/components/ui/icons';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useDuel } from '@/features/duel/useDuel';
import { DUEL_COUNTDOWN_MS } from '@/services/duelService';
import { useSettingsStore } from '@/store/settingsStore';
import { shareChallenge, haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';
import { BOT_USERNAME } from '@/lib/config';
import { formatMs } from '@/features/game/logic';
import type { DuelRole } from '@/types/duel';

interface DuelLocationState {
  duelId: string;
  role: DuelRole;
}

export function DuelScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useTelegramUser();
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const state = location.state as DuelLocationState | null;
  const goHome = useCallback(() => navigate('/', { replace: true }), [navigate]);
  useTelegramBackButton(goHome);

  const { duel, loading, error, markReady, submitTime } = useDuel(
    state?.duelId ?? null,
    state?.role ?? null,
    telegramUser?.id ?? null,
    telegramUser?.firstName ?? 'AqlBand',
  );

  const [now, setNow] = useState(() => Date.now());
  const [localMyTime, setLocalMyTime] = useState<number | null>(null);

  useEffect(() => {
    if (duel?.status !== 'countdown') return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [duel?.status]);

  const iAmHost = state?.role === 'host';
  const myReady = duel ? (iAmHost ? duel.host_ready : duel.guest_ready) : false;
  const opponentReady = duel ? (iAmHost ? duel.guest_ready : duel.host_ready) : false;
  const opponentName = duel ? (iAmHost ? (duel.guest_name ?? '') : duel.host_name) : '';
  const dbMyTime = duel ? (iAmHost ? duel.host_time_ms : duel.guest_time_ms) : null;
  const opponentTimeMs = duel ? (iAmHost ? duel.guest_time_ms : duel.host_time_ms) : null;
  const effectiveMyTime = localMyTime ?? dbMyTime;

  const goAtEpochMs = useMemo(
    () => (duel?.countdown_start_at ? new Date(duel.countdown_start_at).getTime() + DUEL_COUNTDOWN_MS : null),
    [duel?.countdown_start_at],
  );
  const remainingMs = goAtEpochMs !== null ? goAtEpochMs - now : null;
  const isGoPhase = remainingMs !== null && remainingMs <= 0;
  const countdownNumber = remainingMs !== null ? Math.max(1, Math.ceil(remainingMs / 1000)) : 5;

  const handleTap = useCallback(() => {
    if (!duel || duel.status !== 'countdown' || effectiveMyTime !== null) return;
    if (!isGoPhase || goAtEpochMs === null) return;

    const reaction = Math.max(1, Date.now() - goAtEpochMs);
    setLocalMyTime(reaction);
    if (soundEnabled) sfx.success();
    if (hapticsEnabled) haptics.success();
    void submitTime(reaction);
  }, [duel, effectiveMyTime, isGoPhase, goAtEpochMs, soundEnabled, hapticsEnabled, submitTime]);

  const handleReshare = () => {
    if (!duel) return;
    shareChallenge(BOT_USERNAME, `duel_${duel.id}`, "Reaksiya bo'yicha musobaqalashamizmi? Havolani bosing!");
  };

  if (!state?.duelId) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-mist-500">O'yin topilmadi.</p>
        <Button onClick={goHome}>Bosh sahifa</Button>
      </div>
    );
  }

  return (
    <div
      onPointerDown={handleTap}
      className="flex min-h-full w-full select-none flex-col px-5"
      style={{
        touchAction: 'manipulation',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <TopBar title="Do'st bilan" onBack={goHome} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {loading && <p className="text-sm text-mist-500">Yuklanmoqda...</p>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-sm text-signal-early">{error}</p>
            <Button onClick={goHome}>Bosh sahifa</Button>
          </div>
        )}

        {!loading && !error && duel && duel.status === 'waiting' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 animate-pulse rounded-full bg-violet-600/30" />
            <p className="text-sm text-mist-300">Do'stingizni kutmoqdamiz...</p>
            <p className="max-w-[16rem] text-xs text-mist-500">
              U havolani bosgan zahoti bu yerda avtomatik ko'rinadi.
            </p>
            <Button icon={<ShareIcon width={16} height={16} />} variant="secondary" onClick={handleReshare}>
              Havolani qayta yuborish
            </Button>
          </div>
        )}

        {!loading && !error && duel && duel.status === 'ready_check' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <p className="font-display text-lg font-semibold text-mist-100">
                {iAmHost ? duel.host_name : duel.guest_name} <span className="text-mist-500">vs</span>{' '}
                {opponentName}
              </p>
              <p className="mt-1 text-xs text-mist-500">
                {opponentReady ? "Raqib tayyor! Siz ham bosing." : 'Ikkalangiz ham tayyor bo\u2018lishi kerak'}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!myReady) void markReady();
              }}
              disabled={myReady}
              className={`flex h-40 w-40 items-center justify-center rounded-full border-2 font-display text-xl font-bold transition-colors ${
                myReady
                  ? 'border-signal-go bg-signal-go/15 text-signal-go'
                  : 'border-violet-500/50 bg-ink-700 text-mist-100 active:bg-ink-600'
              }`}
            >
              {myReady ? 'Tayyor \u2713' : 'Tayyorman'}
            </button>
          </div>
        )}

        {!loading && !error && duel && duel.status === 'countdown' && effectiveMyTime === null && (
          <SignalDisc
            phase={isGoPhase ? 'go' : 'countdown'}
            label={isGoPhase ? 'BOSING!' : countdownNumber}
            sublabel={isGoPhase ? undefined : 'Tayyorlaning'}
          />
        )}

        {!loading && !error && duel && duel.status === 'countdown' && effectiveMyTime !== null && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="font-mono text-5xl font-bold text-mist-100">{formatMs(effectiveMyTime)}</div>
            <p className="text-xs text-mist-500">ms — raqibni kutmoqdamiz...</p>
          </div>
        )}

        {!loading && !error && duel && duel.status === 'finished' && effectiveMyTime !== null && opponentTimeMs !== null && (
          <div className="w-full">
            <CompareCard yourTimeMs={effectiveMyTime} opponentTimeMs={opponentTimeMs} opponentName={opponentName} />
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={goHome}>Bosh sahifa</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
