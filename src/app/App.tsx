import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { HomeScreen } from '@/screens/HomeScreen';
import { PlayScreen } from '@/screens/PlayScreen';
import { ResultScreen } from '@/screens/ResultScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

import { initTelegramApp, getTelegramLanguageCode } from '@/lib/telegram';
import { normalizeLanguage } from '@/i18n';
import { useStatsStore } from '@/store/statsStore';
import { useSettingsStore } from '@/store/settingsStore';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/play" element={<PlayScreen />} />
        <Route path="/result" element={<ResultScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
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
  const hydrateStats = useStatsStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    initTelegramApp();

    const detectedLanguage = normalizeLanguage(getTelegramLanguageCode());

    // Safety net: hydration talks to Telegram CloudStorage, which on some
    // client versions never invokes its callback. storage.ts already races
    // each call against its own timeout, but this second, coarser timeout
    // guarantees the app becomes interactive even if something upstream
    // still hangs unexpectedly.
    const bootTimeout = window.setTimeout(() => setReady(true), 4000);

    void Promise.all([hydrateStats(), hydrateSettings(detectedLanguage)]).finally(() => {
      window.clearTimeout(bootTimeout);
      setReady(true);
    });

    return () => window.clearTimeout(bootTimeout);
  }, [hydrateStats, hydrateSettings]);

  if (!ready) return <BootScreen />;

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-ink-900 text-mist-100">
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}
