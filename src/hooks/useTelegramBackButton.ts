import { useEffect } from 'react';
import { getWebApp } from '@/lib/telegram';

/**
 * Shows the native Telegram BackButton while a screen is mounted and routes
 * its tap to the given handler. Cleans up listeners and hides the button on
 * unmount so the previous screen's chrome is never left dangling.
 */
export function useTelegramBackButton(onBack: (() => void) | null): void {
  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp || !onBack) return;

    const handler = () => onBack();
    webApp.BackButton.show();
    webApp.BackButton.onClick(handler);

    return () => {
      webApp.BackButton.offClick(handler);
      webApp.BackButton.hide();
    };
  }, [onBack]);
}
