import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { GAMES } from '@/features/games/catalog';
import { getCheckersLeague, ratingProgress } from '@/features/checkers/rating';
import { getLevelProgress } from '@/features/progression/levels';
import { getCheckersProfile } from '@/services/checkersPlatformService';
import { getProgression } from '@/services/progressionService';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useOnlineStore } from '@/store/onlineStore';
import { useNotificationStore } from '@/store/notificationStore';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { checkersMusic } from '@/lib/checkersMusic';
import type { CheckersRatingProfile } from '@/types/checkersPlatform';
import type { ProgressionSnapshot } from '@/types/progression';
import type { EngagementHub } from '@/types/engagement';
import { claimDailyChest, getEngagementHub } from '@/services/engagementService';
import { DailyQuestCard } from '@/components/progression/DailyQuestCard';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useTelegramUser();
  const account = useOnlineStore((state) => state.account);
  const unread = useNotificationStore((state) => state.items.filter((item) => !item.read).length);
  const [profile, setProfile] = useState<CheckersRatingProfile | null>(null);
  const [progression, setProgression] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementHub | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ratingResult, progressionResult, engagementResult] = await Promise.allSettled([
        getCheckersProfile(),
        getProgression(),
        getEngagementHub(),
      ]);
      if (ratingResult.status === 'fulfilled') setProfile(ratingResult.value);
      if (progressionResult.status === 'fulfilled') setProgression(progressionResult.value);
      if (engagementResult.status === 'fulfilled') setEngagement(engagementResult.value);
    } catch {
      // Safe defaults keep the home screen usable during account startup.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Local Mini Game completion sync is intentionally delayed by 600 ms.
    // Refresh once after it reaches the server so task progress feels instant.
    const timer = window.setTimeout(() => {
      void Promise.allSettled([getEngagementHub(), getProgression()]).then(
        ([hubResult, xpResult]) => {
          if (hubResult.status === 'fulfilled') setEngagement(hubResult.value);
          if (xpResult.status === 'fulfilled') setProgression(xpResult.value);
        },
      );
    }, 1_100);
    return () => window.clearTimeout(timer);
  }, [load, location.key]);

  useEffect(() => {
    if (!engagement || new URLSearchParams(location.search).get('section') !== 'daily') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('daily-goals')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [engagement, location.search]);

  const rating = profile?.rating ?? 1200;
  const league = getCheckersLeague(rating);
  const leagueProgress = ratingProgress(rating);
  const level = getLevelProgress(progression?.totalXp ?? 0);
  const quickGames = useMemo(
    () => GAMES.filter((game) => ['reaction', 'emoji-find', 'number-memory', 'sudoku'].includes(game.id)),
    [],
  );

  const openCheckers = (mode: 'rated' | 'friendly') => {
    checkersMusic.unlock();
    navigate('/games/checkers', { state: { startMode: mode } });
  };

  const claimChest = async (): Promise<number> => {
    if (claiming) return 0;
    setClaiming(true);
    try {
      const result = await claimDailyChest();
      setEngagement(result.hub);
      setProgression(await getProgression());
      return result.awardedXp;
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Screen className="pb-28">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex min-w-0 items-center gap-3 rounded-2xl text-left active:scale-[.98]"
        >
          <UserAvatar
            currentUser
            name={account?.displayName ?? user?.firstName ?? 'AI'}
            size="md"
          />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-mist-600">
              {t('home.welcomeBack')}
            </span>
            <span className="block truncate font-display text-xl font-extrabold text-mist-100">
              {account?.displayName ?? user?.firstName ?? 'AI'}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-gold-300/20 bg-gold-500/10 px-3 py-2 text-center">
            <span className="block text-[8px] font-black uppercase tracking-wider text-mist-600">LVL</span>
            <span className="font-mono text-base font-black text-gold-300">{level.level}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-ink-800/80 text-xl active:scale-95"
            aria-label={t('nav.notifications')}
          >
            🔔
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#07101A] bg-red-500 px-1 text-[9px] font-black text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <section className="premium-border relative mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#1A3052] via-[#101C2D] to-[#07101A] p-5 shadow-glow">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">
                {t('gameHub.mainGame')}
              </p>
              <h1 className="mt-1 font-display text-3xl font-black">⚪⚫ {t('games.checkers.title')}</h1>
            </div>
            <button
              type="button"
              onClick={() => navigate('/leaderboard')}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right active:scale-95"
            >
              <span className="block text-[9px] uppercase tracking-wider text-mist-600">{t('nav.leaderboard')}</span>
              <span className="font-mono text-base font-black text-gold-300">#{profile?.rank ?? '—'} ↗</span>
            </button>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-600">{t('v2.overallRating')}</p>
              <p className="mt-1 font-mono text-4xl font-black tabular-nums text-mist-100">
                {loading ? '····' : rating}
              </p>
            </div>
            <p className="pb-1 text-sm font-extrabold text-gold-300">{league.emoji} {league.name}</p>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-emerald-400 to-gold-400"
              style={{ width: `${leagueProgress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-right text-[10px] text-mist-600">
            {leagueProgress.next
              ? `${leagueProgress.remaining} ${t('v2.ratingToNext')}`
              : t('v2.topLeague')}
          </p>

          <button
            type="button"
            onClick={() => openCheckers('rated')}
            className="mt-5 min-h-14 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-5 py-4 text-base font-black text-white shadow-glow active:scale-[.985]"
          >
            ⚔️ {t('v2.findOpponent')}
          </button>
          <button
            type="button"
            onClick={() => openCheckers('friendly')}
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-mist-200 active:scale-[.985]"
          >
            👥 {t('v2.friendMatch')}
          </button>
        </div>
      </section>

      {profile?.activeDuelId && profile.activeRole ? (
        <button
          type="button"
          onClick={() => navigate('/duel', { state: { duelId: profile.activeDuelId, role: profile.activeRole } })}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-3.5 text-left shadow-card active:scale-[.99]"
        >
          <span>
            <span className="block text-sm font-extrabold text-emerald-300">{t('v2.activeMatch')}</span>
            <span className="mt-0.5 block text-xs text-mist-400">{t('v2.returnToMatch')}</span>
          </span>
          <span className="text-2xl">→</span>
        </button>
      ) : null}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">
              {t('home.quickPlayEyebrow')}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold">{t('home.quickPlay')}</h2>
          </div>
          <button type="button" onClick={() => navigate('/games')} className="min-h-11 px-1 text-xs font-extrabold text-violet-300">
            {t('home.allGames')} →
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {quickGames.map((game, index) => (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => navigate(game.route)}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex min-h-24 items-center gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-ink-700/85 to-ink-900/90 p-3 text-left shadow-card active:scale-[.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/20 text-2xl">{game.emoji}</span>
              <span className="min-w-0">
                <span className="line-clamp-2 block font-display text-sm font-extrabold leading-5">{t(game.titleKey)}</span>
                <span className="mt-1 block text-[9px] font-black uppercase tracking-wider text-violet-300">+ XP</span>
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => navigate('/history')}
        className="mt-5 flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-ink-800/60 px-4 text-left active:scale-[.99]"
      >
        <span>
          <span className="block text-sm font-extrabold">📜 {t('v2.checkersHistory')}</span>
          <span className="mt-0.5 block text-xs text-mist-600">{profile?.games ?? 0} {t('v2.matches')}</span>
        </span>
        <span className="text-xl text-mist-600">›</span>
      </button>

      <div id="daily-goals" className="scroll-mt-4">
        {engagement ? (
          <DailyQuestCard hub={engagement} busy={claiming} onClaim={claimChest} />
        ) : null}
      </div>
    </Screen>
  );
}
