import { invokePlatformApi } from '@/lib/platformApi';
import type { AppAccount } from '@/types/account';
import type { CheckersSkinId } from '@/features/checkers/skins';
import type { CheckersPieceSkinId } from '@/features/checkers/pieceSkins';

export function updateCheckersSkin(
  skinId: CheckersSkinId,
): Promise<AppAccount> {
  return invokePlatformApi<AppAccount>('profile.update_checkers_skin', {
    skinId,
  });
}

export function updateCheckersPieceSkin(
  skinId: CheckersPieceSkinId,
): Promise<AppAccount> {
  return invokePlatformApi<AppAccount>(
    'profile.update_checkers_piece_skin',
    { skinId },
  );
}
