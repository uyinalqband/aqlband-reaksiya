import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useDuel } from '@/features/duel/useDuel';
import {
  gamePath,
  makeDuelGameState,
} from '@/features/duel/duelSession';
import { getGameDefinition } from '@/features/games/catalog';
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
  if (
    typeof raw.duelId !== 'string' ||
    !raw.duelId ||
    !isDuelRole(raw.role)
  ) {
    return null;
  }
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
  const { t } = useTranslation();
  const location = useLocation();
  const telegramUser = useTelegramUser();

  const locationState = parseDuelState(location.state);
  const queryState = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return parseDuelState({
      duelId: params.get('duelId'),
      role: params.get('role'),
    });
  }, [location.search]);
  const [storedState] = useState<DuelLocationState | null>(() =>
    readStoredDuelState(),
  );
  const state = locationState ?? queryState ?? storedState;

  useEffect(() => {
    if (!state) return;
    try {
      window.sessionStorage.setItem(DUEL_SESSION_KEY, JSON.stringify(state));
    } catch {
      // Route state remains enough when session storage is unavailable.
    }

    const params = new URLSearchParams(location.search);
    if (
      params.get('duelId') !== state.duelId ||
      params.get('role') !== state.role
    ) {
      navigate(
        `/duel?duelId=${encodeURIComponent(state.duelId)}&role=${state.role}`,
        { replace: true, state },
      );
    }
  }, [location.search, navigate, state]);

  const clearStoredDuel = useCallback(() => {
    try {
      window.sessionStorage.removeItem(DUEL_SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const goHome = useCallback(() => {
    clearStoredDuel();
    navigate('/', { replace: true });
  }, [clearStoredDuel, navigate]);
  useTelegramBackButton(goHome);

  const { duel, loading, error, markReady, cancel } = useDuel(
    state?.duelId ?? null,
    state?.role ?? null,
    telegramUser?.id ?? null,
    telegramUser?.firstName ?? 'AqlBand',
  );
  const [cancelBusy, setCancelBusy] = useState(false);
  const legacyStartRef = useRef(false);
  const launchedRef = useRef(false);

  const iAmHost = state?.role === 'host';
  const opponentName = duel
    ? iAmHost
      ? duel.guest_name ?? t('checkers.opponent')
      : duel.host_name
    : t('checkers.opponent');
  const myName = duel
    ? iAmHost
      ? duel.host_name
      : duel.guest_name ?? 'AqlBand'
    : telegramUser?.firstName ?? 'AqlBand';

  useEffect(() => {
    if (
      !duel ||
      legacyStartRef.current ||
      !['ready_check', 'countdown'].includes(duel.status) ||
      !['checkers', 'tic-tac-toe'].includes(duel.game_id)
    ) {
      return;
    }
    legacyStartRef.current = true;
    void markReady();
  }, [duel, markReady]);

  useEffect(() => {
    if (!duel || !state || launchedRef.current || duel.status !== 'playing') {
      return;
    }

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
  }, [clearStoredDuel, duel, navigate, opponentName, state]);

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
      <Screen>
        <TopBar title={t('duel.title')} onBack={goHome} />
        <Card className="text-center">
          <p className="py-6 text-sm text-mist-500">
            {t('common.notFound')}
          </p>
          <Button className="w-full" onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </Card>
      </Screen>
    );
  }

  const game = duel ? getGameDefinition(duel.game_id) : null;

  return (
    <Screen>
      <TopBar
        title={game ? t(game.titleKey) : t('duel.title')}
        onBack={goHome}
      />

      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-16 w-16 animate-pulse rounded-3xl bg-violet-500/20" />
        </div>
      ) : error ? (
        <Card className="text-center">
          <p className="text-sm text-red-200">{error}</p>
          <Button className="mt-5 w-full" onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </Card>
      ) : duel && (duel.status === 'invited' || duel.status === 'waiting') ? (
        <div className="flex min-h-[64vh] flex-col items-center justify-center text-center">
          <div className="flex items-center gap-4">
            <UserAvatar currentUser name={myName} size="lg" />
            <span className="font-display text-sm font-extrabold text-mist-600">
              VS
            </span>
            <UserAvatar name={opponentName} size="lg" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-extrabold text-mist-100">
            {opponentName}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-mist-500">
            {t('duel.waitingAcceptance')}
          </p>
          <Button
            className="mt-8 w-full max-w-xs"
            variant="secondary"
            disabled={cancelBusy}
            onClick={() => void handleCancel()}
          >
            {cancelBusy ? t('common.loading') : t('common.cancel')}
          </Button>
        </div>
      ) : duel && ['ready_check', 'countdown', 'playing'].includes(duel.status) ? (
        <div className="flex min-h-[64vh] flex-col items-center justify-center text-center">
          <div className="flex items-center gap-4">
            <UserAvatar currentUser name={myName} size="lg" active />
            <span className="text-2xl">⚔️</span>
            <UserAvatar name={opponentName} size="lg" active />
          </div>
          <h1 className="mt-6 font-display text-xl font-extrabold text-mist-100">
            {myName} <span className="text-mist-600">vs</span> {opponentName}
          </h1>
          <p className="mt-2 text-sm text-emerald-300">
            {t('duel.openingGame')}
          </p>
        </div>
      ) : duel && (duel.status === 'cancelled' || duel.status === 'expired') ? (
        <Card className="text-center">
          <div className="text-4xl">⌛</div>
          <p className="mt-4 font-display text-xl font-extrabold text-mist-100">
            {duel.status === 'expired'
              ? t('duel.expired')
              : t('duel.cancelled')}
          </p>
          <Button className="mt-6 w-full" onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </Card>
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-16 w-16 animate-pulse rounded-3xl bg-violet-500/20" />
        </div>
      )}
    </Screen>
  );
}
