import { invokePlatformApi, PlatformApiError } from '@/lib/platformApi';
import type { ProgressionSnapshot } from '@/types/progression';

async function loadProgression(signal?: AbortSignal): Promise<ProgressionSnapshot> {
  return invokePlatformApi<ProgressionSnapshot>('progression.get', {}, { signal });
}

export async function getProgression(signal?: AbortSignal): Promise<ProgressionSnapshot> {
  try {
    return await loadProgression(signal);
  } catch (error) {
    // The profile store may still be hydrating on a fresh launch. Ensure the
    // verified Telegram/Google account once, then retry the XP query.
    if (error instanceof PlatformApiError && error.code === 'account_not_found') {
      await invokePlatformApi('profile.ensure', {}, { signal });
      return loadProgression(signal);
    }
    throw error;
  }
}
