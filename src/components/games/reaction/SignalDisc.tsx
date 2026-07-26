import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import type { ReactionGamePhase } from '@/features/games/reaction/types';

interface SignalDiscProps {
  phase: ReactionGamePhase;
  label?: ReactNode;
  sublabel?: ReactNode;
}

const DISC_STYLES: Record<ReactionGamePhase, { bg: string; ring: string; glow: string }> = {
  idle: { bg: 'bg-ink-700', ring: 'border-violet-500/40', glow: '' },
  countdown: { bg: 'bg-ink-700', ring: 'border-violet-500/50', glow: '' },
  go: { bg: 'bg-signal-go', ring: 'border-signal-go', glow: 'shadow-[0_0_80px_-10px_rgba(52,216,163,0.75)]' },
  result: { bg: 'bg-violet-600', ring: 'border-violet-400/60', glow: 'shadow-glow' },
  tooSoon: { bg: 'bg-signal-early', ring: 'border-signal-early', glow: 'shadow-[0_0_80px_-10px_rgba(251,91,91,0.7)]' },
  timeout: { bg: 'bg-ink-700', ring: 'border-signal-early/60', glow: '' },
};

export function SignalDisc({ phase, label, sublabel }: SignalDiscProps) {
  const style = DISC_STYLES[phase];
  const isPulsing = phase === 'countdown';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      {isPulsing && (
        <>
          <span className="absolute inset-0 rounded-full border border-violet-500/30 animate-pulseRing" />
          <span
            className="absolute inset-0 rounded-full border border-violet-500/30 animate-pulseRing"
            style={{ animationDelay: '0.9s' }}
          />
        </>
      )}

      <motion.div
        key={phase}
        initial={{ scale: 0.94 }}
        animate={{ scale: phase === 'go' ? [1, 1.04, 1] : 1 }}
        transition={{ duration: phase === 'go' ? 0.4 : 0.25, ease: 'easeOut' }}
        className={`relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 ${style.bg} ${style.ring} ${style.glow} transition-colors duration-200`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${String(label)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center px-6 text-center"
          >
            {label && (
              <span
                className={`font-display font-bold leading-none ${
                  phase === 'result' ? 'font-mono text-5xl text-mist-100' : 'text-xl text-mist-100'
                }`}
              >
                {label}
              </span>
            )}
            {sublabel && <span className="mt-2 text-xs font-medium text-mist-300/90">{sublabel}</span>}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
