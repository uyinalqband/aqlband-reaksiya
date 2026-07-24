import type { CSSProperties } from 'react';
import {
  getCheckersSkin,
  type CheckersPiecePalette,
  type CheckersPieceSide,
  type CheckersSkinId,
  type CheckersSkinMotif,
} from '@/features/checkers/skins';

interface CheckersPieceProps {
  side: CheckersPieceSide;
  skinId: CheckersSkinId;
  king?: boolean;
  selected?: boolean;
  movable?: boolean;
  ringOffsetColor?: string;
  className?: string;
}

export function CheckersPiece({
  side,
  skinId,
  king = false,
  selected = false,
  movable = false,
  ringOffsetColor,
  className = '',
}: CheckersPieceProps) {
  const skin = getCheckersSkin(skinId);
  const palette = skin.pieces[side];

  const outerStyle: CSSProperties = {
    borderColor: palette.border,
    background: palette.face,
    boxShadow: [
      `inset -5px -7px 10px ${palette.shadow}`,
      `inset 4px 4px 8px ${palette.highlight}`,
      '0 7px 12px rgba(0,0,0,.46)',
      movable
        ? `0 0 0 2px rgba(91,229,181,.65), 0 0 0 4px ${
            ringOffsetColor ?? 'rgba(22,35,51,.9)'
          }`
        : '',
    ]
      .filter(Boolean)
      .join(','),
  };

  return (
    <span
      className={`pointer-events-none relative block aspect-square shrink-0 transition-transform duration-100 ${
        selected ? 'scale-110' : ''
      } ${className}`}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 flex items-center justify-center rounded-full border-[2px]"
        style={outerStyle}
      >
        <span
          className="absolute inset-[12%] rounded-full border-2"
          style={{
            borderColor: palette.innerBorder,
            boxShadow: `inset 0 2px 5px ${palette.highlight}`,
          }}
        />
        <PieceMotif motif={skin.motif} palette={palette} />
      </span>

      {king ? <KingCrown side={side} /> : null}
    </span>
  );
}

function PieceMotif({
  motif,
  palette,
}: {
  motif: CheckersSkinMotif;
  palette: CheckersPiecePalette;
}) {
  if (motif === 'butterfly') {
    return (
      <svg
        viewBox="0 0 64 64"
        className="relative z-[2] h-[68%] w-[68%] drop-shadow-[0_2px_3px_rgba(0,0,0,.45)]"
      >
        <path
          d="M29.6 28.6C25 13.3 10.3 9.4 9 22.3 8.2 30.7 17.1 35 28.6 33.4Z"
          fill={palette.motifPrimary}
        />
        <path
          d="M34.4 28.6C39 13.3 53.7 9.4 55 22.3c.8 8.4-8.1 12.7-19.6 11.1Z"
          fill={palette.motifPrimary}
        />
        <path
          d="M29 35.6C21.7 35.1 14.7 40 17.1 47.2c2.6 7.7 11.4 1.9 14-8.6Z"
          fill={palette.motifSecondary}
        />
        <path
          d="M35 35.6c7.3-.5 14.3 4.4 11.9 11.6-2.6 7.7-11.4 1.9-14-8.6Z"
          fill={palette.motifSecondary}
        />
        <path
          d="M32 24.4c-3.6 4.8-3.8 15.1 0 22 3.8-6.9 3.6-17.2 0-22Z"
          fill="#171226"
        />
        <path
          d="M30.8 24.6c-1.3-5.3-5-8.8-9.3-10.5M33.2 24.6c1.3-5.3 5-8.8 9.3-10.5"
          fill="none"
          stroke="#171226"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <circle cx="19" cy="23" r="3.1" fill="rgba(255,255,255,.72)" />
        <circle cx="45" cy="23" r="3.1" fill="rgba(255,255,255,.72)" />
        <circle cx="24" cy="42" r="2" fill="rgba(255,255,255,.55)" />
        <circle cx="40" cy="42" r="2" fill="rgba(255,255,255,.55)" />
      </svg>
    );
  }

  if (motif === 'dragon') {
    return (
      <svg
        viewBox="0 0 64 64"
        className="relative z-[2] h-[70%] w-[70%] drop-shadow-[0_2px_3px_rgba(0,0,0,.55)]"
      >
        <path
          d="M47.9 12.8c-8.2-3.7-18.2-1.3-23.5 5.9-4.9 6.7-3.9 15.9 2.3 20.8 4.4 3.5 11 3.3 14.5-.7 2.6-3 2.2-7.8-.8-10.2-2.6-2.1-6.6-1.6-8.3 1.2-1.5 2.4-.5 5.4 2.1 6.3-4.8.3-8.2-3.6-7.7-8.2.6-5.8 6.8-9.7 12.5-7.9 7.4 2.3 11.6 10.4 9.4 17.8-2.6 8.6-12 13.8-20.5 11.4-6.9-2-11.8-8-12.4-15.1-1 6.1.7 12.6 5 17 6.4 6.5 16.7 8.3 24.8 4.1 9.5-4.9 14-16.1 10.3-26.2-1.7-4.6-5-8.4-9.2-10.7l4.8-1.2Z"
          fill={palette.motifPrimary}
        />
        <path
          d="m43.5 15.4 8.1-6.9-1.1 8.4 6.6 1.4-7.1 4.1-6.5-7Z"
          fill={palette.motifSecondary}
        />
        <path
          d="M18.2 28.2 8.4 22.7l6.3 10.1-7.2 3.1 10.9 2.2"
          fill={palette.motifSecondary}
        />
        <path
          d="M25 20.4 19.4 12l9.8 5.3M21.6 43.8l-7.3 7.6 10.7-3.6"
          fill="none"
          stroke={palette.motifSecondary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <circle cx="47.2" cy="15.4" r="1.5" fill="#ffd95f" />
      </svg>
    );
  }

  if (motif === 'gem') {
    return (
      <svg
        viewBox="0 0 64 64"
        className="relative z-[2] h-[62%] w-[62%] drop-shadow-[0_3px_4px_rgba(0,0,0,.5)]"
      >
        <path
          d="m32 6 21 16-8 28-13 8-13-8-8-28Z"
          fill={palette.motifPrimary}
        />
        <path
          d="m32 6 8 18-8 34-8-34Z"
          fill={palette.motifSecondary}
          opacity=".88"
        />
        <path
          d="m11 22 13 2 8-18 8 18 13-2M19 50l13 8 13-8-5-26H24Z"
          fill="none"
          stroke="rgba(255,255,255,.62)"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <>
      <span
        className="absolute inset-[25%] rounded-full border"
        style={{ borderColor: palette.innerBorder }}
      />
      <span
        className="absolute inset-[36%] rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, ${palette.motifSecondary}, ${palette.motifPrimary})`,
          opacity: 0.58,
        }}
      />
    </>
  );
}

function KingCrown({ side }: { side: CheckersPieceSide }) {
  return (
    <span
      className="absolute left-1/2 top-[-7%] z-[5] flex h-[48%] w-[70%] -translate-x-1/2 items-start justify-center rounded-t-full"
      style={{
        filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.7))',
      }}
    >
      <svg viewBox="0 0 64 40" className="h-full w-full">
        <path
          d="m6 29 3-19 12 10L32 4l11 16 12-10 3 19Z"
          fill="url(#king-gold)"
          stroke="#8f5b00"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M8 29h48v7H8Z"
          fill="#f4b62f"
          stroke="#8f5b00"
          strokeWidth="2"
        />
        <circle cx="10" cy="9" r="4" fill="#ffd85c" stroke="#8f5b00" />
        <circle cx="32" cy="4" r="4" fill="#ffd85c" stroke="#8f5b00" />
        <circle cx="54" cy="9" r="4" fill="#ffd85c" stroke="#8f5b00" />
        <circle cx="20" cy="28" r="2.5" fill={side === 'white' ? '#c51d31' : '#51a9ff'} />
        <circle cx="32" cy="28" r="2.5" fill="#31b66c" />
        <circle cx="44" cy="28" r="2.5" fill={side === 'white' ? '#51a9ff' : '#c51d31'} />
        <defs>
          <linearGradient id="king-gold" x1="10" y1="4" x2="53" y2="34">
            <stop stopColor="#fff0a1" />
            <stop offset=".45" stopColor="#ffc83e" />
            <stop offset="1" stopColor="#b56c00" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
