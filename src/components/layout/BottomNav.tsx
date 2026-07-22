import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeIcon, SettingsIcon } from '@/components/ui/icons';
import { haptics } from '@/lib/telegram';

interface TabDef {
  path: string;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const iconProps = (active: boolean) => ({
  width: 22,
  height: 22,
  className: active ? 'text-violet-400' : 'text-mist-500',
});

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs: TabDef[] = [
    { path: '/', label: t('nav.home'), icon: (a) => <HomeIcon {...iconProps(a)} /> },
    { path: '/settings', label: t('nav.settings'), icon: (a) => <SettingsIcon {...iconProps(a)} /> },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600/60 bg-ink-800/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => {
                if (!active) {
                  haptics.selection();
                  navigate(tab.path);
                }
              }}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              {tab.icon(active)}
              <span className={`text-[10px] font-medium ${active ? 'text-violet-400' : 'text-mist-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
