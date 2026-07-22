import { invokePlatformApi } from '@/lib/platformApi';
import type { AppAccount } from '@/types/account';
import type { PublicUser } from '@/types/user';

export async function ensureUser(signal?: AbortSignal): Promise<AppAccount> {
  return invokePlatformApi<AppAccount>('profile.ensure', {}, { signal });
}

export async function searchUserByUsername(rawUsername: string): Promise<PublicUser | null> {
  const username = rawUsername.trim().replace(/^@/, '');
  if (!username) return null;
  const result = await invokePlatformApi<{ user: PublicUser | null }>('friend.search', { username });
  return result.user;
}
