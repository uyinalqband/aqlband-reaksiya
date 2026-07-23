import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@/components/ui/icons';

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

export function TopBar({ title, onBack, trailing }: TopBarProps) {
  return (
    <div className="mb-6 flex min-h-10 items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mist-200 transition-colors active:bg-ink-700"
          >
            <ChevronLeftIcon width={24} height={24} />
          </button>
        )}
        {title && <h1 className="truncate font-display text-lg font-semibold text-mist-100">{title}</h1>}
      </div>
      {trailing}
    </div>
  );
}
