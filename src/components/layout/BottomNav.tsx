import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  ProfileIcon,
  TrophyIcon,
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
        className={active ? 'text-gold-300' : 'text-mist-500'}
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unread > 0 ? (
        <span className="absolute -right-2 -top-1 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold text-white">
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
      className={`relative flex min-h-[3.8rem] w-full flex-col items-center justify-center rounded-2xl px-2 py-2 transition-all active:scale-95 ${
        active
          ? 'bg-gradient-to-b from-violet-500/25 to-violet-500/10 text-mist-100'
          : 'text-mist-600'
      }`}
    >
      {active ? (
        <span className="absolute left-1/2 top-0 h-0.5 w-7 -translate-x-1/2 rounded-full bg-gold-300 shadow-goldGlow" />
      ) : null}
      <span className="mb-1 flex h-6 items-center justify-center">{icon}</span>
      <span className={`text-[10px] font-bold ${active ? 'text-mist-200' : 'text-mist-600'}`}>
        {label}
      </span>
    </button>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useNotificationStore(
    (state) => state.items.filter((item) => !item.read).length,
  );

  const tabs: Array<{
    path: string;
    label: string;
    icon: (active: boolean) => ReactNode;
  }> = [
    {
      path: '/',
      label: t('nav.home'),
      icon: (active) => (
        <HomeIcon
          width={22}
          height={22}
          className={active ? 'text-violet-300' : 'text-mist-600'}
        />
      ),
    },
    {
      path: '/leaderboard',
      label: t('nav.leaderboard'),
      icon: (active) => (
        <TrophyIcon
          width={22}
          height={22}
          className={active ? 'text-gold-300' : 'text-mist-600'}
        />
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
        <ProfileIcon
          width={22}
          height={22}
          className={active ? 'text-emerald-300' : 'text-mist-600'}
        />
      ),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)]">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 rounded-3xl border border-mist-400/10 bg-[#0B1420]/95 p-1.5 shadow-[0_-16px_45px_-30px_rgba(0,0,0,.95)] backdrop-blur-2xl">
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
