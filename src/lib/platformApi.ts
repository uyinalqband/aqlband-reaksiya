import i18n from '@/i18n';
import { getTelegramInitData, getTelegramUser } from '@/lib/telegram';
import {
  isSupabaseAuthConfigured,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
} from '@/lib/supabaseClient';

const API_ERROR_KEYS: Record<string, string> = {
  not_configured: 'apiErrors.notConfigured',
  auth_required: 'apiErrors.authRequired',
  account_not_found: 'apiErrors.accountNotFound',
  telegram_auth_expired: 'apiErrors.telegramExpired',
  telegram_auth_invalid: 'apiErrors.authInvalid',
  google_auth_invalid: 'apiErrors.authInvalid',
  provider_not_supported: 'apiErrors.providerNotSupported',
  network_error: 'apiErrors.network',
  invalid_response: 'apiErrors.invalidResponse',
  rate_limited: 'apiErrors.rateLimited',
  invalid_username: 'apiErrors.invalidUsername',
  user_not_found: 'apiErrors.userNotFound',
  friendship_exists: 'apiErrors.friendshipExists',
  self_friendship: 'apiErrors.selfFriendship',
  duel_not_found: 'apiErrors.duelNotFound',
  duel_forbidden: 'apiErrors.duelForbidden',
  duel_expired: 'apiErrors.duelExpired',
  duel_full: 'apiErrors.duelFull',
  duel_not_joinable: 'apiErrors.duelNotJoinable',
  duel_not_started: 'apiErrors.duelNotStarted',
  duel_false_start: 'apiErrors.duelFalseStart',
  progression_load_failed: 'errors.generic',
  progression_not_found: 'errors.generic',
};

function apiMessage(code: string, fallbackKey = 'errors.generic'): string {
  const key = API_ERROR_KEYS[code];
  return key ? i18n.t(key) : i18n.t(fallbackKey);
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly code = 'api_error',
    readonly status = 0,
  ) {
    super(message);
  }
}

export async function hasOnlineCredential(): Promise<boolean> {
  if (getTelegramInitData()) return true;
  if (!isSupabaseAuthConfigured) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.access_token);
}

/** Stable local namespace so Telegram and future Google histories never mix. */
export async function getLocalIdentityScope(): Promise<string> {
  const telegramUser = getTelegramUser();
  if (telegramUser && getTelegramInitData()) return `telegram_${telegramUser.id}`;

  if (isSupabaseAuthConfigured) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id) return `google_${data.session.user.id}`;
  }
  return 'guest';
}

export async function invokePlatformApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  if (!supabaseUrl) {
    throw new PlatformApiError(apiMessage('not_configured'), 'not_configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const telegramInitData = getTelegramInitData();
  if (telegramInitData) {
    headers['X-Telegram-Init-Data'] = telegramInitData;
    // Optional for a public function with Verify JWT disabled. Keep it when
    // Cloudflare injected the key, but do not block Telegram when it did not.
    if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
  } else {
    if (!isSupabaseAuthConfigured) {
      throw new PlatformApiError(apiMessage('auth_required'), 'auth_required', 401);
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      throw new PlatformApiError(apiMessage('auth_required'), 'auth_required', 401);
    }
    headers.Authorization = `Bearer ${data.session.access_token}`;
    if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/aqlband-api`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, payload }),
      signal: options.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new PlatformApiError('', 'request_aborted');
    }
    throw new PlatformApiError(apiMessage('network_error'), 'network_error');
  }

  let result: ApiSuccess<T> | ApiFailure;
  try {
    result = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    throw new PlatformApiError(apiMessage('invalid_response'), 'invalid_response', response.status);
  }

  if (!response.ok || !result.ok) {
    const failure = result as ApiFailure;
    const code = failure.error?.code || 'api_error';
    const serverMessage = failure.error?.message?.trim();
    throw new PlatformApiError(serverMessage || apiMessage(code), code, response.status);
  }

  return result.data;
}
