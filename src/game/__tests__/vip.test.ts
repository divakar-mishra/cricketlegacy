import { MONTHLY_PASS_CONTENT } from '../../data/seasonPassContent';
import { runMigrations } from '../../storage/migrate';
import {
  activateSeasonPass,
  isSeasonPassActive,
  synchronizeSeasonPassState,
  activateSeasonPassScenario,
  recordSeasonPassScenarioMatch,
  claimSeasonPassScenarioReward,
} from '../seasonPass';
import {
  chooseVipCollection,
  claimVipCollection,
  collectionItems,
  ensureVipState,
  grantModeVip,
  grantRetirementCollections,
  hasModeVip,
  settleVipSeason,
} from '../vip';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';
import { ensureManagerDepth } from '../manager';

describe('mode-specific permanent VIP collections', () => {
  it('treats legacy saves without entitlements as not owning VIP', () => {
    const save = makeCareerSave();
    delete (save as Partial<typeof save>).entitlements;
    expect(hasModeVip(save)).toBe(false);
    expect(() => runMigrations(save)).not.toThrow();
  });
  const first = MONTHLY_PASS_CONTENT[0],
    second = MONTHLY_PASS_CONTENT[1];
  it.each(['career', 'manager'] as const)(
    'grants one chosen collection per settled %s season, exactly once',
    (mode) => {
      const save = mode === 'career' ? makeCareerSave() : makeManagerSave();
      grantModeVip(save, `${mode}_vip`);
      const wallet = { ...save.wallet };
      chooseVipCollection(save, first.id);
      expect(claimVipCollection(save).ok).toBe(false);
      settleVipSeason(save, 'completed-1');
      settleVipSeason(save, 'completed-1');
      expect(save.vipCollections?.credits).toBe(1);
      expect(claimVipCollection(save)).toEqual({ ok: true, items: collectionItems(mode, first) });
      expect(claimVipCollection(save).ok).toBe(false);
      expect(save.wallet).toEqual(wallet);
      expect(
        save.inventory?.[mode === 'career' ? first.office.inventoryId : first.kit.id],
      ).toBeUndefined();
    },
  );
  it('retains credits and choices across collection switching, clock changes and reloads', () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    settleVipSeason(save, 'season-1');
    chooseVipCollection(save, first.id);
    chooseVipCollection(save, second.id);
    synchronizeSeasonPassState(save, Date.UTC(2030, 0, 1));
    const loaded = JSON.parse(JSON.stringify(save));
    synchronizeSeasonPassState(loaded, Date.UTC(2032, 6, 1));
    expect(loaded.vipCollections).toEqual(save.vipCollections);
    expect(claimVipCollection(loaded).items).toContain(second.kit.id);
    expect(hasModeVip(loaded)).toBe(true);
  });
  it('allows all twelve collections to be earned, without an additional purchase', () => {
    const save = makeManagerSave();
    grantModeVip(save, 'manager_vip');
    MONTHLY_PASS_CONTENT.forEach((content, index) => {
      settleVipSeason(save, `season-${index}`);
      chooseVipCollection(save, content.id);
      expect(claimVipCollection(save).ok).toBe(true);
    });
    settleVipSeason(save, 'extra');
    expect(save.vipCollections?.owned).toHaveLength(12);
    expect(save.vipCollections?.credits).toBe(0);
  });
  it('catches up every remaining Player cosmetic at retirement, never consumables', () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    const wallet = { ...save.wallet };
    grantRetirementCollections(save);
    grantRetirementCollections(save);
    expect(save.vipCollections?.owned).toHaveLength(12);
    expect(save.wallet).toEqual(wallet);
    expect(Object.keys(save.inventory ?? {}).some((id) => /crate|token/.test(id))).toBe(false);
    expect(save.inventory?.[first.office.inventoryId]).toBeUndefined();
  });
  it('supports buying either mode VIP after retirement without cross-mode cosmetics', () => {
    const player = makeCareerSave();
    player.flags.retired = true;
    grantModeVip(player, 'player_vip');
    expect(player.vipCollections?.owned).toHaveLength(12);
    const manager = makeManagerSave();
    manager.managerRetired = true;
    grantModeVip(manager, 'manager_vip');
    grantRetirementCollections(manager);
    expect(manager.vipCollections?.owned).toHaveLength(12);
    expect(manager.inventory?.[first.kit.id]).toBeUndefined();
    expect(manager.inventory?.[first.celebration.id]).toBeUndefined();
  });
  it('settles Manager retirement at the existing age boundary without replaying currency', () => {
    const manager = makeManagerSave();
    manager.managerAge = 59;
    grantModeVip(manager, 'manager_legend_pack');
    ensureManagerDepth(manager);
    expect(manager.vipCollections?.owned).toHaveLength(0);
    const wallet = { ...manager.wallet };
    manager.managerAge = 60;
    ensureManagerDepth(manager);
    ensureManagerDepth(manager);
    expect(manager.managerRetired).toBe(true);
    expect(manager.vipCollections?.owned).toHaveLength(12);
    expect(manager.wallet).toEqual(wallet);
  });
  it('never grants Manager Legacy VIP to Player mode', () => {
    const player = makeCareerSave();
    grantModeVip(player, 'manager_legend_pack');
    expect(hasModeVip(player)).toBe(false);
  });
  it('does not grant VIP collection rewards to a free player or an expired subscriber', () => {
    const save = makeCareerSave();
    ensureVipState(save);
    settleVipSeason(save, 'free-season');
    expect(save.vipCollections?.credits).toBe(0);
    expect(chooseVipCollection(save, first.id).ok).toBe(false);
    grantRetirementCollections(save);
    expect(save.vipCollections?.owned).toHaveLength(0);
  });
  it('migrates legacy VIP in its original mode without losing inventory or balances', () => {
    const save = makeCareerSave();
    save.schemaVersion = 43;
    save.entitlements.removeAds = true;
    save.inventory = { old_unknown_item: 2, [first.kit.id]: 1 };
    const wallet = { ...save.wallet };
    const migrated = runMigrations(save)!;
    expect(migrated.schemaVersion).toBe(44);
    expect(hasModeVip(migrated)).toBe(true);
    expect(migrated.inventory).toEqual({ old_unknown_item: 2, [first.kit.id]: 1 });
    expect(migrated.wallet).toEqual(wallet);
  });
  it('cannot carry Player VIP into Manager mode', () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    grantRetirementCollections(save);
    save.mode = 'manager';
    ensureVipState(save);
    expect(hasModeVip(save)).toBe(false);
    expect(save.entitlements.removeAds).toBe(false);
    expect(save.vipCollections?.owned).toHaveLength(0);
  });
  it('keeps the new VIP out of the retired paid tier ladder while preserving legacy access', () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    const now = Date.UTC(2026, 8, 8);
    synchronizeSeasonPassState(save, now);
    expect(isSeasonPassActive(save, now)).toBe(true);
    expect(save.pass?.premium).toBe(false);
    activateSeasonPass(save, { now, provider: 'REVENUECAT' });
    expect(save.pass?.premium).toBe(true);
    synchronizeSeasonPassState(save, now + 40 * 86400000);
    expect(save.pass?.premium).toBe(false);
    expect(hasModeVip(save)).toBe(true);
  });
  it('does not reset VIP challenge claims at a real-world month boundary', () => {
    const save = makeCareerSave();
    grantModeVip(save, 'player_vip');
    chooseVipCollection(save, first.id);
    const now = Date.UTC(2026, 8, 8);
    expect(activateSeasonPassScenario(save, first.scenario.id, now).ok).toBe(true);
    for (let i = 0; i < first.scenario.targetMatches; i++)
      recordSeasonPassScenarioMatch(save, { won: true, runs: 40, wickets: 2 }, now);
    expect(claimSeasonPassScenarioReward(save, first.scenario.id, now).ok).toBe(true);
    synchronizeSeasonPassState(save, now + 40 * 86400000);
    expect(claimSeasonPassScenarioReward(save, first.scenario.id, now + 40 * 86400000).ok).toBe(
      false,
    );
  });
});
