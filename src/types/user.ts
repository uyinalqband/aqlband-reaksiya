import type { AppAccount } from '@/types/account';

export type UserRow = AppAccount;

export interface PublicUser {
  id: string;
  displayName: string;
  username: string | null;
}
