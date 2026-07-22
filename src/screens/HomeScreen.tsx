import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { GameHistoryList } from '@/components/game/GameHistoryList';
import { BoltIcon, ChevronRightIcon, HistoryIcon, ShareIcon } from '@/components/ui/icons';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import {
  computeReactionStats,
  getBestValue,
  getAttemptsForGame,
  useGameHistoryStore,
} from '@/store/gameHistoryStore';
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
  const attempts = useGameHistoryStore((state) => state.attempts);
  const reactionSnapshot = useMemo(() => computeReactionStats(attempts), [attempts]);
  const reactionAttemptCount = useMemo(() => getAttemptsForGame(attempts, 'reaction').length, [attempts]);
  const challenge = useChallengeStore((state) => state.challenge);
  const telegramId = useOnlineStore((state) => state.telegramId);

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
  }, [telegramId, reactionAttemptCount]);

  const emojiBest = getBestValue(attempts, 'emoji-find', true);
  const memoryBest = getBestValue(attempts, 'number-memory', false);
  const stroopBest = getBestValue(attempts, 'stroop-test', false);

  const handlePlayWithFriend = async () => {
    if (!user || !isSupabaseConfigured || creatingDuel) return;
    setCreatingDuel(true);
    setDuelError(null);
    try {
      const duel = await createDuel(user.id, user.firstName);
      shareChallenge(BOT_USERNAME, `duel_${duel.id}`, "Reaksiya bo'yicha musobaqalashamizmi? Havolani bosing!");
      navigate('/duel', { state: { duelId: duel.id, role: 'host' } });
    } catch (error) {
      setDuelError(error instanceof Error ? error.message : 'Nimadir xato ketdi.');
    } finally {
      setCreatingDuel(false);
    }
  };

  return (
    <Screen>
      <div>
        <h1 className="font-display text-2xl font-bold text-mist-100">{user ? user.firstName : 'AqlBand'}</h1>
        <p className="mt-1 text-sm text-mist-500">Bugun nima o'ynaymiz?</p>
      </div>

      {challenge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-5 rounded-2xl border border-gold-500/30 bg-gold-500/10 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-400">
              <BoltIcon width={16} height={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-mist-100">{challenge.n}</p>
              <p className="font-mono text-xs text-gold-400">
                {formatMs(challenge.t)} {t('common.ms')}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/play')}>
              {t('compare.challengeCta')}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <GameTile
          emoji="⚡"
          title="Reaksiya"
          description="Signalni kuting, tez bosing"
          bestLabel={reactionSnapshot.best !== null ? `${formatMs(reactionSnapshot.best)} ms` : '—'}
          onClick={() => navigate('/play')}
        />
        <GameTile
          emoji="🍎"
          title="Emoji"
          description="Emojini toping"
          bestLabel={emojiBest !== null ? `${Math.round(emojiBest)} ms` : '—'}
          onClick={() => navigate('/games/emoji')}
        />
        <GameTile
          emoji="🧠"
          title="Memory"
          description="Sonni eslab qoling"
          bestLabel={memoryBest !== null ? `${memoryBest}/5` : '—'}
          onClick={() => navigate('/games/number-memory')}
        />
        <GameTile
          emoji="🌈"
          title="Stroop"
          description="Rangga qarab bosing"
          bestLabel={stroopBest !== null ? `${stroopBest} ball` : '—'}
          onClick={() => navigate('/games/stroop')}
        />
      </div>

      {isSupabaseConfigured && user && (
        <div className="mt-3">
          <Button
            className="w-full"
            size="md"
            variant="secondary"
            icon={<ShareIcon width={16} height={16} />}
            disabled={creatingDuel}
            onClick={() => void handlePlayWithFriend()}
          >
            {creatingDuel ? 'Yaratilmoqda...' : "Do'st bilan o'ynash"}
          </Button>
          {duelError && <p className="mt-2 text-center text-xs text-signal-early">{duelError}</p>}
        </div>
      )}

      <div className="mt-6 grid grid-cols-4 gap-2.5">
        <MiniStat
          label="Best"
          value={reactionSnapshot.best !== null ? formatMs(reactionSnapshot.best) : '—'}
          accent
        />
        <MiniStat
          label="O'rtacha"
          value={reactionSnapshot.average !== null ? formatMs(reactionSnapshot.average) : '—'}
        />
        <MiniStat label="O'yinlar" value={String(attempts.length)} />
        <MiniStat
          label="Reyting"
          value={!isSupabaseConfigured ? '—' : rankLoading ? '…' : worldRank !== null ? `#${worldRank}` : '—'}
          accent
        />
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-center gap-2 text-mist-300">
          <HistoryIcon width={15} height={15} />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('home.historyTitle')}</h2>
        </div>
        {attempts.length > 0 ? (
          <GameHistoryList attempts={attempts} limit={5} />
        ) : (
          <p className="rounded-2xl border border-dashed border-ink-600 px-4 py-5 text-center text-sm text-mist-500">
            {t('home.noStatsYet')}
          </p>
        )}
      </div>

      <div className="mt-7">
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

function GameTile({
  emoji,
  title,
  description,
  bestLabel,
  onClick,
}: {
  emoji: string;
  title: string;
  description: string;
  bestLabel: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-ink-600/60 bg-ink-800/80 p-4 text-left"
    >
      <div className="flex w-full items-start justify-between">
        <span className="text-3xl leading-none">{emoji}</span>
        <ChevronRightIcon width={16} height={16} className="mt-1 text-mist-700" />
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-mist-100">{title}</p>
        <p className="mt-0.5 text-xs text-mist-500">{description}</p>
      </div>
      <p className="mt-0.5 font-mono text-xs font-semibold text-gold-400">{bestLabel}</p>
    </motion.button>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex h-[4.5rem] flex-col items-center justify-center rounded-xl border border-ink-600/60 bg-ink-800/80 px-1 text-center">
      <span className={`font-mono text-base font-bold tabular-nums ${accent ? 'text-gold-400' : 'text-mist-100'}`}>
        {value}
      </span>
      <span className="mt-1 text-[9px] font-medium uppercase tracking-wide text-mist-500">{label}</span>
    </div>
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
