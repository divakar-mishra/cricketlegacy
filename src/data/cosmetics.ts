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
  /** Code-native preview used by the cosmetics picker. */
  previewIcon?: string;
  /** Accent colour paired with {@link previewIcon}. */
  previewAccent?: string;
  gemCost: number; // 0 = free
  passExclusive?: boolean;
}

const CELEBRATION_VISUALS: Readonly<
  Record<string, Pick<CosmeticOption, 'previewIcon' | 'previewAccent'>>
> = {
  cel_wave: { previewIcon: 'hand-left-outline', previewAccent: '#5DADE2' },
  cel_fist: { previewIcon: 'fitness-outline', previewAccent: '#E8B332' },
  cel_helmet: { previewIcon: 'shield-half-outline', previewAccent: '#E5484D' },
  cel_sky: { previewIcon: 'arrow-up-circle-outline', previewAccent: '#4C9AFF' },
  cel_dance: { previewIcon: 'musical-notes-outline', previewAccent: '#D95FCE' },
  cel_legend: { previewIcon: 'walk-outline', previewAccent: '#30D070' },
  pass_celebration_lights: { previewIcon: 'flashlight-outline', previewAccent: '#F5CF65' },
  pass_celebration_rainmaker: { previewIcon: 'water-outline', previewAccent: '#36C6B0' },
  pass_celebration_wave: { previewIcon: 'water-outline', previewAccent: '#50B7C5' },
  pass_celebration_crest: { previewIcon: 'shield-outline', previewAccent: '#D5B56D' },
  pass_celebration_pulse: { previewIcon: 'pulse-outline', previewAccent: '#5DADE2' },
  pass_celebration_ice: { previewIcon: 'snow-outline', previewAccent: '#8FB8D8' },
  pass_celebration_crown: { previewIcon: 'trophy-outline', previewAccent: '#E1B94F' },
  pass_celebration_startrail: { previewIcon: 'star-outline', previewAccent: '#9D86E8' },
  pass_celebration_dust: { previewIcon: 'cloud-outline', previewAccent: '#E36A54' },
  pass_celebration_lightsout: { previewIcon: 'moon-outline', previewAccent: '#777EE8' },
  pass_celebration_fireworks: { previewIcon: 'sparkles-outline', previewAccent: '#F07EC2' },
  pass_celebration_numberone: { previewIcon: 'medal-outline', previewAccent: '#E6C75C' },
  pass_celebration_legacy: { previewIcon: 'ribbon-outline', previewAccent: '#C59758' },
};

function withCelebrationVisual(option: CosmeticOption): CosmeticOption {
  return { ...option, ...CELEBRATION_VISUALS[option.id] };
}

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
  withCelebrationVisual({ id: 'cel_wave', label: 'Classic Wave', preview: '👋', gemCost: 0 }),
  withCelebrationVisual({ id: 'cel_fist', label: 'Fist Pump', preview: '✊', gemCost: 0 }),
  withCelebrationVisual({ id: 'cel_helmet', label: 'Helmet Off', preview: '⛑️', gemCost: 30 }),
  withCelebrationVisual({ id: 'cel_sky', label: 'Sky Salute', preview: '☝️', gemCost: 50 }),
  withCelebrationVisual({ id: 'cel_dance', label: 'Victory Dance', preview: '💃', gemCost: 70 }),
  withCelebrationVisual({ id: 'cel_legend', label: 'Legend Walk', preview: '🚶‍♂️', gemCost: 100 }),
  withCelebrationVisual({
    id: 'pass_celebration_lights',
    label: 'Floodlight Salute',
    preview: '✦',
    gemCost: 0,
    passExclusive: true,
  }),
  ...MONTHLY_PASS_CONTENT.map((content) =>
    withCelebrationVisual({
      id: content.celebration.id,
      label: content.celebration.label,
      preview: content.celebration.preview,
      gemCost: 0,
      passExclusive: true,
    }),
  ),
];

const ALL_COSMETICS: CosmeticOption[] = [...KIT_COLORS, ...CELEBRATIONS];

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

/** Bundle ownership covers standard kits, never unclaimed Pass rewards. */
export function ownsCosmetic(inventory: Record<string, number> | undefined, id: string): boolean {
  if ((inventory?.[id] ?? 0) > 0) return true;
  return (inventory?.kit_all_colors ?? 0) > 0 &&
    KIT_COLORS.some((kit) => kit.id === id && !kit.passExclusive);
}

export const PROFILE_FRAMES = [
  { id: 'frame_none', label: 'Classic', color: '#24D63B' },
  { id: 'frame_gold', label: 'Legend Gold', color: '#E8B52F' },
  { id: 'frame_vip', label: 'VIP Streak', color: '#A68BFA' },
] as const;

export function ownsProfileFrame(inventory: Record<string, number> | undefined, id: string): boolean {
  if (id === 'frame_none') return true;
  if (id === 'frame_gold') return (inventory?.avatar_legend_frame ?? 0) > 0 ||
    (inventory?.pass_frame_gold ?? 0) > 0;
  return id === 'frame_vip' && (inventory?.avatar_legend_vip ?? 0) > 0;
}

export type KitPattern = 'classic' | 'chevron' | 'sash' | 'pinstripe' | 'hoops' | 'split' | 'lightning';
const KIT_PATTERNS: readonly KitPattern[] = ['chevron', 'sash', 'pinstripe', 'hoops', 'split', 'lightning'];
export function kitDesign(id?: string): { pattern: KitPattern; trim: string } {
  const index = KIT_COLORS.findIndex((kit) => kit.id === id);
  if (index <= 0) return { pattern: 'classic', trim: '#234C39' };
  return {
    pattern: KIT_PATTERNS[(index - 1) % KIT_PATTERNS.length],
    trim: KIT_COLORS[index].passExclusive ? '#F3CE72' : '#E9E4D5',
  };
}
