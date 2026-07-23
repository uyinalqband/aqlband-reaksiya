import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { isInsideTelegram } from '@/lib/telegram';

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

export function TopBar({ title, onBack, trailing }: TopBarProps) {
  // Inside Telegram, the native BackButton (wired via useTelegramBackButton)
  // already provides this affordance in the client chrome — avoid a duplicate.
  const showInAppBack = onBack && !isInsideTelegram();

  return (
    <div className="flex items-center justify-between mb-6 min-h-9">
      <div className="flex items-center gap-2">
        {showInAppBack && (
          <button
            onClick={onBack}
            aria-label="back"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-mist-300 active:bg-ink-700"
          >
            <ChevronLeftIcon width={22} height={22} />
          </button>
        )}
        {title && <h1 className="font-display text-lg font-semibold text-mist-100">{title}</h1>}
      </div>
      {trailing}
    </div>
  );
}
