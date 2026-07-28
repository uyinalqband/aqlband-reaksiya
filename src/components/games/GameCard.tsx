import { motion } from 'framer-motion';

interface GameCardProps {
  emoji: string;
  title: string;
  bestLabel: string;
  bestValue: string;
  accentBorderClassName: string;
  onClick: () => void;
}

export function GameCard({ emoji, title, bestLabel, bestValue, accentBorderClassName, onClick }: GameCardProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-2xl border border-ink-600/60 bg-ink-800/80 p-4 text-left border-l-4 ${accentBorderClassName}`}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="mt-1 font-display text-sm font-semibold text-mist-100">{title}</span>
      <span className="text-xs text-mist-500">
        {bestLabel}: <span className="font-mono font-semibold text-mist-200">{bestValue}</span>
      </span>
    </motion.button>
  );
}
