import type { GameMode, SaveGame } from '../domain/types';
import { MONTHLY_PASS_CONTENT, type MonthlyPassContent } from '../data/seasonPassContent';

export const VIP_PRODUCT_IDS = { career: 'player_vip', manager: 'manager_vip' } as const;
export const vipProductId = (mode: GameMode) => VIP_PRODUCT_IDS[mode];
export const vipTitle = (mode: GameMode) => (mode === 'career' ? 'Player VIP' : 'Manager VIP');

export function hasModeVip(save: SaveGame | null | undefined): boolean {
  return Boolean(save?.entitlements?.modeVip?.owned && save.entitlements.modeVip.mode === save.mode);
}

export function collectionItems(mode: GameMode, content: MonthlyPassContent): string[] {
  return mode === 'career'
    ? [content.kit.id, content.celebration.id, content.collectible.id]
    : [content.office.inventoryId, content.collectible.id];
}

/** Forward-only migration: preserve old inventory, claims, money and timed access. */
export function ensureVipState(save: SaveGame): void {
  save.entitlements ??= { removeAds: false };
  if (!save.entitlements.modeVip && save.entitlements.removeAds) {
    save.entitlements.modeVip = { mode: save.mode, owned: true, source: 'legacy' };
  }
  save.vipCollections ??= {
    version: 1,
    mode: save.mode,
    owned: [],
    settledSeasons: [],
    credits: 0,
  };
  // A Player-to-Manager conversion must not transfer Player VIP or collection progress.
  if (save.vipCollections.mode !== save.mode) {
    save.vipCollections = {
      version: 1,
      mode: save.mode,
      owned: [],
      settledSeasons: [],
      credits: 0,
    };
  }
  if (save.entitlements.modeVip && save.entitlements.modeVip.mode !== save.mode) {
    save.entitlements.removeAds = false;
    save.vipEnergyBonusActive = false;
  }
  const state = save.vipCollections;
  for (const content of MONTHLY_PASS_CONTENT) {
    if (
      collectionItems(save.mode, content).every((id) => (save.inventory?.[id] ?? 0) > 0) &&
      !state.owned.includes(content.id)
    )
      state.owned.push(content.id);
  }
}

export function grantModeVip(save: SaveGame, source: string, accountId?: string): void {
  if ((source === 'player_vip' || source === 'bundle_legend') && save.mode !== 'career') return;
  if ((source === 'manager_vip' || source === 'manager_legend_pack') && save.mode !== 'manager') return;
  ensureVipState(save);
  save.entitlements.modeVip = { mode: save.mode, owned: true, source, accountId };
  save.entitlements.removeAds = true;
  save.vipEnergyBonusActive = true;
  if (source === 'bundle_legend') {
    save.inventory = {
      ...save.inventory,
      avatar_legend_frame: 1,
      kit_all_colors: 1,
      player_legend_bundle_owned: 1,
    };
  }
  if (
    save.mode === 'manager' ? save.managerRetired :
    (save.flags?.retired || (save.userPlayerId && save.players[save.userPlayerId]?.retired))
  ) {
    grantRetirementCollections(save);
  }
}

export function grantCollection(save: SaveGame, id: string): string[] {
  ensureVipState(save);
  const content = MONTHLY_PASS_CONTENT.find((item) => item.id === id);
  if (!content || save.vipCollections!.owned.includes(id)) return [];
  const items = collectionItems(save.mode, content);
  save.inventory = { ...save.inventory };
  for (const item of items) save.inventory[item] = Math.max(1, save.inventory[item] ?? 0);
  save.vipCollections!.owned.push(id);
  return items;
}

export function chooseVipCollection(save: SaveGame, id: string): { ok: boolean; reason?: string } {
  ensureVipState(save);
  if (!hasModeVip(save)) return { ok: false, reason: `Requires ${vipTitle(save.mode)}.` };
  if (!MONTHLY_PASS_CONTENT.some((item) => item.id === id))
    return { ok: false, reason: 'Unknown collection.' };
  save.vipCollections!.selectedId = id;
  return { ok: true };
}

export function claimVipCollection(save: SaveGame): {
  ok: boolean;
  items: string[];
  reason?: string;
} {
  ensureVipState(save);
  const state = save.vipCollections!;
  if (!hasModeVip(save))
    return { ok: false, items: [], reason: `Requires ${vipTitle(save.mode)}.` };
  if (!state.selectedId || state.credits < 1)
    return { ok: false, items: [], reason: 'Choose a collection and complete an in-game season.' };
  const items = grantCollection(save, state.selectedId);
  if (!items.length) return { ok: false, items: [], reason: 'Collection already owned.' };
  state.credits -= 1;
  state.selectedId = undefined;
  return { ok: true, items };
}

/** Called only at the canonical completed-season boundary; never from a screen clock. */
export function settleVipSeason(save: SaveGame, seasonId: string): void {
  ensureVipState(save);
  const state = save.vipCollections!;
  if (state.settledSeasons.includes(seasonId)) return;
  state.settledSeasons.push(seasonId);
  if (hasModeVip(save) && state.owned.length + state.credits < MONTHLY_PASS_CONTENT.length)
    state.credits += 1;
}

/** Cosmetic-only catch-up. Deliberately does not grant crates, tokens, coins or gems. */
export function grantRetirementCollections(save: SaveGame): void {
  ensureVipState(save);
  if (!hasModeVip(save)) return;
  for (const content of MONTHLY_PASS_CONTENT) grantCollection(save, content.id);
  save.vipCollections!.credits = 0;
  save.vipCollections!.selectedId = undefined;
}
