import { useNavigate } from 'react-router-dom';
import type { EngagementHub } from '@/types/engagement';

export function DailyQuestCard({
  hub,
  busy,
  onClaim,
}: {
  hub: EngagementHub;
  busy: boolean;
  onClaim: () => void;
}) {
  const navigate = useNavigate();
  const ready = hub.daily.completed === hub.daily.total && !hub.daily.chestClaimed;
  return (
    <section className="mt-5 rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-500/12 to-ink-800/90 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">Bugungi maqsadlar</p>
          <h2 className="mt-1 font-display text-lg font-extrabold">{hub.daily.completed}/{hub.daily.total} bajarildi</h2>
        </div>
        <span className="rounded-2xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs font-black text-orange-200">
          🔥 {hub.streak.current} kun
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
                <span className="block truncate text-xs font-extrabold text-mist-100">{task.title}</span>
                <span className="block truncate text-[10px] text-mist-500">{task.description} · +{task.rewardXp} XP</span>
              </span>
              <span className="font-mono text-[10px] font-black text-mist-400">{task.progress}/{task.target}</span>
            </button>
          );
        })}
      </div>
      <button type="button" disabled={!ready || busy} onClick={onClaim}
        className={`mt-3 min-h-12 w-full rounded-2xl text-sm font-black transition ${
          ready ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-[#241204] shadow-glow active:scale-[.98]'
            : 'border border-white/10 bg-white/5 text-mist-500'
        } disabled:cursor-default`}>
        {hub.daily.chestClaimed ? '✅ Bugungi sandiq olindi' : ready ? `🎁 Sandiqni ochish · +${hub.daily.chestXp} XP` : '🔒 3/3 dan keyin ochiladi'}
      </button>
      <button type="button" onClick={() => navigate('/achievements')}
        className="mt-2 w-full py-1 text-xs font-bold text-violet-300">Barcha yutuqlar →</button>
    </section>
  );
}
