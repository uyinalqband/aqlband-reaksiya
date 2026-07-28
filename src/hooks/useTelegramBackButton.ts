import { useEffect, useRef } from 'react';
import { getWebApp } from '@/lib/telegram';

/**
 * Keeps Telegram's native BackButton stable while the callback changes.
 * Timer-driven screens re-render frequently; re-registering the button on
 * every render caused the native arrow to blink.
 */
export function useTelegramBackButton(onBack: (() => void) | null): void {
  const callbackRef = useRef(onBack);
  const enabled = onBack !== null;

  useEffect(() => {
    callbackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const webApp = getWebApp();
    if (!webApp || !enabled) return;

    const handler = () => callbackRef.current?.();
    webApp.BackButton.onClick(handler);
    webApp.BackButton.show();

    return () => {
      webApp.BackButton.offClick(handler);
      webApp.BackButton.hide();
    };
  }, [enabled]);
}
