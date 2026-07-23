import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { GameHistoryList } from '@/components/game/GameHistoryList';
import { BoltIcon, ChevronRightIcon, HistoryIcon } from '@/components/ui/icons';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import {
  computeUnifiedMsStats,
  getBestDurationValue,
  useGameHistoryStore,
} from '@/store/gameHistoryStore';
import { useChallengeStore } from '@/store/challengeStore';
import { useOnlineStore } from '@/store/onlineStore';
import { getUserRank } from '@/services/leaderboardService';
import { getIncomingDuelInvites, respondDuelInvite } from '@/services/duelService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { formatMs } from '@/features/gameSession/metrics';
import {
  DIFFICULTY_LABELS,
  GAME_SETUP_COPY,
  selectedRoundsLabel,
} from '@/features/gameSession/config';
import { duelConfig, type IncomingDuelInvite } from '@/types/duel';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useTelegramUser();
  const attempts = useGameHistoryStore((state) => state.attempts);
  const unifiedSnapshot = useMemo(() => computeUnifiedMsStats(attempts), [attempts]);
  const challenge = useChallengeStore((state) => state.challenge);
  const telegramId = useOnlineStore((state) => state.telegramId);
  const appUserId = useOnlineStore((state) => state.appUserId);

  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [invite, setInvite] = useState<IncomingDuelInvite | null>(null);
  const [inviteBusy, setInviteBusy] = useState<'accept' | 'reject' | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

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
  }, [telegramId, attempts.length]);

  useEffect(() => {
    if (!isSupabaseConfigured || !appUserId) {
      setInvite(null);
      return;
    }

    let stopped = false;
    let running = false;

    const refresh = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const invites = await getIncomingDuelInvites();
        if (!stopped) setInvite(invites[0] ?? null);
      } catch {
        // A temporary network failure must not hide the rest of the home screen.
      } finally {
        running = false;
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_200);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [appUserId]);

  const reactionBest = getBestDurationValue(attempts, 'reaction');
  const emojiBest = getBestDurationValue(attempts, 'emoji-find');
  const memoryBest = getBestDurationValue(attempts, 'number-memory');
  const stroopBest = getBestDurationValue(attempts, 'stroop-test');

  const answerInvite = async (accept: boolean) => {
    if (!invite || inviteBusy) return;
    setInviteBusy(accept ? 'accept' : 'reject');
    setInviteError(null);
    try {
      const result = await respondDuelInvite(invite.duel.id, accept);
      if (accept) {
        navigate('/duel', {
          state: { duelId: result.id, role: 'guest' },
        });
      } else {
        setInvite(null);
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Chaqiruvga javob berib bo'lmadi.");
    } finally {
      setInviteBusy(null);
    }
  };

  return (
    <Screen>
      <div>
        <h1 className="font-display text-2xl font-bold text-mist-100">{user ? user.firstName : 'AqlBand'}</h1>
        <p className="mt-1 text-sm text-mist-500">Bugun nima o'ynaymiz?</p>
      </div>

      {invite && (
        <IncomingInviteCard
          invite={invite}
          busy={inviteBusy}
          error={inviteError}
          onAccept={() => void answerInvite(true)}
          onReject={() => void answerInvite(false)}
        />
      )}

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
            <Button size="sm" variant="secondary" onClick={() => navigate('/games/reaction')}>
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
          bestLabel={reactionBest !== null ? `${formatMs(reactionBest)} ms` : '—'}
          onClick={() => navigate('/games/reaction')}
        />
        <GameTile
          emoji="🍎"
          title="Emoji"
          description="Emojini toping"
          bestLabel={emojiBest !== null ? `${formatMs(emojiBest)} ms` : '—'}
          onClick={() => navigate('/games/emoji')}
        />
        <GameTile
          emoji="🧠"
          title="Memory"
          description="Sonni eslab qoling"
          bestLabel={memoryBest !== null ? `${formatMs(memoryBest)} ms` : '—'}
          onClick={() => navigate('/games/number-memory')}
        />
        <GameTile
          emoji="🌈"
          title="Stroop"
          description="Rangga qarab bosing"
          bestLabel={stroopBest !== null ? `${formatMs(stroopBest)} ms` : '—'}
          onClick={() => navigate('/games/stroop')}
        />
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2.5">
        <MiniStat
          label="Best"
          value={unifiedSnapshot.best !== null ? formatMs(unifiedSnapshot.best) : '—'}
          accent
        />
        <MiniStat
          label="O'rtacha"
          value={unifiedSnapshot.average !== null ? formatMs(unifiedSnapshot.average) : '—'}
        />
        <MiniStat label="O'yinlar" value={String(unifiedSnapshot.totalAttempts)} />
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
    </Screen>
  );
}

function IncomingInviteCard({
  invite,
  busy,
  error,
  onAccept,
  onReject,
}: {
  invite: IncomingDuelInvite;
  busy: 'accept' | 'reject' | null;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const config = duelConfig(invite.duel);
  const copy = GAME_SETUP_COPY[invite.duel.game_id];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl border border-violet-400/40 bg-violet-600/10 p-4 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-2xl">
          {copy.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-mist-100">
            {invite.duel.host_name} sizni o'yinga chaqirdi
          </p>
          <p className="mt-1 text-xs text-mist-500">
            {copy.title} · {selectedRoundsLabel(config.rounds)} · {DIFFICULTY_LABELS[config.difficulty]}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Button size="sm" disabled={Boolean(busy)} onClick={onAccept}>
          {busy === 'accept' ? 'Qabul qilinmoqda...' : 'Qabul qilish'}
        </Button>
        <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={onReject}>
          {busy === 'reject' ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
        </Button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-signal-early">{error}</p>}
    </motion.div>
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
