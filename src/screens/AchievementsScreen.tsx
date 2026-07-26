import { useEffect, useMemo, useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';
import { getEngagementHub } from '@/services/engagementService';
import type { EngagementHub } from '@/types/engagement';

export function AchievementsScreen() {
  const [hub, setHub] = useState<EngagementHub | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getEngagementHub(controller.signal).then(setHub).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const unlocked = useMemo(() => hub?.achievements.filter((item) => item.unlocked).length ?? 0, [hub]);

  return (
    <Screen className="pb-28">
      <TopBar title="Yutuqlar" />
      <section className="rounded-3xl border border-violet-300/20 bg-gradient-to-br from-violet-500/15 to-ink-800/80 p-5">
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Kolleksiya</p>
        <div className="mt-2 flex items-end justify-between">
          <h1 className="font-display text-2xl font-black">{unlocked}/{hub?.achievements.length ?? 0} ochildi</h1>
          <span className="text-sm font-black text-orange-300">🔥 {hub?.streak.current ?? 0} kun</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-gold-400"
            style={{ width: `${hub ? unlocked / Math.max(1, hub.achievements.length) * 100 : 0}%` }} />
        </div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(hub?.achievements ?? []).map((item) => (
          <article key={item.id} className={`min-h-40 rounded-3xl border p-4 ${
            item.unlocked ? 'border-gold-300/25 bg-gold-500/10' : 'border-white/8 bg-ink-800/65 opacity-70'
          }`}>
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
              item.unlocked ? 'bg-gold-400/15' : 'bg-black/20 grayscale'
            }`}>{item.unlocked ? item.emoji : '🔒'}</span>
            <h2 className="mt-3 text-sm font-extrabold text-mist-100">{item.title}</h2>
            <p className="mt-1 text-[10px] leading-4 text-mist-500">{item.description}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-gold-400"
                style={{ width: `${Math.min(100, item.progress / Math.max(1, item.target) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[9px] font-mono text-mist-500">{item.progress}/{item.target}</p>
            <p className="mt-2 text-[10px] font-black text-gold-300">+{item.rewardXp} XP {item.claimed ? '· OLINDI' : ''}</p>
          </article>
        ))}
      </div>
    </Screen>
  );
}
