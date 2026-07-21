import { create } from 'zustand';
import type { ChallengePayload } from '@/types';
import { getStartParam } from '@/lib/telegram';

interface ChallengeState {
  challenge: ChallengePayload | null;
  consume: () => ChallengePayload | null;
}

/**
 * Deep-link start params look like: "c-<timeMs>-<urlsafe-base64-name>[-<userId>]"
 * Kept intentionally compact — Telegram's startapp payload has a length limit
 * and only accepts [A-Za-z0-9_-].
 */
function decodeStartParam(raw: string): ChallengePayload | null {
  const parts = raw.split('-');
  if (parts.length < 3 || parts[0] !== 'c') return null;

  const timeMs = Number(parts[1]);
  if (!Number.isFinite(timeMs) || timeMs <= 0) return null;

  let name = 'Do\u2019stingiz';
  try {
    const normalized = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    name = decodeURIComponent(escape(atob(normalized))) || name;
  } catch {
    /* keep fallback name */
  }

  const userId = parts[3] ? Number(parts[3]) : undefined;

  return { t: timeMs, n: name, u: Number.isFinite(userId) ? userId : undefined };
}

export function encodeStartParam(payload: ChallengePayload): string {
  const nameB64 = btoa(unescape(encodeURIComponent(payload.n)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const idPart = payload.u ? `-${payload.u}` : '';
  return `c-${Math.round(payload.t)}-${nameB64}${idPart}`;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenge: (() => {
    const raw = getStartParam();
    return raw ? decodeStartParam(raw) : null;
  })(),

  consume: () => {
    const current = get().challenge;
    set({ challenge: null });
    return current;
  },
}));
