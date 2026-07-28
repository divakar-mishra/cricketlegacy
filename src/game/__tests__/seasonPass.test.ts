import { PASS_TIERS } from '../liveops';
import {
  activateSeasonPass,
  activateSeasonPassScenario,
  claimMonthlyCosmeticDrop,
  claimSeasonPassScenarioReward,
  isSeasonPassActive,
  monthlyBundleForCycle,
  passSelectionMultiplier,
  passStaffSigningMultiplier,
  passSuperstarInterestBonus,
  passTrainingMultiplier,
  recordSeasonPassScenarioMatch,
  SEASON_PASS_PERIOD_MS,
  seasonPassPeriod,
  synchronizeSeasonPassState,
} from '../seasonPass';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('recurring Season Pass', () => {
  const now = Date.UTC(2026, 6, 22, 12);

  it('uses a 30-day cycle with an achievable tier-20 target', () => {
    const period = seasonPassPeriod(now);
    expect(period.endsAt - period.startsAt).toBe(SEASON_PASS_PERIOD_MS);
    expect(PASS_TIERS).toHaveLength(20);
    expect(PASS_TIERS[19].xpRequired).toBeLessThanOrEqual(5_000);
  });

  it('expires premium access and rejects a backwards-clock extension', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'REVENUECAT', expiresAt: now + SEASON_PASS_PERIOD_MS });
    expect(isSeasonPassActive(save, now + 1_000)).toBe(true);
    expect(isSeasonPassActive(save, now + SEASON_PASS_PERIOD_MS + 1)).toBe(false);
    expect(isSeasonPassActive(save, now - 10 * 60 * 1000)).toBe(false);
  });

  it('resets XP at the 30-day boundary without tying it to a career season', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK', expiresAt: now + SEASON_PASS_PERIOD_MS * 2 });
    save.pass!.xp = 1_900;
    save.pass!.claimedFree = [1, 2, 3];
    const firstCycle = save.pass!.seasonId;

    synchronizeSeasonPassState(save, save.pass!.periodEndsAt! + 1);

    expect(save.pass!.seasonId).not.toBe(firstCycle);
    expect(save.pass!.xp).toBe(0);
    expect(save.pass!.claimedFree).toEqual([]);
    expect(save.pass!.premium).toBe(true);
  });

  it('grants one permanent monthly cosmetic per cycle', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const first = claimMonthlyCosmeticDrop(save, now);
    const second = claimMonthlyCosmeticDrop(save, now);

    expect(first.ok).toBe(true);
    expect(first.items).toHaveLength(3);
    expect(first.rewardItem).toBeDefined();
    for (const item of [...first.items!, first.rewardItem!]) {
      expect(save.inventory?.[item]).toBe(1);
    }
    expect(second).toMatchObject({ ok: false });
  });

  it('ships twelve distinct bundles whose cosmetics and collectible never duplicate tier rewards', () => {
    const tierItems = new Set(PASS_TIERS.flatMap((tier) => [tier.freeReward.item, tier.premiumReward.item]).filter(Boolean));
    const bundleItemSets = Array.from({ length: 12 }, (_, index) => {
      const bundle = monthlyBundleForCycle(`pass-${index}`);
      const items = [bundle.kit.id, bundle.celebration.id, bundle.office.inventoryId, bundle.collectible.id];
      expect(items.every((item) => !tierItems.has(item))).toBe(true);
      return items.join('|');
    });
    expect(new Set(bundleItemSets).size).toBe(12);
  });

  it('tracks an exclusive scenario and grants its reward once', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const scenario = monthlyBundleForCycle(save.pass!.seasonId).scenario;
    expect(activateSeasonPassScenario(save, scenario.id, now).ok).toBe(true);

    for (let index = 0; index < scenario.targetMatches; index += 1) {
      recordSeasonPassScenarioMatch(save, { won: index < scenario.targetWins, runs: 0, wickets: 0 }, now);
    }
    const first = claimSeasonPassScenarioReward(save, scenario.id, now);
    const second = claimSeasonPassScenarioReward(save, scenario.id, now);

    expect(first).toMatchObject({
      ok: true,
      coins: scenario.rewardCoins,
      gems: scenario.rewardGems,
    });
    expect(second).toMatchObject({ ok: false, coins: 0, gems: 0 });
  });

  it('exposes only the featured scenario and resets its progress at the cycle boundary', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK', expiresAt: now + SEASON_PASS_PERIOD_MS * 2 });
    const current = monthlyBundleForCycle(save.pass!.seasonId).scenario;
    const unavailable = monthlyBundleForCycle(`pass-${Number(save.pass!.seasonId.replace(/\D/g, '')) + 1}`).scenario;

    expect(activateSeasonPassScenario(save, unavailable.id, now).ok).toBe(false);
    expect(activateSeasonPassScenario(save, current.id, now).ok).toBe(true);
    recordSeasonPassScenarioMatch(save, { won: true, runs: 0, wickets: 0 }, now);
    const nextCycle = save.pass!.periodEndsAt! + 1;
    synchronizeSeasonPassState(save, nextCycle);

    expect(save.seasonPassExperience?.scenarioCycleId).toBe(save.pass?.seasonId);
    expect(save.seasonPassExperience?.activeScenarioId).toBeUndefined();
    expect(save.seasonPassExperience?.scenarios).toEqual({});
  });

  it('restarts a failed featured-scenario attempt without carrying extra matches forward', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const scenario = monthlyBundleForCycle(save.pass!.seasonId).scenario;
    expect(activateSeasonPassScenario(save, scenario.id, now).ok).toBe(true);
    for (let index = 0; index < scenario.targetMatches; index += 1) {
      recordSeasonPassScenarioMatch(save, { won: false, runs: 0, wickets: 0 }, now);
    }

    expect(save.seasonPassExperience?.scenarios[scenario.id].completed).toBe(false);
    expect(activateSeasonPassScenario(save, scenario.id, now).ok).toBe(true);
    expect(save.seasonPassExperience?.scenarios[scenario.id].matches).toBe(0);
  });

  it('applies capped Player and Manager benefits only while active', () => {
    const player = makeCareerSave();
    const manager = makeManagerSave();
    activateSeasonPass(player, { now, provider: 'LOCAL_MOCK' });
    activateSeasonPass(manager, { now, provider: 'LOCAL_MOCK' });

    expect(passTrainingMultiplier(player, now)).toBe(1.1);
    expect(passSelectionMultiplier(player, 5, now)).toBe(1.05);
    expect(passSelectionMultiplier(player, -5, now)).toBe(1);
    expect(passSuperstarInterestBonus(manager, now)).toBe(0.04);
    expect(passStaffSigningMultiplier(manager, now)).toBe(0.95);
    expect(passTrainingMultiplier(player, now + SEASON_PASS_PERIOD_MS + 1)).toBe(1);
  });
});
