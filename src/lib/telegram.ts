export function getTelegramUser(): AppUser | null {
  const raw = getWebApp()?.initDataUnsafe?.user;

  alert(JSON.stringify(getWebApp()?.initDataUnsafe));

  if (!raw) return null;

  return {
    id: raw.id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    username: raw.username,
    languageCode: raw.language_code,
    photoUrl: raw.photo_url,
    isPremium: raw.is_premium,
  };
}
