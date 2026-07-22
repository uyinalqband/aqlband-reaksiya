import { invokePlatformApi } from '@/lib/platformApi';
import type { ProgressionSnapshot } from '@/types/progression';

export async function getProgression(signal?: AbortSignal): Promise<ProgressionSnapshot> {
  return invokePlatformApi<ProgressionSnapshot>('progression.get', {}, { signal });
}
