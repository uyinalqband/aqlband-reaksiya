import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  ProfileIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import { useNotificationStore } from '@/store/notificationStore';
import { haptics } from '@/lib/telegram';

function BellIcon({ active, unread }: { active: boolean; unread: number }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? 'text-violet-200' : 'text-mist-400'}
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-2 -top-1 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </span>
  );
}

function NavButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[4.1rem] w-full flex-col items-center justify-center rounded-2xl border px-2 py-2 transition-transform active:scale-[0.97] ${
        active
          ? 'border-violet-400/60 bg-violet-500/20 text-violet-200 shadow-glow'
          : 'border-ink-600/70 bg-ink-800/85 text-mist-400'
      }`}
    >
      <span className="mb-1 flex h-6 items-center justify-center">{icon}</span>
      <span className={`text-[11px] font-medium ${active ? 'text-violet-100' : 'text-mist-500'}`}>
        {label}
      </span>
    </button>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useNotificationStore((state) => state.items.filter((item) => !item.read).length);

  const tabs: { path: string; label: string; icon: (active: boolean) => ReactNode }[] = [
    {
      path: '/',
      label: t('nav.home'),
      icon: (active) => (
        <HomeIcon width={22} height={22} className={active ? 'text-violet-200' : 'text-mist-400'} />
      ),
    },
    {
      path: '/notifications',
      label: t('nav.notifications'),
      icon: (active) => <BellIcon active={active} unread={unread} />,
    },
    {
      path: '/profile',
      label: t('nav.profile'),
      icon: (active) => (
        <ProfileIcon width={22} height={22} className={active ? 'text-violet-200' : 'text-mist-400'} />
      ),
    },
    {
      path: '/settings',
      label: t('nav.settings'),
      icon: (active) => (
        <SettingsIcon width={22} height={22} className={active ? 'text-violet-200' : 'text-mist-400'} />
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/70 bg-ink-900/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-3 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <NavButton
              key={tab.path}
              active={active}
              label={tab.label}
              icon={tab.icon(active)}
              onClick={() => {
                haptics.selection();
                navigate(tab.path);
              }}
            />
          );
        })}
      </div>
    </nav>
  );
}
