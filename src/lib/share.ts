import { getWebApp, isInsideTelegram } from '@/lib/telegram';

export async function shareGameResult(title: string, resultText: string): Promise<void> {
  const url = typeof window === 'undefined' ? '' : window.location.origin;
  const text = `${title}: ${resultText}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const webApp = getWebApp();
  if (isInsideTelegram() && webApp) {
    webApp.openTelegramLink(shareUrl);
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return;
  }

  if (typeof window !== 'undefined') window.open(shareUrl, '_blank', 'noopener,noreferrer');
}
