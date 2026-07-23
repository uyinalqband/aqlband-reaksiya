import { useTranslation } from 'react-i18next';

export type LeaderboardTabKey = 'global' | 'friends' | 'weekly' | 'monthly';

interface LeaderboardTabsProps {
  active: LeaderboardTabKey;
  onChange: (tab: LeaderboardTabKey) => void;
}

const TAB_DEFINITIONS: Array<{
  key: LeaderboardTabKey;
  labelKey: string;
  emoji: string;
}> = [
  { key: 'global', labelKey: 'leaderboard.tabs.global', emoji: '🏆' },
  { key: 'friends', labelKey: 'leaderboard.tabs.friends', emoji: '👥' },
  { key: 'weekly', labelKey: 'leaderboard.tabs.weekly', emoji: '📅' },
  { key: 'monthly', labelKey: 'leaderboard.tabs.monthly', emoji: '📆' },
];

export function LeaderboardTabs({ active, onChange }: LeaderboardTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {TAB_DEFINITIONS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-violet-400 bg-violet-600 text-mist-100'
                : 'border-ink-600 bg-ink-800 text-mist-400'
            }`}
          >
            <span>{tab.emoji}</span>
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
