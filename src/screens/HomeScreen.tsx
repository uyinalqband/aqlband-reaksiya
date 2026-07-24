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
import { UserAvatar } from '@/components/profile/UserAvatar';
import { checkersMusic } from '@/lib/checkersMusic';
import type { CheckersRatingProfile } from '@/types/checkersPlatform';
import type { ProgressionSnapshot } from '@/types/progression';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useTelegramUser();
  const account = useOnlineStore((state) => state.account);
  const [profile, setProfile] = useState<CheckersRatingProfile | null>(null);
  const [progression, setProgression] = useState<ProgressionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ratingData, progressionData] = await Promise.all([
        getCheckersProfile(),
        getProgression(),
      ]);
      setProfile(ratingData);
      setProgression(progressionData);
    } catch {
      // The cards keep safe local defaults while the verified account starts.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const rating = profile?.rating ?? 1200;
  const league = getCheckersLeague(rating);
  const leagueProgress = ratingProgress(rating);
  const level = getLevelProgress(progression?.totalXp ?? 0);
  const miniGames = useMemo(
    () => GAMES.filter((game) => game.id !== 'checkers'),
    [],
  );

  const openCheckers = (mode: 'rated' | 'friendly') => {
    checkersMusic.unlock();
    navigate('/games/checkers', { state: { startMode: mode } });
  };

  return (
    <Screen className="pb-28">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            {t('v2.brandTagline')}
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-mist-100">
            {account?.displayName ?? user?.firstName ?? 'AqlBand'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="rounded-2xl active:scale-95"
          aria-label={t('nav.profile')}
        >
          <UserAvatar
            currentUser
            name={account?.displayName ?? user?.firstName ?? 'AqlBand'}
            size="lg"
          />
        </button>
      </header>

      <section className="premium-border relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#172947] via-[#101B2A] to-[#08101A] p-5 shadow-glow">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 left-10 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-4 top-5 grid rotate-6 grid-cols-4 opacity-[0.11]">
          {Array.from({ length: 16 }, (_, index) => (
            <span
              key={index}
              className={`h-8 w-8 ${
                (Math.floor(index / 4) + index) % 2 === 0
                  ? 'bg-white'
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
                {t('v2.mainGame')}
              </p>
              <h2 className="mt-1 font-display text-3xl font-extrabold">
                ⚪⚫ {t('games.checkers.title')}
              </h2>
              <p className="mt-2 max-w-[17rem] text-sm leading-6 text-mist-400">
                {t('v2.checkersHeroText')}
              </p>
            </div>
            <span className="rounded-2xl border border-gold-300/25 bg-gold-500/10 px-3 py-2 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-mist-500">
                LEVEL
              </span>
              <span className="font-mono text-xl font-extrabold text-gold-300">
                {level.level}
              </span>
            </span>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto] items-end gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mist-500">
                🏆 {t('v2.overallRating')}
              </p>
              <p className="mt-1 font-mono text-4xl font-extrabold tabular-nums text-mist-100">
                {loading ? '····' : rating}
              </p>
              <p className="mt-1 text-sm font-bold text-gold-300">
                {league.emoji} {league.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/leaderboard')}
              className="rounded-2xl border border-mist-400/15 bg-white/5 px-4 py-3 text-sm font-bold text-mist-200 active:scale-95"
            >
              #{profile?.rank ?? '—'} ↗
            </button>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-emerald-400 to-gold-400"
              style={{ width: `${leagueProgress.percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-mist-600">
            <span>{league.name}</span>
            <span>
              {leagueProgress.next
                ? `${leagueProgress.remaining} ${t('v2.ratingToNext')}`
                : t('v2.topLeague')}
            </span>
          </div>

          {profile?.activeDuelId && profile.activeRole ? (
            <button
              type="button"
              onClick={() =>
                navigate('/duel', {
                  state: {
                    duelId: profile.activeDuelId,
                    role: profile.activeRole,
                  },
                })
              }
              className="mt-5 flex w-full items-center justify-between rounded-2xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-bold text-emerald-300">
                  {t('v2.activeMatch')}
                </span>
                <span className="block text-xs text-mist-400">
                  {t('v2.returnToMatch')}
                </span>
              </span>
              <span className="text-2xl">→</span>
            </button>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => openCheckers('rated')}
              className="rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-4 text-sm font-extrabold text-white shadow-glow active:scale-[0.98]"
            >
              ⚔️ {t('v2.findOpponent')}
            </button>
            <button
              type="button"
              onClick={() => openCheckers('friendly')}
              className="rounded-2xl border border-mist-300/15 bg-white/5 px-4 py-4 text-sm font-extrabold text-mist-100 active:scale-[0.98]"
            >
              👥 {t('v2.friendMatch')}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="glass-panel rounded-2xl p-4 text-left active:scale-[0.98]"
        >
          <span className="text-2xl">📜</span>
          <p className="mt-2 font-display text-sm font-bold">
            {t('v2.checkersHistory')}
          </p>
          <p className="mt-1 text-xs text-mist-500">
            {profile?.games ?? 0} {t('v2.matches')}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="glass-panel rounded-2xl p-4 text-left active:scale-[0.98]"
        >
          <span className="text-2xl">⚡</span>
          <p className="mt-2 font-display text-sm font-bold">
            LEVEL {level.level}
          </p>
          <p className="mt-1 text-xs text-mist-500">
            {(progression?.totalXp ?? 0).toLocaleString()} XP
          </p>
        </button>
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
              {t('v2.trainingZone')}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold">
              {t('v2.miniGames')}
            </h2>
          </div>
          <span className="text-xs text-mist-600">
            {miniGames.length} {t('v2.games')}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {miniGames.map((game, index) => (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => navigate(game.route)}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.018, 0.18) }}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left shadow-card active:scale-[0.985] ${
                game.category === 'speed'
                  ? 'border-amber-300/15 bg-gradient-to-r from-amber-500/10 to-ink-800/85'
                  : game.category === 'memory'
                    ? 'border-violet-300/15 bg-gradient-to-r from-violet-500/10 to-ink-800/85'
                    : game.category === 'attention'
                      ? 'border-cyan-300/15 bg-gradient-to-r from-cyan-500/10 to-ink-800/85'
                      : 'border-emerald-300/15 bg-gradient-to-r from-emerald-500/10 to-ink-800/85'
              }`}
            >
              <span className="pointer-events-none absolute -right-7 -top-8 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-ink-900/55 text-2xl shadow-inner">
                {game.emoji}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] font-extrabold text-mist-100">
                  {t(game.titleKey)}
                </span>
                <span className="mt-1 inline-flex rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-mist-500">
                  {game.id === 'tic-tac-toe'
                    ? t('v2.friendMiniGame')
                    : t('v2.maxChallenge')}
                </span>
              </span>
              <span className="relative text-xl text-mist-600 transition-transform group-active:translate-x-1">›</span>
            </motion.button>
          ))}
        </div>
      </section>
    </Screen>
  );
}
