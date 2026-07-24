import { invokePlatformApi } from '@/lib/platformApi';
import { supabase } from '@/lib/supabaseClient';
import type { AppAccount } from '@/types/account';

export async function updateDisplayName(displayName: string): Promise<AppAccount> {
  return invokePlatformApi<AppAccount>('profile.update_name', {
    displayName,
  });
}

export async function deleteCurrentAccount(): Promise<void> {
  await invokePlatformApi<{ deleted: boolean }>('profile.delete');
}

export async function signOutCurrentSession(): Promise<void> {
  await supabase.auth.signOut().catch(() => undefined);
}
