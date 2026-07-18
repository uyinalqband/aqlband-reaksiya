import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { CompareCard } from '@/components/game/CompareCard';
import { PlayIcon, RotateIcon, ShareIcon, TrophyIcon } from '@/components/ui/icons';
import { estimatePercentile, formatMs, getResultTier } from '@/features/game/logic';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramUser } from '@/hooks/useTelegramUser';
import { useChallengeStore, encodeStartParam } from '@/store/challengeStore';
import { shareChallenge } from '@/lib/telegram';
import { BOT_USERNAME } from '@/lib/config';

interface ResultLocationState {
  timeMs: number;
  isNewBest: boolean;
}

export function ResultScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useTelegramUser();
  const consumeChallenge = useChallengeStore((s) => s.consume);

  const state = location.state as ResultLocationState | null;
  const [challenge] = useState(() => consumeChallenge());

  useEffect(() => {
    if (!state) navigate('/', { replace: true });
  }, [state, navigate]);

  const goHome = () => navigate('/', { replace: true });
  useTelegramBackButton(goHome);

  const tier = useMemo(() => (state ? getResultTier(state.timeMs) : 'casual'), [state]);
  const percentile = useMemo(() => (state ? estimatePercentile(state.timeMs) : 0), [state]);

  if (!state) return null;

  const displayName = user?.firstName ?? 'AqlBand';

  const handleShare = () => {
    const startParam = encodeStartParam({ t: state.timeMs, n: displayName, u: user?.id });
    const text = t('share.message', { time: formatMs(state.timeMs) });
    shareChallenge(BOT_USERNAME, startParam, text);
  };

  return (
    <div
      className="flex min-h-full w-full flex-col px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <TopBar title={t('result.title')} onBack={goHome} />

      <div className="flex flex-1 flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="mt-2 flex flex-col items-center"
        >
          {state.isNewBest && (
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-400">
              <TrophyIcon width={14} height={14} />
              {t('result.newBest')}
            </span>
          )}

          <div className="font-mono text-6xl font-bold tabular-nums text-mist-100">{formatMs(state.timeMs)}</div>
          <div className="mt-1 text-sm font-medium uppercase tracking-widest text-mist-500">{t('common.ms')}</div>

          <div className="mt-5 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
            <span className="font-display text-sm font-semibold text-violet-300">{t(`result.tier.${tier}`)}</span>
          </div>
          <p className="mt-2 max-w-[16rem] text-center text-xs text-mist-500">{t(`result.tierDesc.${tier}`)}</p>
          <p className="mt-3 text-xs text-mist-500">{t('result.percentileText', { percent: percentile })}</p>
        </motion.div>

        {challenge && (
          <div className="mt-6 w-full">
            <CompareCard yourTimeMs={state.timeMs} opponentTimeMs={challenge.t} opponentName={challenge.n} />
          </div>
        )}

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button icon={<ShareIcon width={18} height={18} />} onClick={handleShare}>
            {challenge ? t('compare.challengeCta') : t('result.shareCta')}
          </Button>
          <Button
            variant="secondary"
            icon={<RotateIcon width={18} height={18} />}
            onClick={() => navigate('/play', { replace: true })}
          >
            {t('result.playAgainCta')}
          </Button>
          <Button variant="ghost" icon={<PlayIcon width={16} height={16} />} onClick={goHome}>
            {t('result.homeCta')}
          </Button>
        </div>
      </div>
    </div>
  );
}
