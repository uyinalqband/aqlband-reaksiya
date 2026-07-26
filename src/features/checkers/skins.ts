export type CheckersSkinId =
  | 'classic'
  | 'butterfly'
  | 'dragon'
  | 'obsidian';

export interface CheckersSkin {
  id: CheckersSkinId;
  nameKey: string;
  descriptionKey: string;
  emoji: string;
  requiredLevel: number;
  board: {
    light: string;
    dark: string;
    frame: string;
    ringOffset: string;
  };
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
 * Board skins are independent from piece skins. During a match the board uses
 * only the black-side player's selection.
 *
 * Add future board skins here and register the same id/level in the next
 * database migration.
 */
export const CHECKERS_SKINS: readonly CheckersSkin[] = [
  {
    id: 'classic',
    nameKey: 'skins.items.classic.name',
    descriptionKey: 'skins.items.classic.description',
    emoji: '♟️',
    requiredLevel: 1,
    board: {
      light: 'linear-gradient(145deg, #d9e5f1 0%, #9fb2c7 100%)',
      dark: 'linear-gradient(145deg, #3b5777 0%, #20364f 100%)',
      frame: 'linear-gradient(145deg, #354d69 0%, #111e2e 52%, #070d15 100%)',
      ringOffset: '#253d58',
    },
  },
  {
    id: 'butterfly',
    nameKey: 'skins.items.butterfly.name',
    descriptionKey: 'skins.items.butterfly.description',
    emoji: '🦋',
    requiredLevel: 5,
    board: {
      light: 'linear-gradient(145deg, #f1e9ff 0%, #d8caef 100%)',
      dark: 'linear-gradient(145deg, #7454a9 0%, #543887 100%)',
      frame: 'linear-gradient(145deg, #4e347e 0%, #201735 55%, #0c0914 100%)',
      ringOffset: '#5d4090',
    },
  },
  {
    id: 'dragon',
    nameKey: 'skins.items.dragon.name',
    descriptionKey: 'skins.items.dragon.description',
    emoji: '🐉',
    requiredLevel: 10,
    board: {
      light: 'linear-gradient(145deg, #f0f3f7 0%, #c9cfd8 100%)',
      dark: 'linear-gradient(145deg, #363a42 0%, #24272e 100%)',
      frame: 'linear-gradient(145deg, #353940 0%, #15171b 58%, #090a0d 100%)',
      ringOffset: '#2b2e35',
    },
  },
  {
    id: 'obsidian',
    nameKey: 'skins.items.obsidian.name',
    descriptionKey: 'skins.items.obsidian.description',
    emoji: '💎',
    requiredLevel: 20,
    board: {
      light: 'linear-gradient(145deg, #d8d1dc 0%, #a9a0af 100%)',
      dark: 'linear-gradient(145deg, #533244 0%, #2c1b29 100%)',
      frame: 'linear-gradient(145deg, #4b2a3d 0%, #1b111b 55%, #09070b 100%)',
      ringOffset: '#422638',
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
