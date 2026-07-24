export type CheckersPieceSkinId =
  | 'classic'
  | 'flower'
  | 'wheel';

export type CheckersPieceSide = 'white' | 'black';

export interface CheckersPiecePalette {
  face: string;
  border: string;
  innerBorder: string;
  motifPrimary: string;
  motifSecondary: string;
  highlight: string;
  shadow: string;
}

export interface CheckersPieceSkin {
  id: CheckersPieceSkinId;
  nameKey: string;
  descriptionKey: string;
  emoji: string;
  requiredLevel: number;
  symbol: string | null;
  pieces: Record<CheckersPieceSide, CheckersPiecePalette>;
}

/**
 * Piece skins are intentionally independent from board skins. Each player
 * keeps this selection for their own colour, while the board is selected
 * separately and follows the black-side player during a match.
 */
export const CHECKERS_PIECE_SKINS: readonly CheckersPieceSkin[] = [
  {
    id: 'classic',
    nameKey: 'skins.pieceItems.classic.name',
    descriptionKey: 'skins.pieceItems.classic.description',
    emoji: '⚪',
    requiredLevel: 1,
    symbol: null,
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #ffffff 0%, #e8f0f8 43%, #9eb0c4 100%)',
        border: 'rgba(255,255,255,.88)',
        innerBorder: 'rgba(104,126,151,.44)',
        motifPrimary: '#60758d',
        motifSecondary: '#b8c8d8',
        highlight: 'rgba(255,255,255,.92)',
        shadow: 'rgba(22,35,51,.42)',
      },
      black: {
        face: 'linear-gradient(145deg, #52637a 0%, #172235 48%, #05090f 100%)',
        border: '#68788d',
        innerBorder: 'rgba(170,190,214,.25)',
        motifPrimary: '#d8e5f2',
        motifSecondary: '#73869d',
        highlight: 'rgba(191,211,236,.24)',
        shadow: 'rgba(0,0,0,.72)',
      },
    },
  },
  {
    id: 'flower',
    nameKey: 'skins.pieceItems.flower.name',
    descriptionKey: 'skins.pieceItems.flower.description',
    emoji: '🌸',
    requiredLevel: 2,
    symbol: '🌸',
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #fffdfd 0%, #ffe9f3 50%, #e8a9c4 100%)',
        border: '#fff7fb',
        innerBorder: 'rgba(186,75,127,.35)',
        motifPrimary: '#d75291',
        motifSecondary: '#ff9fc9',
        highlight: 'rgba(255,255,255,.96)',
        shadow: 'rgba(80,28,55,.4)',
      },
      black: {
        face: 'linear-gradient(145deg, #6b3554 0%, #30152a 52%, #110711 100%)',
        border: '#9b5578',
        innerBorder: 'rgba(255,174,213,.28)',
        motifPrimary: '#ff83bc',
        motifSecondary: '#ffd2e6',
        highlight: 'rgba(255,185,218,.24)',
        shadow: 'rgba(12,1,8,.78)',
      },
    },
  },
  {
    id: 'wheel',
    nameKey: 'skins.pieceItems.wheel.name',
    descriptionKey: 'skins.pieceItems.wheel.description',
    emoji: '🛞',
    requiredLevel: 2,
    symbol: '🛞',
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #ffffff 0%, #eef1f5 48%, #aeb5bf 100%)',
        border: '#ffffff',
        innerBorder: 'rgba(67,73,82,.38)',
        motifPrimary: '#3f454d',
        motifSecondary: '#aab1ba',
        highlight: 'rgba(255,255,255,.96)',
        shadow: 'rgba(24,27,31,.42)',
      },
      black: {
        face: 'linear-gradient(145deg, #4b4f55 0%, #1d1f23 50%, #08090a 100%)',
        border: '#656a72',
        innerBorder: 'rgba(190,197,207,.26)',
        motifPrimary: '#d2d7de',
        motifSecondary: '#707780',
        highlight: 'rgba(220,226,235,.2)',
        shadow: 'rgba(0,0,0,.82)',
      },
    },
  },
] as const;

const PIECE_SKINS_BY_ID = new Map(
  CHECKERS_PIECE_SKINS.map((skin) => [skin.id, skin]),
);

export function isCheckersPieceSkinId(
  value: unknown,
): value is CheckersPieceSkinId {
  return (
    typeof value === 'string' &&
    PIECE_SKINS_BY_ID.has(value as CheckersPieceSkinId)
  );
}

export function normalizeCheckersPieceSkinId(
  value: unknown,
): CheckersPieceSkinId {
  return isCheckersPieceSkinId(value) ? value : 'classic';
}

export function getCheckersPieceSkin(
  value: unknown,
): CheckersPieceSkin {
  return (
    PIECE_SKINS_BY_ID.get(normalizeCheckersPieceSkinId(value)) ??
    CHECKERS_PIECE_SKINS[0]
  );
}

export function isCheckersPieceSkinUnlocked(
  skin: CheckersPieceSkin,
  level: number,
): boolean {
  return Math.max(1, Math.floor(level)) >= skin.requiredLevel;
}
