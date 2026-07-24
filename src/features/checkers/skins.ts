export type CheckersSkinId =
  | 'classic'
  | 'royal'
  | 'emerald'
  | 'obsidian';

export interface CheckersPiecePalette {
  background: string;
  borderColor: string;
  boxShadow: string;
  innerBorderColor: string;
  innerShadow: string;
  detailBorderColor: string;
  kingColor: string;
}

export interface CheckersSkinDefinition {
  id: CheckersSkinId;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  requiredLevel: number;
  price: {
    amount: number;
    currency: 'free' | 'coin' | 'star';
  };
  board: {
    frameBackground: string;
    frameBorderColor: string;
    lightSquare: string;
    darkSquare: string;
    ringOffset: string;
  };
  pieces: {
    white: CheckersPiecePalette;
    black: CheckersPiecePalette;
  };
}

export const DEFAULT_CHECKERS_SKIN_ID: CheckersSkinId = 'classic';

/**
 * Checkers appearance is data-driven. Add a complete theme pack here and to
 * the server-side access catalogue; board, both piece colours and kings will
 * automatically use it.
 */
export const CHECKERS_SKINS: readonly CheckersSkinDefinition[] = [
  {
    id: 'classic',
    nameKey: 'profile.skins.items.classic.name',
    descriptionKey: 'profile.skins.items.classic.description',
    icon: '♟️',
    requiredLevel: 1,
    price: { amount: 0, currency: 'free' },
    board: {
      frameBackground:
        'linear-gradient(135deg, #293D57 0%, #101B2B 52%, #070D15 100%)',
      frameBorderColor: 'rgba(175, 192, 213, .28)',
      lightSquare: 'linear-gradient(135deg, #AFC0D5 0%, #8296AD 100%)',
      darkSquare: 'linear-gradient(135deg, #304965 0%, #1D3048 100%)',
      ringOffset: '#243A55',
    },
    pieces: {
      white: {
        background:
          'linear-gradient(135deg, #FFFFFF 0%, #DDE8F3 52%, #8FA4BA 100%)',
        borderColor: 'rgba(255,255,255,.8)',
        boxShadow:
          'inset -5px -7px 10px rgba(45,67,91,.35), inset 4px 4px 8px rgba(255,255,255,.9), 0 7px 12px rgba(0,0,0,.42)',
        innerBorderColor: 'rgba(132,152,174,.45)',
        innerShadow: 'inset 0 2px 4px rgba(255,255,255,.8)',
        detailBorderColor: 'rgba(110,129,152,.3)',
        kingColor: '#526A84',
      },
      black: {
        background:
          'linear-gradient(135deg, #4B5B70 0%, #172234 52%, #05090F 100%)',
        borderColor: '#59677A',
        boxShadow:
          'inset -5px -7px 10px rgba(0,0,0,.72), inset 4px 4px 8px rgba(153,176,205,.25), 0 7px 12px rgba(0,0,0,.55)',
        innerBorderColor: 'rgba(133,150,170,.25)',
        innerShadow: 'inset 0 2px 5px rgba(255,255,255,.12)',
        detailBorderColor: 'rgba(175,194,216,.15)',
        kingColor: '#D8E5F2',
      },
    },
  },
  {
    id: 'royal',
    nameKey: 'profile.skins.items.royal.name',
    descriptionKey: 'profile.skins.items.royal.description',
    icon: '👑',
    requiredLevel: 5,
    price: { amount: 0, currency: 'free' },
    board: {
      frameBackground:
        'linear-gradient(135deg, #6C3F18 0%, #2A170B 52%, #100905 100%)',
      frameBorderColor: 'rgba(250, 204, 96, .48)',
      lightSquare: 'linear-gradient(135deg, #F3D9A0 0%, #C99A54 100%)',
      darkSquare: 'linear-gradient(135deg, #8A3D32 0%, #4B171A 100%)',
      ringOffset: '#5B2D20',
    },
    pieces: {
      white: {
        background:
          'linear-gradient(135deg, #FFF8DD 0%, #ECD89A 52%, #B98736 100%)',
        borderColor: '#FFF1B8',
        boxShadow:
          'inset -5px -7px 10px rgba(113,65,12,.34), inset 4px 4px 8px rgba(255,255,255,.82), 0 7px 12px rgba(36,14,2,.48)',
        innerBorderColor: 'rgba(156,103,31,.5)',
        innerShadow: 'inset 0 2px 4px rgba(255,255,255,.7)',
        detailBorderColor: 'rgba(128,74,14,.34)',
        kingColor: '#8A5312',
      },
      black: {
        background:
          'linear-gradient(135deg, #A84845 0%, #53151E 52%, #21070D 100%)',
        borderColor: '#D47A69',
        boxShadow:
          'inset -5px -7px 10px rgba(32,3,8,.72), inset 4px 4px 8px rgba(255,170,138,.2), 0 7px 12px rgba(24,4,6,.58)',
        innerBorderColor: 'rgba(245,166,126,.32)',
        innerShadow: 'inset 0 2px 5px rgba(255,220,187,.13)',
        detailBorderColor: 'rgba(250,194,131,.18)',
        kingColor: '#FFD878',
      },
    },
  },
  {
    id: 'emerald',
    nameKey: 'profile.skins.items.emerald.name',
    descriptionKey: 'profile.skins.items.emerald.description',
    icon: '💎',
    requiredLevel: 10,
    price: { amount: 0, currency: 'free' },
    board: {
      frameBackground:
        'linear-gradient(135deg, #0A5B4D 0%, #063229 52%, #021712 100%)',
      frameBorderColor: 'rgba(92, 240, 192, .42)',
      lightSquare: 'linear-gradient(135deg, #DDF1D3 0%, #98C794 100%)',
      darkSquare: 'linear-gradient(135deg, #187A67 0%, #075044 100%)',
      ringOffset: '#0B5D50',
    },
    pieces: {
      white: {
        background:
          'linear-gradient(135deg, #FFFFFF 0%, #D9F3E8 50%, #86BFAE 100%)',
        borderColor: '#E8FFF8',
        boxShadow:
          'inset -5px -7px 10px rgba(19,91,70,.3), inset 4px 4px 8px rgba(255,255,255,.88), 0 7px 12px rgba(0,36,26,.46)',
        innerBorderColor: 'rgba(56,143,116,.42)',
        innerShadow: 'inset 0 2px 4px rgba(255,255,255,.78)',
        detailBorderColor: 'rgba(31,113,88,.28)',
        kingColor: '#176B56',
      },
      black: {
        background:
          'linear-gradient(135deg, #2E8B75 0%, #073F35 50%, #011B16 100%)',
        borderColor: '#47B89B',
        boxShadow:
          'inset -5px -7px 10px rgba(0,22,17,.74), inset 4px 4px 8px rgba(114,255,216,.18), 0 7px 12px rgba(0,24,18,.6)',
        innerBorderColor: 'rgba(118,240,207,.3)',
        innerShadow: 'inset 0 2px 5px rgba(210,255,243,.13)',
        detailBorderColor: 'rgba(169,255,232,.16)',
        kingColor: '#A7FFE6',
      },
    },
  },
  {
    id: 'obsidian',
    nameKey: 'profile.skins.items.obsidian.name',
    descriptionKey: 'profile.skins.items.obsidian.description',
    icon: '🌋',
    requiredLevel: 20,
    price: { amount: 0, currency: 'free' },
    board: {
      frameBackground:
        'linear-gradient(135deg, #4B2635 0%, #17141C 52%, #050509 100%)',
      frameBorderColor: 'rgba(236, 99, 121, .45)',
      lightSquare: 'linear-gradient(135deg, #D7D5DD 0%, #8A8792 100%)',
      darkSquare: 'linear-gradient(135deg, #4D4655 0%, #24212A 100%)',
      ringOffset: '#332B39',
    },
    pieces: {
      white: {
        background:
          'linear-gradient(135deg, #FFFFFF 0%, #E1DEE7 48%, #8D8998 100%)',
        borderColor: '#FFFFFF',
        boxShadow:
          'inset -5px -7px 10px rgba(63,57,75,.36), inset 4px 4px 8px rgba(255,255,255,.92), 0 7px 13px rgba(0,0,0,.5)',
        innerBorderColor: 'rgba(93,86,108,.48)',
        innerShadow: 'inset 0 2px 4px rgba(255,255,255,.84)',
        detailBorderColor: 'rgba(72,65,85,.32)',
        kingColor: '#5C526B',
      },
      black: {
        background:
          'linear-gradient(135deg, #4C4654 0%, #17151D 48%, #020204 100%)',
        borderColor: '#7D7188',
        boxShadow:
          'inset -5px -7px 10px rgba(0,0,0,.82), inset 4px 4px 8px rgba(210,189,226,.18), 0 7px 13px rgba(0,0,0,.68)',
        innerBorderColor: 'rgba(220,197,236,.25)',
        innerShadow: 'inset 0 2px 5px rgba(255,255,255,.1)',
        detailBorderColor: 'rgba(240,217,255,.14)',
        kingColor: '#FF6D83',
      },
    },
  },
] as const;

export function isCheckersSkinId(value: unknown): value is CheckersSkinId {
  return CHECKERS_SKINS.some((skin) => skin.id === value);
}

export function getCheckersSkin(
  skinId: unknown,
): CheckersSkinDefinition {
  return (
    CHECKERS_SKINS.find((skin) => skin.id === skinId) ??
    CHECKERS_SKINS[0]
  );
}

export interface CheckersAppearance {
  selectedSkinId: CheckersSkinId;
  level: number;
  unlockedSkinIds: CheckersSkinId[];
}
