import { invokePlatformApi } from '@/lib/platformApi';
import type { EngagementHub } from '@/types/engagement';

export function getEngagementHub(signal?: AbortSignal): Promise<EngagementHub> {
  return invokePlatformApi<EngagementHub>('engagement.get', {}, { signal });
}

export function claimDailyChest(): Promise<{ awardedXp: number; hub: EngagementHub }> {
  return invokePlatformApi('engagement.claim_daily');
}

