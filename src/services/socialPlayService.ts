import { invokePlatformApi } from '@/lib/platformApi';

export interface PassiveMatchOffer {
  id: string;
  seekerUserId: string;
  seekerName: string;
  seekerRating: number;
  expiresAt: number;
}

interface PassiveMatchOfferResponse extends Omit<PassiveMatchOffer, 'expiresAt'> {
  expiresInMs: number;
}

export function pingPresence(status: 'available' | 'dnd' | 'in_game') {
  return invokePlatformApi<{ status: string }>('presence.ping', { status });
}

export async function getPassiveMatchOffer(): Promise<PassiveMatchOffer | null> {
  const result = await invokePlatformApi<{ offer: PassiveMatchOfferResponse | null }>(
    'match.offer.inbox',
  );
  return result.offer
    ? {
        ...result.offer,
        expiresAt: Date.now() + Math.max(0, result.offer.expiresInMs),
      }
    : null;
}

export function respondPassiveMatchOffer(offerId: string, accept: boolean) {
  return invokePlatformApi<{
    accepted: boolean;
    duelId?: string;
    role?: 'host' | 'guest';
    opponentName?: string;
  }>('match.offer.respond', { offerId, accept });
}
