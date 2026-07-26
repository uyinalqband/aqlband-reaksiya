import { CheckersPiece } from '@/components/checkers/CheckersPiece';
import type { CheckersPieceSkinId } from '@/features/checkers/pieceSkins';

export function CheckersPieceSkinPreview({
  skinId,
}: {
  skinId: CheckersPieceSkinId;
}) {
  return (
    <div className="relative flex aspect-[1.55] items-center justify-center gap-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-[#182537] via-[#0d1622] to-[#080d14] px-5">
      <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_25%_30%,rgba(255,255,255,.28),transparent_28%),radial-gradient(circle_at_75%_70%,rgba(121,96,255,.35),transparent_32%)]" />
      <CheckersPiece
        side="white"
        skinId={skinId}
        king
        className="w-[36%]"
      />
      <CheckersPiece
        side="black"
        skinId={skinId}
        className="w-[36%]"
      />
    </div>
  );
}
