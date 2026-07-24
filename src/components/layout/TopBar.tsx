import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useOnlineStore } from '@/store/onlineStore';

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  hideAvatar?: boolean;
}

export function TopBar({
  title,
  onBack,
  trailing,
  hideAvatar = false,
}: TopBarProps) {
  const navigate = useNavigate();
  const account = useOnlineStore((state) => state.account);

  return (
    <div className="mb-5 flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist-200 transition-colors active:bg-ink-700"
          >
            <ChevronLeftIcon width={24} height={24} />
          </button>
        ) : null}
        {title ? (
          <h1 className="truncate font-display text-lg font-extrabold text-mist-100">
            {title}
          </h1>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {!hideAvatar ? (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="rounded-xl active:scale-95"
            aria-label="profile"
          >
            <UserAvatar
              currentUser
              name={account?.displayName ?? 'AqlBand'}
              size="sm"
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}
