export type LeaderboardTabKey = 'global' | 'friends' | 'weekly' | 'monthly';

interface Tab {
  key: LeaderboardTabKey;
  label: string;
  emoji: string;
}

const TABS: Tab[] = [
  { key: 'global', label: 'Global', emoji: '🏆' },
  { key: 'friends', label: "Do'stlar", emoji: '👥' },
  { key: 'weekly', label: 'Haftalik', emoji: '📅' },
  { key: 'monthly', label: 'Oylik', emoji: '📆' },
];

interface LeaderboardTabsProps {
  active: LeaderboardTabKey;
  onChange: (tab: LeaderboardTabKey) => void;
}

export function LeaderboardTabs({ active, onChange }: LeaderboardTabsProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'bg-violet-600 text-mist-100' : 'bg-ink-800 text-mist-400 border border-ink-600'
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
