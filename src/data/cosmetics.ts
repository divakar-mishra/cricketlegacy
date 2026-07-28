import { MONTHLY_PASS_CONTENT } from './seasonPassContent';

/**
 * Player cosmetic catalog — shared source of truth for the cosmetics editor
 * (PlayerCosmeticsScreen) and anywhere the equipped look is rendered (e.g. the
 * user's PlayerAvatar). Ids are persisted in `save.cosmetics` and owned premium
 * ids live in `save.inventory`.
 */
export interface CosmeticOption {
  id: string;
  label: string;
  preview: string; // emoji, or a hex colour for kits
  gemCost: number; // 0 = free
  passExclusive?: boolean;
}

export const AVATAR_OPTIONS: CosmeticOption[] = [
  { id: 'avatar_default', label: 'Classic', preview: '🧑', gemCost: 0 },
  { id: 'avatar_cap', label: 'Cap & Gloves', preview: '🧢', gemCost: 0 },
  { id: 'avatar_helmet', label: 'Batting Helmet', preview: '⛑️', gemCost: 40 },
  { id: 'avatar_star', label: 'Star Player', preview: '🌟', gemCost: 80 },
  { id: 'avatar_legend', label: 'Legend', preview: '👑', gemCost: 120 },
];

export const KIT_COLORS: CosmeticOption[] = [
  { id: 'kit_white', label: 'Classic White', preview: '#F7F7F7', gemCost: 0 },
  { id: 'kit_blue', label: 'Navy Blue', preview: '#1A3A7C', gemCost: 0 },
  { id: 'kit_green', label: 'Forest Green', preview: '#1F7C40', gemCost: 40 },
  { id: 'kit_gold', label: 'Championship Gold', preview: '#C6902A', gemCost: 60 },
  { id: 'kit_red', label: 'Power Red', preview: '#C4362B', gemCost: 60 },
  { id: 'kit_purple', label: 'Royal Purple', preview: '#6B2FA0', gemCost: 80 },
  { id: 'kit_black', label: 'Midnight Black', preview: '#1A1A1A', gemCost: 100 },
  { id: 'kit_orange', label: 'Blaze Orange', preview: '#E86910', gemCost: 80 },
  {
    id: 'pass_kit_noir',
    label: 'Stadium Noir',
    preview: '#0B100D',
    gemCost: 0,
    passExclusive: true,
  },
  ...MONTHLY_PASS_CONTENT.map((content) => ({
    id: content.kit.id,
    label: content.kit.label,
    preview: content.kit.color,
    gemCost: 0,
    passExclusive: true,
  })),
];

export const CELEBRATIONS: CosmeticOption[] = [
  { id: 'cel_wave', label: 'Classic Wave', preview: '👋', gemCost: 0 },
  { id: 'cel_fist', label: 'Fist Pump', preview: '✊', gemCost: 0 },
  { id: 'cel_helmet', label: 'Helmet Off', preview: '⛑️', gemCost: 30 },
  { id: 'cel_sky', label: 'Sky Salute', preview: '☝️', gemCost: 50 },
  { id: 'cel_dance', label: 'Victory Dance', preview: '💃', gemCost: 70 },
  { id: 'cel_legend', label: 'Legend Walk', preview: '🚶‍♂️', gemCost: 100 },
  {
    id: 'pass_celebration_lights',
    label: 'Floodlight Salute',
    preview: '✦',
    gemCost: 0,
    passExclusive: true,
  },
  ...MONTHLY_PASS_CONTENT.map((content) => ({
    id: content.celebration.id,
    label: content.celebration.label,
    preview: content.celebration.preview,
    gemCost: 0,
    passExclusive: true,
  })),
];

const ALL_COSMETICS: CosmeticOption[] = [...AVATAR_OPTIONS, ...KIT_COLORS, ...CELEBRATIONS];

/** Gem cost of a cosmetic id (0 for free/unknown). */
export function cosmeticCost(id: string): number {
  return ALL_COSMETICS.find((o) => o.id === id)?.gemCost ?? 0;
}

export function isPassExclusiveCosmetic(id: string): boolean {
  return ALL_COSMETICS.some((option) => option.id === id && option.passExclusive);
}

/** Hex colour for an equipped kit id, or undefined for the default/unknown. */
export function kitColorHex(id?: string): string | undefined {
  if (!id) return undefined;
  return KIT_COLORS.find((k) => k.id === id)?.preview;
}

/** Emoji preview for an equipped avatar id. */
export function avatarEmoji(id?: string): string | undefined {
  if (!id) return undefined;
  return AVATAR_OPTIONS.find((a) => a.id === id)?.preview;
}

/** The equipped celebration option (emoji + label). */
export function celebrationOption(id?: string): CosmeticOption | undefined {
  if (!id) return undefined;
  return CELEBRATIONS.find((c) => c.id === id);
}
