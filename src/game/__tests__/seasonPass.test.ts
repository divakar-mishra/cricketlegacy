import { addPassXp, PASS_TIERS, passTiersForMode } from '../liveops';
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
  SEASON_PASS_SCENARIOS,
  seasonPassPeriod,
  synchronizeSeasonPassState,
} from '../seasonPass';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('recurring Season Pass', () => {
  const now = Date.UTC(2026, 6, 22, 12);

  it('uses exact UTC calendar months with a month-long tier-20 target', () => {
    const period = seasonPassPeriod(now);
    expect(period).toEqual({
      id: 'pass-2026-07',
      startsAt: Date.UTC(2026, 6, 1),
      endsAt: Date.UTC(2026, 7, 1),
    });
    expect(PASS_TIERS).toHaveLength(20);
    expect(PASS_TIERS[19].xpRequired).toBe(11_020);
  });

  it('rolls over at 00:00 UTC on the first, including leap-year February', () => {
    const justBefore = Date.UTC(2028, 2, 1) - 1;
    expect(seasonPassPeriod(justBefore)).toEqual({
      id: 'pass-2028-02',
      startsAt: Date.UTC(2028, 1, 1),
      endsAt: Date.UTC(2028, 2, 1),
    });
    expect(seasonPassPeriod(justBefore + 1)).toEqual({
      id: 'pass-2028-03',
      startsAt: Date.UTC(2028, 2, 1),
      endsAt: Date.UTC(2028, 3, 1),
    });
  });

  it('expires premium access and rejects a backwards-clock extension', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, {
      now,
      provider: 'REVENUECAT',
      expiresAt: now + SEASON_PASS_PERIOD_MS,
    });
    expect(isSeasonPassActive(save, now + 1_000)).toBe(true);
    expect(isSeasonPassActive(save, now + SEASON_PASS_PERIOD_MS + 1)).toBe(false);
    expect(isSeasonPassActive(save, now - 10 * 60 * 1000)).toBe(false);
  });

  it('resets XP at the next UTC month without tying it to a career season', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, {
      now,
      provider: 'LOCAL_MOCK',
      expiresAt: now + SEASON_PASS_PERIOD_MS * 2,
    });
    save.pass!.xp = 1_900;
    save.pass!.claimedFree = [1, 2, 3];
    const firstCycle = save.pass!.seasonId;

    synchronizeSeasonPassState(save, save.pass!.periodEndsAt! + 1);

    expect(save.pass!.seasonId).not.toBe(firstCycle);
    expect(save.pass!.xp).toBe(0);
    expect(save.pass!.claimedFree).toEqual([]);
    expect(save.pass!.premium).toBe(true);
  });

  it('carries the active legacy rolling cycle into the calendar month without losing its tier', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, {
      now,
      provider: 'LOCAL_MOCK',
      expiresAt: now + SEASON_PASS_PERIOD_MS * 2,
    });
    save.pass = {
      seasonId: 'pass-6',
      periodStartedAt: Date.UTC(2026, 5, 30),
      periodEndsAt: Date.UTC(2026, 6, 30),
      balanceVersion: 1,
      xp: 80 * 11 + (16 * 10 * 11) / 2,
      premium: true,
      claimedFree: [1, 2, 11],
      claimedPremium: [1, 2, 11],
    };
    const scenarioId = monthlyBundleForCycle('pass-6').scenario.id;
    save.seasonPassExperience!.monthlyDropCycleId = 'pass-6';
    save.seasonPassExperience!.scenarioCycleId = 'pass-6';
    save.seasonPassExperience!.playerStoryCycleId = 'pass-6';
    save.seasonPassExperience!.managerStoryCycleId = 'pass-6';
    save.seasonPassExperience!.activeScenarioId = scenarioId;
    save.seasonPassExperience!.scenarios[scenarioId] = {
      id: scenarioId,
      matches: 1,
      wins: 1,
      runs: 0,
      wickets: 0,
      completed: false,
      rewardClaimed: false,
    };

    synchronizeSeasonPassState(save, now);

    expect(save.pass?.seasonId).toBe('pass-2026-07');
    expect(save.pass?.claimedFree).toEqual([1, 2, 11]);
    expect(save.pass?.xp).toBe(PASS_TIERS[10].xpRequired);
    expect(save.seasonPassExperience?.monthlyDropCycleId).toBe('pass-2026-07');
    expect(save.seasonPassExperience?.scenarioCycleId).toBe('pass-2026-07');
    expect(save.seasonPassExperience?.playerStoryCycleId).toBe('pass-2026-07');
    expect(save.seasonPassExperience?.managerStoryCycleId).toBe('pass-2026-07');
    expect(save.seasonPassExperience?.activeScenarioId).toBe(scenarioId);
    expect(save.seasonPassExperience?.scenarios[scenarioId].matches).toBe(1);
  });

  it('grants only Player-usable monthly cosmetics to a Player save', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const first = claimMonthlyCosmeticDrop(save, now);
    const second = claimMonthlyCosmeticDrop(save, now);

    expect(first.ok).toBe(true);
    expect(first.items).toHaveLength(2);
    expect(first.items).toEqual([
      monthlyBundleForCycle(save.pass!.seasonId).kit.id,
      monthlyBundleForCycle(save.pass!.seasonId).celebration.id,
    ]);
    expect(first.rewardItem).toBeDefined();
    for (const item of [...first.items!, first.rewardItem!]) {
      expect(save.inventory?.[item]).toBe(1);
    }
    expect(second).toMatchObject({ ok: false });
  });

  it('grants only the Manager office collection to a Manager save', () => {
    const save = makeManagerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const bundle = monthlyBundleForCycle(save.pass!.seasonId);

    const result = claimMonthlyCosmeticDrop(save, now);

    expect(result).toMatchObject({ ok: true, items: [bundle.office.inventoryId] });
    expect(save.inventory?.[bundle.office.inventoryId]).toBe(1);
    expect(save.inventory?.[bundle.kit.id]).toBeUndefined();
    expect(save.inventory?.[bundle.celebration.id]).toBeUndefined();
  });

  it('keeps tier XP and claims independent for every save', () => {
    const player = makeCareerSave();
    const manager = makeManagerSave();
    synchronizeSeasonPassState(player, now);
    synchronizeSeasonPassState(manager, now);

    player.pass = addPassXp(player.pass!, PASS_TIERS[4].xpRequired);
    player.pass.claimedFree = [1, 2];

    expect(player.pass.xp).toBe(PASS_TIERS[4].xpRequired);
    expect(manager.pass?.xp).toBe(0);
    expect(manager.pass?.claimedFree).toEqual([]);
    expect(manager.pass).not.toBe(player.pass);
  });

  it('keeps tier cosmetics usable by the save mode', () => {
    const playerItems = passTiersForMode('career')
      .map((tier) => tier.premiumReward.item)
      .filter(Boolean);
    const managerItems = passTiersForMode('manager')
      .map((tier) => tier.premiumReward.item)
      .filter(Boolean);

    expect(playerItems).toEqual([
      'pass_kit_noir',
      'pass_frame_gold',
      'pass_celebration_lights',
      'pass_stadium_noir',
    ]);
    expect(managerItems).toEqual(['pass_stadium_noir', 'pass_office_noir']);
    expect(managerItems).not.toContain('pass_kit_noir');
    expect(managerItems).not.toContain('pass_frame_gold');
    expect(managerItems).not.toContain('pass_celebration_lights');
  });

  it('ships twelve distinct bundles whose cosmetics and collectible never duplicate tier rewards', () => {
    const tierItems = new Set(
      (['career', 'manager'] as const).flatMap((mode) =>
        passTiersForMode(mode)
          .flatMap((tier) => [tier.freeReward.item, tier.premiumReward.item])
          .filter(Boolean),
      ),
    );
    const bundleItemSets = Array.from({ length: 12 }, (_, index) => {
      const bundle = monthlyBundleForCycle(`pass-2026-${String(index + 1).padStart(2, '0')}`);
      const items = [
        bundle.kit.id,
        bundle.celebration.id,
        bundle.office.inventoryId,
        bundle.collectible.id,
      ];
      expect(items.every((item) => !tierItems.has(item))).toBe(true);
      return items.join('|');
    });
    expect(new Set(bundleItemSets).size).toBe(12);
    expect(SEASON_PASS_SCENARIOS.every((scenario) => !('rewardGems' in scenario))).toBe(true);
  });

  it('tracks an exclusive scenario and grants its reward once', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now, provider: 'LOCAL_MOCK' });
    const scenario = monthlyBundleForCycle(save.pass!.seasonId).scenario;
    expect(activateSeasonPassScenario(save, scenario.id, now).ok).toBe(true);

    for (let index = 0; index < scenario.targetMatches; index += 1) {
      recordSeasonPassScenarioMatch(
        save,
        { won: index < scenario.targetWins, runs: 0, wickets: 0 },
        now,
      );
    }
    const first = claimSeasonPassScenarioReward(save, scenario.id, now);
    const second = claimSeasonPassScenarioReward(save, scenario.id, now);

    expect(first).toMatchObject({
      ok: true,
      coins: scenario.rewardCoins,
    });
    expect(first).not.toHaveProperty('gems');
    expect(second).toMatchObject({ ok: false, coins: 0 });
    expect(second).not.toHaveProperty('gems');
  });

  it('exposes only the featured scenario and resets its progress at the cycle boundary', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, {
      now,
      provider: 'LOCAL_MOCK',
      expiresAt: now + SEASON_PASS_PERIOD_MS * 2,
    });
    const current = monthlyBundleForCycle(save.pass!.seasonId).scenario;
    const unavailable = monthlyBundleForCycle(
      seasonPassPeriod(save.pass!.periodEndsAt! + 1).id,
    ).scenario;

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
