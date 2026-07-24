import { CheckersPiece } from '@/components/checkers/CheckersPiece';
import {
  getCheckersSkin,
  type CheckersSkinId,
} from '@/features/checkers/skins';

export function CheckersSkinPreview({
  skinId,
}: {
  skinId: CheckersSkinId;
}) {
  const skin = getCheckersSkin(skinId);

  return (
    <div
      className="rounded-[1.35rem] p-1.5 shadow-[0_12px_28px_-16px_rgba(0,0,0,.9)]"
      style={{ background: skin.board.frame }}
    >
      <div className="grid aspect-[1.55] grid-cols-6 overflow-hidden rounded-[1rem] border border-white/10">
        {Array.from({ length: 24 }, (_, index) => {
          const row = Math.floor(index / 6);
          const column = index % 6;
          const dark = (row + column) % 2 === 1;
          const blackPiece = index === 2 || index === 10;
          const whitePiece = index === 13 || index === 21;

          return (
            <span
              key={index}
              className="relative flex min-h-0 items-center justify-center"
              style={{
                background: dark ? skin.board.dark : skin.board.light,
              }}
            >
              {blackPiece ? (
                <CheckersPiece
                  side="black"
                  skinId="classic"
                  king={index === 2}
                  className="w-[82%]"
                />
              ) : null}
              {whitePiece ? (
                <CheckersPiece
                  side="white"
                  skinId="classic"
                  className="w-[82%]"
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
