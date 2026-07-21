import { GameCard } from '@/components/games/GameCard';
import { useGameStatsStore, getBestValue } from '@/store/gameStatsStore';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { PlayIcon, BoltIcon, HistoryIcon, ShareIcon } from '@/components/ui/icons';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useStatsStore, computeStatsSnapshot } from '@/store/statsStore';
import { useChallengeStore } from '@/store/challengeStore';
import { useOnlineStore } from '@/store/onlineStore';
import { getUserRank } from '@/services/leaderboardService';
import { createDuel } from '@/services/duelService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { shareChallenge } from '@/lib/telegram';
import { BOT_USERNAME } from '@/lib/config';
import { formatMs } from '@/features/game/logic';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useTelegramUser();
  const attempts = useStatsStore((s) => s.attempts);
  const snapshot = useMemo(() => computeStatsSnapshot(attempts), [attempts]);
  const challenge = useChallengeStore((s) => s.challenge);
  const telegramId = useOnlineStore((s) => s.telegramId);

  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || telegramId === null) return;
    let cancelled = false;
    setRankLoading(true);
    getUserRank(telegramId)
      .then((rank) => {
        if (!cancelled) setWorldRank(rank);
      })
      .catch(() => {
        if (!cancelled) setWorldRank(null);
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [telegramId, attempts.length]); // refetch after a new attempt is played (attempts.length changes)

  const gameAttempts = useGameStatsStore((s) => s.attemptsByGame);
const hydrateGameStats = useGameStatsStore((s) => s.hydrate);

useEffect(() => {
  void hydrateGameStats();
}, [hydrateGameStats]);

const emojiBest = getBestValue(gameAttempts['emoji-find'] ?? [], true);
const memoryBest = getBestValue(gameAttempts['number-memory'] ?? [], false);
const stroopBest = getBestValue(gameAttempts['stroop-test'] ?? [], false);
  
  const hasStats = snapshot.totalAttempts > 0;

  const handlePlayWithFriend = async () => {
    if (!user || !isSupabaseConfigured || creatingDuel) return;
    setCreatingDuel(true);
    setDuelError(null);
    try {
      const duel = await createDuel(user.id, user.firstName);
      shareChallenge(BOT_USERNAME, `duel_${duel.id}`, "Reaksiya bo'yicha musobaqalashamizmi? Havolani bosing!");
      navigate('/duel', { state: { duelId: duel.id, role: 'host' } });
    } catch (error) {
      setDuelError(error instanceof Error ? error.message : "Nimadir xato ketdi.");
    } finally {
      setCreatingDuel(false);
    }
  };

  return (
    <Screen>
      <div>
        <p className="text-sm text-mist-500">{t('app.tagline')}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-mist-100">
          {user ? t('home.greeting', { name: user.firstName }) : t('home.greetingGuest')}
        </h1>
      </div>

      {challenge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-5 rounded-2xl border border-gold-500/30 bg-gold-500/10 px-4 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-400">
              <BoltIcon width={18} height={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mist-100">{challenge.n}</p>
              <p className="font-mono text-xs text-gold-400">{formatMs(challenge.t)} {t('common.ms')}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/play')}>
              {t('compare.challengeCta')}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="mt-8 flex flex-col items-center">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative flex h-44 w-44 items-center justify-center rounded-full border-2 border-violet-500/40 bg-gradient-to-b from-ink-700 to-ink-800 shadow-glow"
        >
          <BoltIcon width={56} height={56} className="text-gold-400" />
        </motion.div>

        <p className="mt-6 max-w-xs text-center text-sm leading-relaxed text-mist-500">{t('home.subtitle')}</p>

        <Button className="mt-7 w-full max-w-xs" size="lg" icon={<PlayIcon width={20} height={20} />} onClick={() => navigate('/play')}>
          {t('home.playCta')}
        </Button>

        {isSupabaseConfigured && user && (
          <Button
            className="mt-3 w-full max-w-xs"
            size="md"
            variant="secondary"
            icon={<ShareIcon width={16} height={16} />}
            disabled={creatingDuel}
            onClick={() => void handlePlayWithFriend()}
          >
            {creatingDuel ? 'Yaratilmoqda...' : "Do'st bilan"}
          </Button>
        )}
        {duelError && <p className="mt-2 text-center text-xs text-signal-early">{duelError}</p>}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <StatCard label={t('home.statBest')} value={snapshot.best !== null ? formatMs(snapshot.best) : '—'} accent />
        <StatCard label={t('home.statAverage')} value={snapshot.average !== null ? formatMs(snapshot.average) : '—'} />
        <StatCard label={t('home.statAttempts')} value={String(snapshot.totalAttempts)} />
        <StatCard
          label={t('home.statWorldRank')}
          value={
            !isSupabaseConfigured
              ? '—'
              : rankLoading
                ? '…'
                : worldRank !== null
                  ? `#${worldRank}`
                  : '—'
          }
          accent
        />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-mist-300">
          <HistoryIcon width={16} height={16} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('home.historyTitle')}</h2>
        </div>
        {hasStats ? (
          <Card padded={false} className="divide-y divide-ink-600/50">
            {attempts.slice(0, 5).map((attempt) => (
              <div key={attempt.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-mist-500">
                  {new Date(attempt.playedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-mono text-sm font-semibold text-mist-100">
                  {formatMs(attempt.timeMs)} <span className="text-mist-500">{t('common.ms')}</span>
                </span>
              </div>
            ))}
          </Card>
        ) : (
          <p className="rounded-xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            {t('home.noStatsYet')}
          </p>
        )}
      </div>


      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mist-300">
          Boshqa o'yinlar
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <GameCard
            emoji="🍎"
            title="Emojini top"
            bestLabel="Eng yaxshi"
            bestValue={emojiBest !== null ? `${Math.round(emojiBest)} ms` : '—'}
            accentBorderClassName="border-l-green-500"
            onClick={() => navigate('/games/emoji')}
          />
          <GameCard
            emoji="🧠"
            title="Sonni eslab qol"
            bestLabel="Eng yaxshi"
            bestValue={memoryBest !== null ? `${memoryBest}/5` : '—'}
            accentBorderClassName="border-l-blue-500"
            onClick={() => navigate('/games/number-memory')}
          />
          <GameCard
            emoji="🌈"
            title="Rang testi"
            bestLabel="Eng yaxshi"
            bestValue={stroopBest !== null ? `${stroopBest} ball` : '—'}
            accentBorderClassName="border-l-pink-500"
            onClick={() => navigate('/games/stroop')}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mist-300">{t('home.howItWorks')}</h2>
        <div className="space-y-2.5">
          <HowStep n={1} title={t('home.step1Title')} desc={t('home.step1Desc')} />
          <HowStep n={2} title={t('home.step2Title')} desc={t('home.step2Desc')} />
          <HowStep n={3} title={t('home.step3Title')} desc={t('home.step3Desc')} />
        </div>
      </div>
    </Screen>
  );
}

function HowStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-600/50 bg-ink-800/50 px-4 py-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 font-mono text-xs font-semibold text-violet-300">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-mist-100">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-mist-500">{desc}</p>
      </div>
    </div>
  );
}
