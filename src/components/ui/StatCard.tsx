interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

export function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <div className="flex-1 rounded-2xl border border-ink-600/60 bg-ink-800/80 px-3.5 py-3.5 text-center">
      <div className={`font-mono text-xl font-semibold tabular-nums ${accent ? 'text-gold-400' : 'text-mist-100'}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-mist-500">{label}</div>
    </div>
  );
}
