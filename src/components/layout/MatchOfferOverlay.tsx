import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { Button } from '@/components/ui/Button';
import { makeDuelGameState } from '@/features/duel/duelSession';
import {
  getPassiveMatchOffer,
  pingPresence,
  respondPassiveMatchOffer,
  type PassiveMatchOffer,
} from '@/services/socialPlayService';
import { useOnlineStore } from '@/store/onlineStore';

const BLOCKED = ['/games/checkers', '/duel'];

export function MatchOfferOverlay() {
  const userId = useOnlineStore((state) => state.appUserId);
  const location = useLocation();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<PassiveMatchOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const blocked = BLOCKED.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const refresh = async () => {
      const status = blocked ? 'in_game' : document.hidden ? 'dnd' : 'available';
      try {
        await pingPresence(status);
        if (!blocked && !document.hidden) {
          const next = await getPassiveMatchOffer();
          if (!stopped) setOffer(next);
        } else if (!stopped) setOffer(null);
      } catch {
        // Presence is an enhancement; it must never block normal play.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [blocked, userId]);

  if (!offer || blocked) return null;

  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      const result = await respondPassiveMatchOffer(offer.id, accept);
      setOffer(null);
      if (accept && result.duelId && result.role) {
        navigate('/games/checkers', {
          state: makeDuelGameState({
            duelId: result.duelId,
            role: result.role,
            gameId: 'checkers',
            config: { rounds: 1, difficulty: 'medium' },
            opponentName: result.opponentName ?? offer.seekerName,
          }),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-50 mx-auto max-w-md rounded-3xl border border-violet-300/25 bg-[#101c2d]/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <UserAvatar name={offer.seekerName} active />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-mist-100">{offer.seekerName}</p>
          <p className="text-xs text-mist-500">⚔️ Reytingli shashka · {offer.seekerRating} ELO</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">ONLINE</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="md" disabled={busy} onClick={() => void respond(true)}>Qabul qilish</Button>
        <Button size="md" variant="secondary" disabled={busy} onClick={() => void respond(false)}>Hozir emas</Button>
      </div>
    </div>
  );
}
