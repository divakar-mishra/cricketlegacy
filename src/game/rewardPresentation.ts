import { CELEBRATIONS, KIT_COLORS, ownsProfileFrame } from '../data/cosmetics';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import type { SaveGame } from '../domain/types';

export interface RewardPresentation {
  kind: 'kit' | 'celebration' | 'frame' | 'stadium' | 'office';
  label: string;
  equippedId: string;
}
/** Explicit catalogue mapping, never infer ownership or an equip target from display text. */
export function rewardPresentation(id: string): RewardPresentation | undefined {
  const kit = KIT_COLORS.find((item) => item.id === id);
  if (kit) return { kind: 'kit', label: kit.label, equippedId: id };
  const celebration = CELEBRATIONS.find((item) => item.id === id);
  if (celebration) return { kind: 'celebration', label: celebration.label, equippedId: id };
  if (id === 'pass_frame_gold' || id === 'avatar_legend_frame')
    return { kind: 'frame', label: 'Legend frame', equippedId: 'frame_gold' };
  if (id === 'avatar_legend_vip')
    return { kind: 'frame', label: 'VIP frame', equippedId: 'frame_vip' };
  if (id === 'pass_stadium_noir')
    return { kind: 'stadium', label: 'Stadium Noir', equippedId: 'stadium_noir' };
  if (id === 'pass_office_noir')
    return { kind: 'office', label: 'Executive Office', equippedId: 'office_noir' };
  const office = MONTHLY_PASS_CONTENT.find((item) => item.office.inventoryId === id)?.office;
  if (office) return { kind: 'office', label: office.label, equippedId: office.themeId };
  return undefined;
}

export function canEquipReward(save: SaveGame, id: string): boolean {
  const item = rewardPresentation(id);
  if (!item) return false;
  if (item.kind === 'office' && save.mode !== 'manager') return false;
  if (['kit', 'frame', 'celebration'].includes(item.kind) && save.mode !== 'career') return false;
  return item.kind === 'frame'
    ? ownsProfileFrame(save.inventory, item.equippedId)
    : (save.inventory?.[id] ?? 0) > 0;
}

export function isRewardEquipped(save: SaveGame, id: string): boolean {
  const item = rewardPresentation(id);
  if (!item || !canEquipReward(save, id)) return false;
  const equipped =
    item.kind === 'frame'
      ? (save.cosmetics?.profileFrame ?? save.cosmetics?.avatarConfig?.frameId)
      : item.kind === 'stadium'
        ? save.seasonPassExperience?.selectedStadiumTheme
        : item.kind === 'office'
          ? save.seasonPassExperience?.selectedOfficeTheme
          : save.cosmetics?.[item.kind];
  return equipped === item.equippedId;
}
