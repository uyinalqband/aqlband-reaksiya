export type CheckersSkinId =
  | 'classic'
  | 'butterfly'
  | 'dragon'
  | 'obsidian';

export type CheckersSkinMotif =
  | 'rings'
  | 'butterfly'
  | 'dragon'
  | 'gem';

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

export interface CheckersSkin {
  id: CheckersSkinId;
  nameKey: string;
  descriptionKey: string;
  emoji: string;
  requiredLevel: number;
  motif: CheckersSkinMotif;
  board: {
    light: string;
    dark: string;
    frame: string;
    ringOffset: string;
  };
  pieces: Record<CheckersPieceSide, CheckersPiecePalette>;
}

/**
 * Legacy platform API response shape.
 *
 * The profile screen now reads the selected skin from the account snapshot,
 * but checkersPlatformService still exposes these API helpers. Keeping this
 * type exported preserves that service's TypeScript contract.
 */
export interface CheckersAppearance {
  selectedSkinId: CheckersSkinId;
  level: number;
  unlockedSkinIds: CheckersSkinId[];
}

/**
 * A skin pack owns one board palette and one two-sided piece design.
 *
 * Match rule:
 * - white pieces use the white player's selected pack;
 * - black pieces use the black player's selected pack;
 * - the board uses only the black player's selected pack.
 *
 * Add future skins here and register the same id/level in the next database
 * migration. Rendering is motif-driven, so a new color variant needs no game
 * screen changes.
 */
export const CHECKERS_SKINS: readonly CheckersSkin[] = [
  {
    id: 'classic',
    nameKey: 'skins.items.classic.name',
    descriptionKey: 'skins.items.classic.description',
    emoji: '♟️',
    requiredLevel: 1,
    motif: 'rings',
    board: {
      light: 'linear-gradient(145deg, #d9e5f1 0%, #9fb2c7 100%)',
      dark: 'linear-gradient(145deg, #3b5777 0%, #20364f 100%)',
      frame: 'linear-gradient(145deg, #354d69 0%, #111e2e 52%, #070d15 100%)',
      ringOffset: '#253d58',
    },
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
    id: 'butterfly',
    nameKey: 'skins.items.butterfly.name',
    descriptionKey: 'skins.items.butterfly.description',
    emoji: '🦋',
    requiredLevel: 5,
    motif: 'butterfly',
    board: {
      light: 'linear-gradient(145deg, #f1e9ff 0%, #d8caef 100%)',
      dark: 'linear-gradient(145deg, #7454a9 0%, #543887 100%)',
      frame: 'linear-gradient(145deg, #4e347e 0%, #201735 55%, #0c0914 100%)',
      ringOffset: '#5d4090',
    },
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #ffffff 0%, #f3ecff 52%, #c9b9e7 100%)',
        border: '#f6efff',
        innerBorder: 'rgba(103,63,164,.34)',
        motifPrimary: '#7c3fe0',
        motifSecondary: '#b579ff',
        highlight: 'rgba(255,255,255,.95)',
        shadow: 'rgba(47,25,79,.42)',
      },
      black: {
        face: 'linear-gradient(145deg, #4b3a75 0%, #241842 51%, #10091e 100%)',
        border: '#7258a8',
        innerBorder: 'rgba(153,119,217,.35)',
        motifPrimary: '#39c4ff',
        motifSecondary: '#76e7ff',
        highlight: 'rgba(123,207,255,.32)',
        shadow: 'rgba(3,0,15,.76)',
      },
    },
  },
  {
    id: 'dragon',
    nameKey: 'skins.items.dragon.name',
    descriptionKey: 'skins.items.dragon.description',
    emoji: '🐉',
    requiredLevel: 10,
    motif: 'dragon',
    board: {
      light: 'linear-gradient(145deg, #f0f3f7 0%, #c9cfd8 100%)',
      dark: 'linear-gradient(145deg, #363a42 0%, #24272e 100%)',
      frame: 'linear-gradient(145deg, #353940 0%, #15171b 58%, #090a0d 100%)',
      ringOffset: '#2b2e35',
    },
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #ffffff 0%, #f2f3f5 55%, #c7cbd1 100%)',
        border: '#ffffff',
        innerBorder: 'rgba(93,97,105,.3)',
        motifPrimary: '#9f101d',
        motifSecondary: '#df2938',
        highlight: 'rgba(255,255,255,.96)',
        shadow: 'rgba(28,29,34,.4)',
      },
      black: {
        face: 'linear-gradient(145deg, #474b52 0%, #1b1d22 50%, #08090b 100%)',
        border: '#555a63',
        innerBorder: 'rgba(163,169,179,.24)',
        motifPrimary: '#c81524',
        motifSecondary: '#ff3a48',
        highlight: 'rgba(209,218,230,.2)',
        shadow: 'rgba(0,0,0,.78)',
      },
    },
  },
  {
    id: 'obsidian',
    nameKey: 'skins.items.obsidian.name',
    descriptionKey: 'skins.items.obsidian.description',
    emoji: '💎',
    requiredLevel: 20,
    motif: 'gem',
    board: {
      light: 'linear-gradient(145deg, #d8d1dc 0%, #a9a0af 100%)',
      dark: 'linear-gradient(145deg, #533244 0%, #2c1b29 100%)',
      frame: 'linear-gradient(145deg, #4b2a3d 0%, #1b111b 55%, #09070b 100%)',
      ringOffset: '#422638',
    },
    pieces: {
      white: {
        face: 'linear-gradient(145deg, #ffffff 0%, #e9e5ee 46%, #aaa1b2 100%)',
        border: '#fff7ff',
        innerBorder: 'rgba(82,49,80,.34)',
        motifPrimary: '#7d3cff',
        motifSecondary: '#e0b7ff',
        highlight: 'rgba(255,255,255,.96)',
        shadow: 'rgba(46,25,45,.46)',
      },
      black: {
        face: 'linear-gradient(145deg, #4d3e50 0%, #201722 50%, #080609 100%)',
        border: '#645268',
        innerBorder: 'rgba(205,166,224,.28)',
        motifPrimary: '#df77ff',
        motifSecondary: '#7a35ff',
        highlight: 'rgba(231,180,255,.24)',
        shadow: 'rgba(0,0,0,.8)',
      },
    },
  },
] as const;

const SKINS_BY_ID = new Map(
  CHECKERS_SKINS.map((skin) => [skin.id, skin]),
);

export function isCheckersSkinId(value: unknown): value is CheckersSkinId {
  return (
    typeof value === 'string' &&
    SKINS_BY_ID.has(value as CheckersSkinId)
  );
}

export function normalizeCheckersSkinId(value: unknown): CheckersSkinId {
  return isCheckersSkinId(value) ? value : 'classic';
}

export function getCheckersSkin(value: unknown): CheckersSkin {
  return SKINS_BY_ID.get(normalizeCheckersSkinId(value)) ?? CHECKERS_SKINS[0];
}

export function isCheckersSkinUnlocked(
  skin: CheckersSkin,
  level: number,
): boolean {
  return Math.max(1, Math.floor(level)) >= skin.requiredLevel;
}
