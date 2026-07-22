import { invokePlatformApi } from '@/lib/platformApi';
import { supabase } from '@/lib/supabaseClient';

export async function deleteCurrentAccount(): Promise<void> {
  await invokePlatformApi<{ deleted: boolean }>('profile.delete');
}

export async function signOutCurrentSession(): Promise<void> {
  await supabase.auth.signOut().catch(() => undefined);
}
