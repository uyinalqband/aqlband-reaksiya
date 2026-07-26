import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/layout/Screen';
import { GAMES, type GameDefinition } from '@/features/games/catalog';
import { checkersMusic } from '@/lib/checkersMusic';

type Filter = 'all' | GameDefinition['category'];

const FILTERS: Array<{ id: Filter; emoji: string }> = [
  { id: 'all', emoji: '✨' },
  { id: 'speed', emoji: '⚡' },
  { id: 'memory', emoji: '🧠' },
  { id: 'attention', emoji: '👁' },
  { id: 'logic', emoji: '🧩' },
];

const accent: Record<GameDefinition['category'], string> = {
  speed: 'border-amber-300/20 from-amber-500/15',
  memory: 'border-violet-300/20 from-violet-500/15',
  attention: 'border-cyan-300/20 from-cyan-500/15',
  logic: 'border-emerald-300/20 from-emerald-500/15',
};

export function GamesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const games = useMemo(
    () => GAMES.filter((game) => game.id !== 'checkers' && (filter === 'all' || game.category === filter)),
    [filter],
  );

  const openCheckers = (mode: 'rated' | 'friendly') => {
    checkersMusic.unlock();
    navigate('/games/checkers', { state: { startMode: mode } });
  };

  return (
    <Screen className="pb-28">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
          {t('gameHub.eyebrow')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-mist-100">
          {t('gameHub.title')}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-mist-500">
          {t('gameHub.subtitle')}
        </p>
      </header>

      <section className="premium-border relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A2D4D] via-[#101B2A] to-[#08101A] p-5 shadow-glow">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-2xl">
              ⚪⚫
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gold-300">
                {t('gameHub.mainGame')}
              </p>
              <h2 className="font-display text-2xl font-extrabold">
                {t('games.checkers.title')}
              </h2>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[1.35fr_1fr] gap-3">
            <button
              type="button"
              onClick={() => openCheckers('rated')}
              className="min-h-14 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-3 text-sm font-extrabold text-white shadow-glow active:scale-[.98]"
            >
              ⚔️ {t('v2.findOpponent')}
            </button>
            <button
              type="button"
              onClick={() => openCheckers('friendly')}
              className="min-h-14 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-extrabold text-mist-100 active:scale-[.98]"
            >
              👥 {t('v2.friendMatch')}
            </button>
          </div>
        </div>
      </section>

      <div className="no-scrollbar -mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`min-h-11 shrink-0 rounded-2xl border px-3.5 text-xs font-extrabold transition ${
              filter === item.id
                ? 'border-violet-300/40 bg-violet-500/20 text-violet-100 shadow-glow'
                : 'border-white/10 bg-ink-800/70 text-mist-500'
            }`}
          >
            {item.emoji} {t(`gameHub.filters.${item.id}`)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {games.map((game, index) => (
          <motion.button
            key={game.id}
            type="button"
            onClick={() => navigate(game.route)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.2) }}
            className={`relative min-h-[10.5rem] overflow-hidden rounded-3xl border bg-gradient-to-br ${accent[game.category]} to-ink-800/90 p-4 text-left shadow-card active:scale-[.98]`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-2xl">
              {game.emoji}
            </span>
            <span className="mt-3 block font-display text-[15px] font-extrabold leading-5 text-mist-100">
              {t(game.titleKey)}
            </span>
            <span className="mt-1.5 line-clamp-2 block text-[11px] leading-4 text-mist-500">
              {t(game.descriptionKey)}
            </span>
            <span className="absolute bottom-3.5 right-4 text-lg text-mist-600">›</span>
            <span className="absolute bottom-3.5 left-4 text-[9px] font-black uppercase tracking-wider text-violet-300">
              {game.friendOnly ? t('games.friendOnly') : `+ XP`}
            </span>
          </motion.button>
        ))}
      </div>
    </Screen>
  );
}
