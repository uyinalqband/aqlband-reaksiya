import { useNavigate } from 'react-router-dom';
import { dailyTraining, recommendedGame, skillScores, trainingProgress } from '@/features/games/trainingCoach';
import type { GameAttempt } from '@/store/gameHistoryStore';

const SKILLS = [
  ['speed', 'Tezlik', '⚡'],
  ['memory', 'Xotira', '🧠'],
  ['attention', 'Diqqat', '👁'],
  ['logic', 'Mantiq', '🧩'],
] as const;

export function TrainingDashboard({ attempts }: { attempts: GameAttempt[] }) {
  const navigate = useNavigate();
  const games = dailyTraining();
  const progress = trainingProgress(attempts);
  const scores = skillScores(attempts);
  const recommendation = recommendedGame(attempts);
  const weekAttempts = attempts.filter((attempt) => Date.now() - attempt.playedAt < 7 * 86_400_000);
  const activeDays = new Set(weekAttempts.map((attempt) => new Date(attempt.playedAt).toDateString())).size;
  const today = new Set(attempts.filter((attempt) => {
    const date = new Date(attempt.playedAt);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  }).map((attempt) => attempt.gameId));

  return (
    <>
      <section className="premium-border mt-5 rounded-3xl bg-gradient-to-br from-violet-500/15 to-ink-800/90 p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Bugungi trening</p>
            <h2 className="mt-1 font-display text-xl font-extrabold">{progress}/3 mashq bajarildi</h2>
            <p className="mt-1 text-xs text-mist-500">6–8 daqiqalik muvozanatli aqliy mashg‘ulot</p>
          </div>
          <span className="rounded-2xl bg-emerald-400/10 px-3 py-2 font-mono text-sm font-black text-emerald-300">
            {Math.round(progress / 3 * 100)}%
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {games.map((game, index) => (
            <button key={game.id} type="button" onClick={() => navigate(game.route, { state: { adaptive: true } })}
              className={`min-h-20 rounded-2xl border p-2 text-center active:scale-[.97] ${
                today.has(game.id) ? 'border-emerald-300/25 bg-emerald-500/10' : 'border-white/10 bg-black/15'
              }`}>
              <span className="block text-xl">{today.has(game.id) ? '✓' : game.emoji}</span>
              <span className="mt-1 block text-[10px] font-extrabold text-mist-200">Mashq {index + 1}</span>
            </button>
          ))}
        </div>
      </section>

      <button type="button" onClick={() => navigate(recommendation.route, { state: { adaptive: true } })}
        className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-gold-300/20 bg-gold-500/10 p-4 text-left active:scale-[.99]">
        <span className="text-3xl">{recommendation.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-wider text-gold-300">Siz uchun tavsiya</span>
          <span className="block font-display text-sm font-extrabold">Eng sust ko‘nikmani kuchaytirish</span>
        </span>
        <span className="text-xl text-gold-300">›</span>
      </button>

      <section className="mt-3 rounded-3xl border border-white/10 bg-ink-800/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-extrabold">Mahorat xaritasi</h2>
          <span className="text-[10px] text-mist-500">Oxirgi 14 kun</span>
        </div>
        <div className="mt-3 space-y-2.5">
          {SKILLS.map(([id, label, emoji]) => (
            <div key={id} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2">
              <span className="text-[11px] font-bold text-mist-300">{emoji} {label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-black/25">
                <span className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${scores[id]}%` }} />
              </span>
              <span className="font-mono text-[10px] font-black text-mist-400">{scores[id]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-cyan-300/15 bg-cyan-500/10 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Kunlik missiya</p>
          <p className="mt-2 text-sm font-extrabold">3 xil ko‘nikma</p>
          <p className="mt-1 text-xs text-mist-500">{progress}/3 · faqat yakunlangan o‘yin</p>
        </div>
        <div className="rounded-3xl border border-amber-300/15 bg-amber-500/10 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Haftalik sinov</p>
          <p className="mt-2 text-sm font-extrabold">5 faol kun</p>
          <p className="mt-1 text-xs text-mist-500">{Math.min(5, activeDays)}/5 · {weekAttempts.length} mashq</p>
        </div>
      </section>
    </>
  );
}
