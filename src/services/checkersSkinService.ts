import { invokePlatformApi } from '@/lib/platformApi';
import type { AppAccount } from '@/types/account';
import type { CheckersSkinId } from '@/features/checkers/skins';

export function updateCheckersSkin(
  skinId: CheckersSkinId,
): Promise<AppAccount> {
  return invokePlatformApi<AppAccount>('profile.update_checkers_skin', {
    skinId,
  });
}
