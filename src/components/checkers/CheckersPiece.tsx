import type { CSSProperties } from 'react';
import {
  getCheckersPieceSkin,
  type CheckersPiecePalette,
  type CheckersPieceSide,
  type CheckersPieceSkinId,
} from '@/features/checkers/pieceSkins';

interface CheckersPieceProps {
  side: CheckersPieceSide;
  skinId: CheckersPieceSkinId;
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
  const skin = getCheckersPieceSkin(skinId);
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
        <PieceMotif symbol={skin.symbol} palette={palette} />
      </span>

      {king ? <KingCrown side={side} /> : null}
    </span>
  );
}

function PieceMotif({
  symbol,
  palette,
}: {
  symbol: string | null;
  palette: CheckersPiecePalette;
}) {
  if (symbol) {
    return (
      <svg
        viewBox="0 0 64 64"
        className="relative z-[2] h-[72%] w-[72%] overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,.5)]"
      >
        <text
          x="32"
          y="34"
          dominantBaseline="middle"
          fontSize="42"
          textAnchor="middle"
        >
          {symbol}
        </text>
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
