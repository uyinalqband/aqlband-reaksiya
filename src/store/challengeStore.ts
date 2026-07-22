import { create } from 'zustand';
import type { ChallengePayload } from '@/types';
import { getStartParam } from '@/lib/telegram';

interface ChallengeState {
  challenge: ChallengePayload | null;
  consume: () => ChallengePayload | null;
}

const DEFAULT_CHALLENGER_NAME = 'Do\u2019stingiz';
const MAX_NAME_LENGTH = 48;

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();

    if (!decoded || /[\u0000-\u001F\u007F]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function normalizeTime(value: string): number | null {
  const timeMs = Number(value);
  if (!Number.isFinite(timeMs) || timeMs <= 0) return null;
  return Math.round(timeMs);
}

/**
 * Current payload format:
 * c2_<timeMs>_<userId-or-0>_<base64url-name>
 *
 * The first three fields have fixed meanings, while the encoded name occupies
 * the entire remainder. This prevents '-' or '_' inside Base64URL data from
 * being mistaken for separators.
 */
function decodeCurrentStartParam(raw: string): ChallengePayload | null {
  const match = /^c2_(\d+)_(\d+)_([A-Za-z0-9_-]+)$/.exec(raw);
  if (!match) return null;

  const timeMs = normalizeTime(match[1]);
  if (timeMs === null) return null;

  const rawUserId = Number(match[2]);
  const userId = Number.isSafeInteger(rawUserId) && rawUserId > 0 ? rawUserId : undefined;
  const name = decodeBase64Url(match[3]) ?? DEFAULT_CHALLENGER_NAME;

  return { t: timeMs, n: name, u: userId };
}

/**
 * Supports links created by the previous format:
 * c-<timeMs>-<base64url-name>[-<userId>]
 */
function decodeLegacyStartParam(raw: string): ChallengePayload | null {
  const match = /^c-(\d+)-(.+)$/.exec(raw);
  if (!match) return null;

  const timeMs = normalizeTime(match[1]);
  if (timeMs === null) return null;

  const remainder = match[2];
  const withUserId = /^(.*)-(\d+)$/.exec(remainder);

  if (withUserId) {
    const name = decodeBase64Url(withUserId[1]);
    const rawUserId = Number(withUserId[2]);

    if (name && Number.isSafeInteger(rawUserId) && rawUserId > 0) {
      return { t: timeMs, n: name, u: rawUserId };
    }
  }

  return {
    t: timeMs,
    n: decodeBase64Url(remainder) ?? DEFAULT_CHALLENGER_NAME,
  };
}

function decodeStartParam(raw: string): ChallengePayload | null {
  return decodeCurrentStartParam(raw) ?? decodeLegacyStartParam(raw);
}

export function encodeStartParam(payload: ChallengePayload): string {
  const timeMs = Math.max(1, Math.round(payload.t));
  const userId = payload.u && Number.isSafeInteger(payload.u) && payload.u > 0 ? payload.u : 0;
  const normalizedName = Array.from(payload.n.trim() || 'AqlBand')
    .slice(0, MAX_NAME_LENGTH)
    .join('');

  return `c2_${timeMs}_${userId}_${encodeBase64Url(normalizedName)}`;
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
