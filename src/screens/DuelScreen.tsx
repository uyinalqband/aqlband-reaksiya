import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { SignalDisc } from '@/components/game/SignalDisc';
import { CompareCard } from '@/components/game/CompareCard';
import { Card } from '@/components/ui/Card';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useDuel } from '@/features/duel/useDuel';
import { gamePath, makeDuelGameState } from '@/features/duel/duelSession';
import { DUEL_COUNTDOWN_MS } from '@/services/duelService';
import { useSettingsStore } from '@/store/settingsStore';
import { haptics } from '@/lib/telegram';
import { sfx } from '@/lib/sound';
import {
  DIFFICULTY_LABELS,
  GAME_SETUP_COPY,
  selectedRoundsLabel,
} from '@/features/gameSession/config';
import { duelConfig, type DuelGameContext, type DuelRole } from '@/types/duel';

interface DuelLocationState {
  duelId: string;
  role: DuelRole;
}

const DUEL_SESSION_KEY = 'aqlband_active_duel_v2';

function isDuelRole(value: unknown): value is DuelRole {
  return value === 'host' || value === 'guest';
}

function parseDuelState(value: unknown): DuelLocationState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<DuelLocationState>;
  if (typeof raw.duelId !== 'string' || !raw.duelId || !isDuelRole(raw.role)) return null;
  return { duelId: raw.duelId, role: raw.role };
}

function readStoredDuelState(): DuelLocationState | null {
  try {
    const raw = window.sessionStorage.getItem(DUEL_SESSION_KEY);
    return raw ? parseDuelState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function DuelScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useTelegramUser();
  const soundEnabled = useSettingsStore((state) => state.soundEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

  const locationState = parseDuelState(location.state);
  const queryState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return parseDuelState({
      duelId: params.get('duelId'),
      role: params.get('role'),
    });
  }, [location.search]);
  const [storedState] = useState<DuelLocationState | null>(() => readStoredDuelState());
  const state = locationState ?? queryState ?? storedState;

  useEffect(() => {
    if (!state) return;
    try {
      window.sessionStorage.setItem(DUEL_SESSION_KEY, JSON.stringify(state));
    } catch {
      // Current route state is enough if storage is unavailable.
    }

    const params = new URLSearchParams(location.search);
    if (params.get('duelId') !== state.duelId || params.get('role') !== state.role) {
      navigate(`/duel?duelId=${encodeURIComponent(state.duelId)}&role=${state.role}`, {
        replace: true,
        state,
      });
    }
  }, [state, location.search, navigate]);

  const clearStoredDuel = useCallback(() => {
    try {
      window.sessionStorage.removeItem(DUEL_SESSION_KEY);
    } catch {
      // Ignore unavailable session storage.
    }
  }, []);

  const goHome = useCallback(() => {
    clearStoredDuel();
    navigate('/', { replace: true });
  }, [clearStoredDuel, navigate]);
  useTelegramBackButton(goHome);

  const { duel, loading, error, markReady, cancel, serverOffsetMs } = useDuel(
    state?.duelId ?? null,
    state?.role ?? null,
    telegramUser?.id ?? null,
    telegramUser?.firstName ?? 'AqlBand',
  );

  const [now, setNow] = useState(() => Date.now());
  const [readyBusy, setReadyBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!duel || !['ready_check', 'countdown', 'playing'].includes(duel.status)) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [duel?.status]);

  useEffect(() => {
    if (duel?.status !== 'ready_check' || !soundEnabled) return;
    sfx.invite();
    const interval = window.setInterval(() => sfx.invite(), 2_600);
    return () => window.clearInterval(interval);
  }, [duel?.status, soundEnabled]);

  const iAmHost = state?.role === 'host';
  const myReady = duel ? (iAmHost ? duel.host_ready : duel.guest_ready) : false;
  const opponentReady = duel ? (iAmHost ? duel.guest_ready : duel.host_ready) : false;
  const opponentName = duel ? (iAmHost ? (duel.guest_name ?? '') : duel.host_name) : '';
  const myName = duel ? (iAmHost ? duel.host_name : (duel.guest_name ?? 'AqlBand')) : 'AqlBand';
  const myTime = duel ? (iAmHost ? duel.host_time_ms : duel.guest_time_ms) : null;
  const opponentTime = duel ? (iAmHost ? duel.guest_time_ms : duel.host_time_ms) : null;

  const adjustedNow = now + serverOffsetMs;
  const readyRemainingMs = duel?.ready_deadline_at
    ? Math.max(0, new Date(duel.ready_deadline_at).getTime() - adjustedNow)
    : 20_000;
  const readySeconds = Math.max(0, Math.ceil(readyRemainingMs / 1000));

  const startAtMs = duel?.game_start_at
    ? new Date(duel.game_start_at).getTime()
    : duel?.countdown_start_at
      ? new Date(duel.countdown_start_at).getTime() + DUEL_COUNTDOWN_MS
      : null;
  const countdownRemainingMs = startAtMs === null ? DUEL_COUNTDOWN_MS : startAtMs - adjustedNow;
  const countdownNumber = Math.max(1, Math.ceil(Math.max(0, countdownRemainingMs) / 1000));

  useEffect(() => {
    if (!duel || !state || launchedRef.current) return;
    const readyToLaunch =
      duel.status === 'playing' ||
      (duel.status === 'countdown' && startAtMs !== null && adjustedNow >= startAtMs);
    if (!readyToLaunch) return;

    launchedRef.current = true;
    const context: DuelGameContext = {
      duelId: duel.id,
      role: state.role,
      gameId: duel.game_id,
      config: duelConfig(duel),
      opponentName,
    };
    clearStoredDuel();
    navigate(gamePath(duel.game_id), {
      replace: true,
      state: makeDuelGameState(context),
    });
  }, [adjustedNow, clearStoredDuel, duel, navigate, opponentName, startAtMs, state]);

  const handleReady = async () => {
    if (myReady || readyBusy) return;
    setReadyBusy(true);
    if (hapticsEnabled) haptics.success();
    try {
      await markReady();
    } finally {
      setReadyBusy(false);
    }
  };

  const handleCancel = async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    try {
      await cancel();
    } finally {
      setCancelBusy(false);
    }
  };

  if (!state?.duelId) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-mist-500">O'yin topilmadi.</p>
        <Button onClick={goHome}>Bosh sahifa</Button>
      </div>
    );
  }

  const copy = duel ? GAME_SETUP_COPY[duel.game_id] : null;
  const config = duel ? duelConfig(duel) : null;

  return (
    <div
      className="flex min-h-full w-full select-none flex-col px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <TopBar title="Do'st bilan o'yin" onBack={goHome} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {loading && <p className="text-sm text-mist-500">Yuklanmoqda...</p>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-xs text-sm text-signal-early">{error}</p>
            <Button onClick={goHome}>Bosh sahifa</Button>
          </div>
        )}

        {!loading && !error && duel && copy && config && (
          <>
            <Card className="w-full text-center">
              <div className="text-4xl">{copy.emoji}</div>
              <p className="mt-2 font-display text-lg font-bold text-mist-100">{copy.title}</p>
              <p className="mt-1 text-xs text-mist-500">
                {selectedRoundsLabel(config.rounds)} · {DIFFICULTY_LABELS[config.difficulty]}
              </p>
            </Card>

            {(duel.status === 'invited' || duel.status === 'waiting') && (
              <div className="flex w-full flex-col items-center gap-5 text-center">
                <div className="h-16 w-16 animate-pulse rounded-full bg-violet-600/30" />
                <div>
                  <p className="text-sm font-semibold text-mist-200">
                    {opponentName || "Do'stingiz"}ga chaqiruv yuborildi
                  </p>
                  <p className="mt-1 text-xs text-mist-500">Qabul qilishini kutmoqdamiz...</p>
                </div>
                <Button className="w-full max-w-xs" variant="secondary" disabled={cancelBusy} onClick={() => void handleCancel()}>
                  {cancelBusy ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
                </Button>
              </div>
            )}

            {duel.status === 'ready_check' && (
              <div className="flex w-full flex-col items-center gap-5 text-center">
                <div>
                  <p className="font-display text-lg font-semibold text-mist-100">
                    {myName} <span className="text-mist-500">vs</span> {opponentName}
                  </p>
                  <p className="mt-1 text-sm text-gold-400">
                    Tayyorgarlik uchun {readySeconds} soniya
                  </p>
                  <p className="mt-1 text-xs text-mist-500">
                    {opponentReady ? 'Raqib tayyor. Siz ham tayyor bo‘ling.' : 'Ikkala o‘yinchi ham “Tayyorman”ni bosishi kerak.'}
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-3">
                  <Button className="w-full" disabled={myReady || readyBusy} onClick={() => void handleReady()}>
                    {myReady ? 'Tayyor ✓' : readyBusy ? 'Saqlanmoqda...' : 'Tayyorman'}
                  </Button>
                  <Button className="w-full" variant="secondary" disabled={cancelBusy} onClick={() => void handleCancel()}>
                    {cancelBusy ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
                  </Button>
                </div>

                <div className="flex gap-3 text-xs">
                  <span className={myReady ? 'text-signal-go' : 'text-mist-600'}>
                    Siz: {myReady ? 'tayyor' : 'kutilmoqda'}
                  </span>
                  <span className={opponentReady ? 'text-signal-go' : 'text-mist-600'}>
                    Raqib: {opponentReady ? 'tayyor' : 'kutilmoqda'}
                  </span>
                </div>
              </div>
            )}

            {duel.status === 'countdown' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <SignalDisc
                  phase="countdown"
                  label={countdownNumber}
                  sublabel="O'yin boshlanmoqda"
                />
                <p className="text-sm text-mist-500">Ikkala qurilmada ham bir vaqtda boshlanadi.</p>
              </div>
            )}

            {duel.status === 'playing' && (
              <p className="text-sm text-mist-500">O'yin ochilmoqda...</p>
            )}

            {(duel.status === 'cancelled' || duel.status === 'expired') && (
              <div className="flex w-full flex-col items-center gap-4 text-center">
                <p className="text-lg font-semibold text-mist-100">
                  {duel.status === 'expired' ? 'Chaqiruv muddati tugadi' : "O'yin bekor qilindi"}
                </p>
                <p className="max-w-xs text-sm text-mist-500">
                  20 soniya ichida ikkala o'yinchi ham tayyor bo'lmasa, o'yin avtomatik bekor qilinadi.
                </p>
                <Button className="w-full max-w-xs" onClick={goHome}>Bosh sahifa</Button>
              </div>
            )}

            {duel.status === 'finished' && myTime !== null && opponentTime !== null && (
              <div className="w-full">
                <CompareCard yourTimeMs={myTime} opponentTimeMs={opponentTime} opponentName={opponentName} />
                <Button className="mt-5 w-full" onClick={goHome}>Bosh sahifa</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
