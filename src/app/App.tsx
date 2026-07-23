import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { DuelScreen } from '@/screens/DuelScreen';
import { BottomNav } from '@/components/layout/BottomNav';

import { initTelegramApp, getTelegramLanguageCode, getStartParam } from '@/lib/telegram';
import { normalizeLanguage } from '@/i18n';
import { useGameHistoryStore } from '@/store/gameHistoryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOnlineStore } from '@/store/onlineStore';
import { checkpoint } from '@/lib/debug';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useEnsureUser } from '@/hooks/useEnsureUser';

import { ReactionScreen } from '@/screens/games/ReactionScreen';
import { EmojiFindScreen } from '@/screens/games/EmojiFindScreen';
import { NumberMemoryScreen } from '@/screens/games/NumberMemoryScreen';
import { StroopTestScreen } from '@/screens/games/StroopTestScreen';

const TAB_ROOT_PATHS = new Set(['/', '/leaderboard', '/profile', '/settings']);

function DuelDeepLinkRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const raw = getStartParam();
    if (raw?.startsWith('duel_')) {
      const duelId = raw.slice('duel_'.length);
      if (duelId) {
        navigate('/duel', { replace: true, state: { duelId, role: 'guest' } });
      }
    }
    // The launch parameter is intentionally consumed only once at boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const isTabRoot = TAB_ROOT_PATHS.has(location.pathname);

  return (
    <>
      <div style={{ paddingBottom: isTabRoot ? 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' : 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/games/reaction" element={<ReactionScreen />} />
            <Route path="/play" element={<Navigate to="/games/reaction" replace />} />
            <Route path="/games/emoji" element={<EmojiFindScreen />} />
            <Route path="/games/number-memory" element={<NumberMemoryScreen />} />
            <Route path="/games/stroop" element={<StroopTestScreen />} />
            <Route path="/result" element={<Navigate to="/games/reaction" replace />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/duel" element={<DuelScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
      {isTabRoot && <BottomNav />}
    </>
  );
}

function BootScreen() {
  return (
    <div className="flex h-full min-h-screen w-full flex-col items-center justify-center gap-3 bg-ink-900">
      <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-b from-violet-500 to-violet-600 shadow-glow" />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const hydrateHistory = useGameHistoryStore((state) => state.hydrate);
  const hydrateSettings = useSettingsStore((state) => state.hydrate);
  const hydrateRank = useOnlineStore((state) => state.hydrateLastKnownRank);
  const telegramUser = useTelegramUser();
  useEnsureUser(ready ? telegramUser : null);

  useEffect(() => {
    checkpoint('app-effect-start');
    initTelegramApp();
    checkpoint('telegram-init-done');

    const detectedLanguage = normalizeLanguage(getTelegramLanguageCode());
    const bootTimeout = window.setTimeout(() => {
      checkpoint('boot-failsafe-timeout-fired');
      setReady(true);
    }, 4000);

    checkpoint('hydration-start');
    void Promise.all([hydrateHistory(), hydrateSettings(detectedLanguage), hydrateRank()]).finally(() => {
      checkpoint('hydration-done');
      window.clearTimeout(bootTimeout);
      setReady(true);
    });

    return () => window.clearTimeout(bootTimeout);
  }, [hydrateHistory, hydrateSettings, hydrateRank]);

  if (!ready) return <BootScreen />;

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-ink-900 text-mist-100">
        <DuelDeepLinkRedirect />
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}
