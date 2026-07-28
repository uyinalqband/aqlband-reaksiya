import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { EngagementHub } from '@/types/engagement';
import { sfx } from '@/lib/sound';
import { haptics } from '@/lib/telegram';
import { useTranslation } from 'react-i18next';

export function DailyQuestCard({
  hub,
  busy,
  onClaim,
}: {
  hub: EngagementHub;
  busy: boolean;
  onClaim: () => Promise<number>;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [ceremony, setCeremony] = useState<
    { phase: 'opening' | 'reward'; xp: number } | null
  >(null);
  const closeTimerRef = useRef<number | null>(null);
  const ready = hub.daily.completed === hub.daily.total && !hub.daily.chestClaimed;

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  const openChest = async () => {
    if (!ready || busy || ceremony) return;
    sfx.unlock();
    haptics.impact('medium');
    setCeremony({ phase: 'opening', xp: hub.daily.chestXp });
    try {
      const [awardedXp] = await Promise.all([
        onClaim(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 900);
        }),
      ]);
      setCeremony({ phase: 'reward', xp: awardedXp });
      sfx.success();
      haptics.success();
      closeTimerRef.current = window.setTimeout(() => {
        setCeremony(null);
        closeTimerRef.current = null;
      }, 3_200);
    } catch {
      setCeremony(null);
      sfx.timeout();
      haptics.error();
    }
  };

  const closeCeremony = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setCeremony(null);
  };

  return (
    <>
    <section className="mt-5 rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-500/12 to-ink-800/90 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">{t('dailyGoals.title')}</p>
          <h2 className="mt-1 font-display text-lg font-extrabold">{t('dailyGoals.completed', { done: hub.daily.completed, total: hub.daily.total })}</h2>
        </div>
        <span className="rounded-2xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-200">
          🔥 {t('dailyGoals.days', { count: hub.streak.current })}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {hub.daily.tasks.map((task) => {
          const done = task.progress >= task.target;
          return (
            <button key={task.id} type="button" onClick={() => !done && navigate(task.route)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-black/15 p-3 text-left active:scale-[.99]">
              <span className="text-xl">{done ? '✅' : task.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-extrabold text-mist-100">{t(`dailyGoals.tasks.${task.id}.title`, { defaultValue: task.title })}</span>
                <span className="block truncate text-[10px] text-mist-500">{t(`dailyGoals.tasks.${task.id}.description`, { defaultValue: task.description })} · +{task.rewardXp} XP</span>
              </span>
              <span className="font-mono text-[10px] font-black text-mist-400">{task.progress}/{task.target}</span>
            </button>
          );
        })}
      </div>
      <button type="button" disabled={!ready || busy} onClick={() => void openChest()}
        className={`mt-3 min-h-12 w-full rounded-2xl text-sm font-black transition ${
          ready ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#241204] shadow-glow active:scale-[.98]'
            : 'border border-white/10 bg-white/5 text-mist-500'
        } disabled:cursor-default`}>
        {hub.daily.chestClaimed ? t('dailyGoals.chestClaimed') : ready ? t('dailyGoals.openChest', { xp: hub.daily.chestXp }) : t('dailyGoals.chestLocked')}
      </button>
      <button type="button" onClick={() => navigate('/achievements')}
        className="mt-2 w-full py-1 text-xs font-bold text-violet-300">{t('dailyGoals.allAchievements')}</button>
    </section>

    <AnimatePresence>
      {ceremony ? (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-[#03070d]/90 px-5 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={t('dailyGoals.rewardLabel')}
        >
          <motion.div
            className="relative flex min-h-[26rem] w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-amber-300/25 bg-gradient-to-b from-[#172238] via-[#101826] to-[#080d15] px-5 py-8 text-center shadow-[0_35px_100px_-30px_rgba(245,158,11,.55)]"
            initial={{ scale: 0.86, y: 28 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <motion.div
              className="pointer-events-none absolute inset-[-35%] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.24),transparent_58%)]"
              animate={{
                scale: ceremony.phase === 'reward' ? [0.8, 1.15, 1] : [0.76, 0.9, 0.76],
                opacity: ceremony.phase === 'reward' ? 1 : 0.55,
              }}
              transition={{ duration: 1.15, repeat: ceremony.phase === 'opening' ? Infinity : 0 }}
            />

            {ceremony.phase === 'reward'
              ? Array.from({ length: 12 }, (_, index) => (
                  <motion.span
                    key={index}
                    className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,.9)]"
                    initial={{ x: 0, y: 15, scale: 0, opacity: 0 }}
                    animate={{
                      x: Math.cos((index / 12) * Math.PI * 2) * (80 + (index % 3) * 20),
                      y: Math.sin((index / 12) * Math.PI * 2) * (72 + (index % 2) * 22) - 35,
                      scale: [0, 1.25, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.35, delay: index * 0.035 }}
                  />
                ))
              : null}

            <div className="relative h-44 w-56" aria-hidden="true">
              <motion.div
                className="absolute bottom-3 left-5 right-5 h-[5.6rem] rounded-b-[1.6rem] rounded-t-lg border-[5px] border-[#6f3d12] bg-gradient-to-b from-[#f5a623] to-[#b95c0b] shadow-[inset_0_10px_0_rgba(255,255,255,.16),0_25px_45px_-18px_rgba(245,158,11,.9)]"
                animate={ceremony.phase === 'opening' ? { x: [0, -3, 3, -2, 2, 0] } : { scale: [1, 1.04, 1] }}
                transition={ceremony.phase === 'opening'
                  ? { duration: 0.55, repeat: Infinity }
                  : { duration: 0.45 }}
              >
                <span className="absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 bg-gradient-to-r from-[#f7c948] via-[#ffe08a] to-[#d89219]" />
                <span className="absolute left-1/2 top-6 h-10 w-10 -translate-x-1/2 rounded-xl border-4 border-[#75420f] bg-[#ffd45e] shadow-lg">
                  <span className="absolute left-1/2 top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6b390c]" />
                </span>
              </motion.div>

              <motion.div
                className="absolute bottom-[5.9rem] left-4 right-4 h-[4.2rem] origin-bottom rounded-t-[2.2rem] rounded-b-lg border-[5px] border-[#6f3d12] bg-gradient-to-b from-[#ffca4b] to-[#d77a12] shadow-[inset_0_10px_0_rgba(255,255,255,.18)]"
                initial={{ rotateX: 0, y: 0 }}
                animate={ceremony.phase === 'reward'
                  ? { rotateX: -72, y: -18 }
                  : { rotateX: [0, -5, 0] }}
                transition={ceremony.phase === 'reward'
                  ? { duration: 0.62, type: 'spring', stiffness: 180 }
                  : { duration: 0.65, repeat: Infinity }}
                style={{ transformPerspective: 500 }}
              >
                <span className="absolute bottom-2 left-1/2 h-5 w-9 -translate-x-1/2 rounded-lg border-4 border-[#75420f] bg-[#ffe07a]" />
              </motion.div>

              <AnimatePresence>
                {ceremony.phase === 'reward' ? (
                  <motion.div
                    className="absolute left-1/2 top-2 z-20 -translate-x-1/2 whitespace-nowrap"
                    initial={{ y: 95, scale: 0.25, opacity: 0 }}
                    animate={{ y: -12, scale: 1, opacity: 1 }}
                    transition={{ delay: 0.28, type: 'spring', stiffness: 230, damping: 16 }}
                  >
                    <div className="rounded-2xl border border-amber-200/60 bg-amber-300 px-5 py-2 font-mono text-2xl font-black text-[#3b2005] shadow-[0_0_40px_rgba(251,191,36,.85)]">
                      +{ceremony.xp} XP
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <motion.h2
              className="relative mt-3 font-display text-2xl font-extrabold text-mist-100"
              key={ceremony.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {ceremony.phase === 'opening' ? t('dailyGoals.opening') : t('dailyGoals.rewardReceived')}
            </motion.h2>
            <p className="relative mt-2 text-sm text-mist-500">
              {ceremony.phase === 'opening'
                ? t('dailyGoals.preparing')
                : t('dailyGoals.xpAdded', { xp: ceremony.xp })}
            </p>

            {ceremony.phase === 'reward' ? (
              <motion.button
                type="button"
                onClick={closeCeremony}
                className="relative mt-6 min-h-12 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 font-black text-[#2b1603] shadow-glow active:scale-[.98]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                {t('dailyGoals.continue')}
              </motion.button>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    </>
  );
}
