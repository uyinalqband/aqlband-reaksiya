/** Row shape of `public.users`. */
export interface UserRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  created_at: string;
}
