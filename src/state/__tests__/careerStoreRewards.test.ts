import type { DailyChallenge } from '../../domain/types';

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: () => void) => {
      cb();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
const { makeCareerSave } = jest.requireActual<typeof import('../../game/__tests__/_depthHelpers')>(
  '../../game/__tests__/_depthHelpers',
);
const { makeManagerSave } = jest.requireActual<typeof import('../../game/__tests__/_depthHelpers')>(
  '../../game/__tests__/_depthHelpers',
);
const { PASS_TIERS } =
  jest.requireActual<typeof import('../../game/liveops')>('../../game/liveops');
const { contractOffer } =
  jest.requireActual<typeof import('../../game/career')>('../../game/career');
const { ffpBlockReason } =
  jest.requireActual<typeof import('../../game/finance')>('../../game/finance');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');
const originalPersist = useCareer.getState().persist;

const challenge: DailyChallenge = {
  dateKey: '20260715',
  title: 'Guard Test',
  description: 'Should not direct-claim from local fields.',
  format: 'T20',
  targetRuns: 1,
  targetBalls: 12,
  pitchCondition: 'FLAT',
  rewardCoins: 500,
  rewardGems: 10,
  rewardTier: 'GOLD',
  completed: true,
  userScore: 99,
};

describe('career reward integrity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCareer.setState({
      save: null,
      ref: null,
      pendingAchievementIds: [],
      lastPromotion: null,
      persist: originalPersist,
    });
  });

  it('persists a one-time starter pack dismissal in career experience state', () => {
    const save = makeCareerSave();
    save.experience!.starterPackUnlockedAt = Date.now();
    useCareer.getState().setActive(save, 'career', 1);

    useCareer.getState().dismissStarterPack();

    expect(useCareer.getState().save?.experience?.starterPackDismissedAt).toEqual(
      expect.any(Number),
    );
  });

  it('does not grant Daily Challenge rewards from direct local challenge fields', () => {
    const save = makeCareerSave();
    const before = { ...save.wallet };
    useCareer.getState().setActive(save, 'career', 1);

    const res = useCareer.getState().claimDailyChallenge(challenge);

    expect(res.ok).toBe(false);
    expect(useCareer.getState().save?.wallet.coins).toBe(before.coins);
    expect(useCareer.getState().save?.wallet.gems).toBe(before.gems);
    expect(useCareer.getState().save?.dailyChallengeCompleted?.[challenge.dateKey]).toBeUndefined();
  });

  it('does not retire the user before age 33 from a direct store call', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    user.age = 20;
    useCareer.getState().setActive(save, 'career', 1);

    const res = useCareer.getState().retire();

    expect(res).toBeNull();
    expect(useCareer.getState().save?.players[save.userPlayerId!].retired).toBeFalsy();
    expect(useCareer.getState().save?.flags.retired).toBeFalsy();
  });

  it('claims reached Season Pass rewards once and makes repeat claims inert', () => {
    const save = makeCareerSave();
    save.pass = {
      seasonId: save.currentSeasonId ?? '',
      xp: PASS_TIERS[1].xpRequired,
      premium: true,
      claimedFree: [],
      claimedPremium: [],
    };
    const before = { ...save.wallet };
    useCareer.getState().setActive(save, 'career', 1);

    const first = useCareer.getState().claimPass();
    const afterFirst = useCareer.getState().save!;
    const second = useCareer.getState().claimPass();
    const afterSecond = useCareer.getState().save!;

    expect(first.count).toBe(4);
    expect(first.coins).toBeGreaterThan(0);
    expect(first.gems).toBeGreaterThan(0);
    expect(first.items.length).toBeGreaterThan(0);
    expect(first.previousCoins).toBe(before.coins);
    expect(first.newCoins).toBe(before.coins + first.coins);
    expect(first.previousGems).toBe(before.gems);
    expect(first.newGems).toBe(before.gems + first.gems);
    expect(afterFirst.wallet.coins).toBe(before.coins + first.coins);
    expect(afterFirst.wallet.gems).toBe(before.gems + first.gems);
    expect(afterFirst.pass?.claimedFree).toEqual([1, 2]);
    expect(afterFirst.pass?.claimedPremium).toEqual([1, 2]);
    expect(second).toMatchObject({ coins: 0, gems: 0, count: 0, items: [] });
    expect(afterSecond.wallet).toEqual(afterFirst.wallet);
    expect(afterSecond.pass?.claimedFree).toEqual([1, 2]);
    expect(afterSecond.pass?.claimedPremium).toEqual([1, 2]);
  });

  it('returns itemized daily reward balances for confirmation UI', () => {
    const save = makeCareerSave();
    const before = { ...save.wallet };
    useCareer.getState().setActive(save, 'career', 1);

    const reward = useCareer.getState().claimDaily();

    expect(reward.ok).toBe(true);
    expect(reward.items).toContain(`Coins x ${reward.coins}`);
    expect(reward.previousCoins).toBe(before.coins);
    expect(reward.newCoins).toBe(before.coins + reward.coins);
    expect(reward.previousGems).toBe(before.gems);
    expect(reward.newGems).toBe(before.gems + reward.gems);
  });

  it('applies rewarded-ad coin transactions at most once per transaction id', () => {
    const save = makeCareerSave();
    const before = save.wallet.coins;
    useCareer.getState().setActive(save, 'career', 1);

    const first = useCareer.getState().grantAdReward(125, 'match-double:test-fixture');
    const second = useCareer.getState().grantAdReward(125, 'match-double:test-fixture');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(useCareer.getState().save?.wallet.coins).toBe(before + 125);
    expect(useCareer.getState().save?.flags['rewardTx:match-double:test-fixture']).toBe(true);
  });

  it('applies rewarded-ad energy transactions at most once per transaction id', () => {
    const save = makeCareerSave();
    save.wallet.energy = 5;
    useCareer.getState().setActive(save, 'career', 1);

    const first = useCareer.getState().grantAdEnergy(4, 'store-energy:test');
    const second = useCareer.getState().grantAdEnergy(4, 'store-energy:test');

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(useCareer.getState().save?.wallet.energy).toBe(9);
    expect(useCareer.getState().save?.flags['rewardTx:store-energy:test']).toBe(true);
  });

  it('does not grant a pending purchase', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'gems_medium',
      purchaseToken: 'tok-pending',
      purchaseState: 'PENDING',
      verificationState: 'UNVERIFIED',
    });

    const res = await useCareer.getState().purchaseProduct('gems_medium');

    expect(res.ok).toBe(false);
    expect(useCareer.getState().save?.wallet.gems).toBe(0);
    expect(useCareer.getState().save?.flags['purchaseToken:tok-pending']).toBeUndefined();
  });

  it('does not grant the same purchase token twice', async () => {
    const save = makeCareerSave();
    const beforeCoins = save.wallet.coins;
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'coins_medium',
      purchaseToken: 'tok-coins-medium',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('coins_medium');
    await useCareer.getState().purchaseProduct('coins_medium');

    expect(useCareer.getState().save?.wallet.coins).toBe(beforeCoins + 5_000);
    expect(useCareer.getState().save?.flags['purchaseToken:tok-coins-medium']).toBe(true);
  });

  it('does not grant a successful provider response without a transaction id', async () => {
    const save = makeCareerSave();
    const beforeCoins = save.wallet.coins;
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'coins_medium',
      purchaseState: 'PURCHASED',
      verificationState: 'VERIFIED',
    });

    const result = await useCareer.getState().purchaseProduct('coins_medium');

    expect(result).toEqual({ ok: false, error: 'missing_transaction_id' });
    expect(useCareer.getState().save?.wallet.coins).toBe(beforeCoins);
    expect(
      Object.keys(useCareer.getState().save?.flags ?? {}).some((key) =>
        key.startsWith('purchaseToken:'),
      ),
    ).toBe(false);
  });

  it('does not grant when the provider returns a different product', async () => {
    const save = makeCareerSave();
    const beforeCoins = save.wallet.coins;
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'gems_medium',
      purchaseToken: 'tok-wrong-product',
      purchaseState: 'PURCHASED',
      verificationState: 'VERIFIED',
    });

    const result = await useCareer.getState().purchaseProduct('coins_medium');

    expect(result).toEqual({ ok: false, error: 'product_mismatch' });
    expect(useCareer.getState().save?.wallet.coins).toBe(beforeCoins);
  });

  it('does not report purchase success until the granted save is durable', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'coins_medium',
      purchaseToken: 'tok-durable',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });
    let releasePersist!: () => void;
    const persist = jest.spyOn(useCareer.getState(), 'persist').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releasePersist = resolve;
        }),
    );
    let settled = false;

    const purchase = useCareer
      .getState()
      .purchaseProduct('coins_medium')
      .then((result) => {
        settled = true;
        return result;
      });
    await Promise.resolve();
    await Promise.resolve();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    releasePersist();
    await expect(purchase).resolves.toEqual({ ok: true });
  });

  it('consumes one Training Accelerator charge for one 3x training session', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'training_accelerator',
      purchaseToken: 'tok-training-accelerator',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });
    jest.spyOn(Date, 'now').mockReturnValue(123_456_789);

    await useCareer.getState().purchaseProduct('training_accelerator');
    expect(useCareer.getState().save?.inventory?.training_accelerator).toBe(3);
    const result = await useCareer.getState().train('batting');

    expect(result.ok).toBe(true);
    expect(result.gains.every((gain) => gain.to - gain.from >= 3)).toBe(true);
    expect(useCareer.getState().save?.inventory?.training_accelerator).toBe(2);
    expect(useCareer.getState().save?.premiumInventory?.trainingAcceleratorCharges).toBe(2);
  });

  it('does not grant free training when the career wallet is empty', async () => {
    const save = makeCareerSave();
    save.wallet.coins = 0;
    const player = save.players[save.userPlayerId!];
    const techniqueBefore = player.batting.technique;
    useCareer.getState().setActive(save, 'career', 1);

    const result = await useCareer.getState().train('batting');

    expect(result.ok).toBe(false);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.reason).toContain('coins');
    expect(result.gains).toHaveLength(0);
    expect(useCareer.getState().save?.players[player.id].batting.technique).toBe(techniqueBefore);
    expect(useCareer.getState().save?.players[player.id].trainingSessionsThisSeason ?? 0).toBe(0);
    expect(useCareer.getState().save?.wallet.coins).toBe(0);
  });

  it('refuses an accelerator purchase before checkout when stored charges would exceed the cap', async () => {
    const save = makeCareerSave();
    save.inventory = { ...(save.inventory ?? {}), training_accelerator: 4 };
    useCareer.getState().setActive(save, 'career', 1);
    const purchase = jest.spyOn(purchases, 'purchase');

    await expect(useCareer.getState().purchaseProduct('training_accelerator')).resolves.toEqual({
      ok: false,
      error: 'accelerator_cap_reached',
    });
    expect(purchase).not.toHaveBeenCalled();
  });

  it('does not offer the starter pack transaction before a completed match', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    const purchase = jest.spyOn(purchases, 'purchase');

    await expect(useCareer.getState().purchaseProduct('starter_pack')).resolves.toEqual({
      ok: false,
      error: 'complete_first_match',
    });
    expect(purchase).not.toHaveBeenCalled();
  });

  it('keeps the first gem-pack bonus for gem packs only', async () => {
    const save = makeCareerSave();
    save.experience = { ...(save.experience ?? {}), starterPackUnlockedAt: Date.now() };
    useCareer.getState().setActive(save, 'career', 1);
    const purchase = jest.spyOn(purchases, 'purchase');
    purchase.mockResolvedValueOnce({
      ok: true,
      productId: 'starter_pack',
      purchaseToken: 'tok-starter',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });
    purchase.mockResolvedValueOnce({
      ok: true,
      productId: 'gems_medium',
      purchaseToken: 'tok-gems-medium',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });
    purchase.mockResolvedValueOnce({
      ok: true,
      productId: 'gems_large',
      purchaseToken: 'tok-gems-large',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('starter_pack');
    expect(useCareer.getState().save?.wallet.gems).toBe(50);
    expect(useCareer.getState().save?.flags['promo:first_gem_pack_bonus']).toBeUndefined();

    await useCareer.getState().purchaseProduct('gems_medium');
    expect(useCareer.getState().save?.wallet.gems).toBe(650);
    expect(useCareer.getState().save?.flags['promo:first_gem_pack_bonus']).toBe(true);

    await useCareer.getState().purchaseProduct('gems_large');
    expect(useCareer.getState().save?.wallet.gems).toBe(1_850);

    const secondCareer = makeCareerSave();
    secondCareer.experience = {
      ...(secondCareer.experience ?? {}),
      starterPackUnlockedAt: Date.now(),
    };
    useCareer.getState().setActive(secondCareer, 'career', 2);
    await expect(useCareer.getState().purchaseProduct('starter_pack')).resolves.toEqual({
      ok: false,
      error: 'already_owned',
    });
    expect(purchase).toHaveBeenCalledTimes(3);
  });

  it('recovery_pack grants one token instead of immediately changing squad fitness', async () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const firstPlayer = save.players[team.playerIds[0]];
    firstPlayer.meta.fitness = 40;
    firstPlayer.condition = 40;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'recovery_pack',
      purchaseToken: 'tok-recovery-pack',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('recovery_pack');

    const after = useCareer.getState().save!;
    expect(after.inventory?.squad_recovery_token).toBe(1);
    expect(after.players[firstPlayer.id].meta.fitness).toBe(40);
    expect(after.players[firstPlayer.id].condition).toBe(40);
  });

  it('stores and consumes a facility upgrade token without spending club budget', async () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const beforeBudget = team.budget;
    const beforeLevel = save.facilities!.training;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'facility_upgrade_token',
      purchaseToken: 'tok-facility-upgrade',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('facility_upgrade_token');
    const result = useCareer.getState().upgradeFacilityLevel('training');
    const after = useCareer.getState().save!;

    expect(result).toEqual({ ok: true, cost: 0, level: beforeLevel + 1 });
    expect(after.inventory?.facility_upgrade_token).toBe(0);
    expect(after.facilities?.training).toBe(beforeLevel + 1);
    expect(after.teams[after.userTeamId!].budget).toBe(beforeBudget);
  });

  it('rejects a used seasonal budget boost before opening checkout', async () => {
    const save = makeManagerSave();
    const seasonFlag = `budgetBoost:transfer_budget_sm:${save.currentSeasonId ?? 'season'}`;
    save.flags = { ...(save.flags ?? {}), [seasonFlag]: true };
    useCareer.getState().setActive(save, 'manager', 1);
    const purchase = jest.spyOn(purchases, 'purchase');

    await expect(useCareer.getState().purchaseProduct('transfer_budget_sm')).resolves.toEqual({
      ok: false,
      error: 'season_limit_reached',
    });
    expect(purchase).not.toHaveBeenCalled();
  });

  it('keeps the 125% wage ceiling unchanged after a transfer-budget boost', async () => {
    const save = makeManagerSave();
    const incoming = save.players[save.freeAgents![0]];
    incoming.contract = { wage: 1_000_000, yearsLeft: 2 };
    save.finances!.wageBudgetPerSeason = 1;
    const wageBudgetBefore = save.finances!.wageBudgetPerSeason;
    expect(ffpBlockReason(save, incoming)).toBe('Over the wage budget (FFP).');
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'transfer_budget_sm',
      purchaseToken: 'tok-budget-ffp',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await expect(useCareer.getState().purchaseProduct('transfer_budget_sm')).resolves.toEqual({
      ok: true,
    });

    const after = useCareer.getState().save!;
    expect(after.finances?.wageBudgetPerSeason).toBe(wageBudgetBefore);
    expect(ffpBlockReason(after, incoming)).toBe('Over the wage budget (FFP).');
  });

  it('uses a recovery token once, skips injured players, and enforces cooldown', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const fitTarget = save.players[team.playerIds[0]];
    const injuredTarget = save.players[team.playerIds[1]];
    fitTarget.meta.fitness = 80;
    fitTarget.condition = 40;
    fitTarget.morale = 90;
    injuredTarget.meta.fitness = 50;
    injuredTarget.condition = 50;
    injuredTarget.morale = 40;
    injuredTarget.injury = { type: 'Hamstring strain', matchesOut: 3, severity: 'STRAIN' };
    save.inventory = { ...(save.inventory ?? {}), squad_recovery_token: 1 };
    useCareer.getState().setActive(save, 'manager', 1);

    const first = useCareer.getState().applySquadRecovery('token', 'recovery:test');
    const second = useCareer.getState().applySquadRecovery('token', 'recovery:test-2');

    const after = useCareer.getState().save!;
    expect(first.ok).toBe(true);
    expect(after.inventory?.squad_recovery_token).toBe(0);
    expect(after.players[fitTarget.id].meta.fitness).toBe(100);
    expect(after.players[fitTarget.id].condition).toBe(60);
    expect(after.players[fitTarget.id].morale).toBe(100);
    expect(after.players[injuredTarget.id].meta.fitness).toBe(50);
    expect(after.players[injuredTarget.id].condition).toBe(50);
    expect(after.players[injuredTarget.id].injury?.matchesOut).toBe(3);
    expect(second.ok).toBe(false);
    expect(second.reason).toContain('cooling down');
  });

  it('full fitness recovery spends gems once and does not heal injuries', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const fitTarget = save.players[team.playerIds[0]];
    const injuredTarget = save.players[team.playerIds[1]];
    save.wallet.gems = 200;
    fitTarget.meta.fitness = 30;
    fitTarget.condition = 30;
    injuredTarget.meta.fitness = 30;
    injuredTarget.condition = 30;
    injuredTarget.injury = { type: 'Back spasm', matchesOut: 2, severity: 'KNOCK' };
    useCareer.getState().setActive(save, 'manager', 1);

    const first = useCareer.getState().applySquadRecovery('full_fitness', 'full-fitness:test');
    const duplicate = useCareer.getState().applySquadRecovery('full_fitness', 'full-fitness:test');

    const after = useCareer.getState().save!;
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(after.wallet.gems).toBe(51);
    expect(after.players[fitTarget.id].meta.fitness).toBe(100);
    expect(after.players[fitTarget.id].condition).toBe(100);
    expect(after.players[injuredTarget.id].meta.fitness).toBe(30);
    expect(after.players[injuredTarget.id].condition).toBe(30);
    expect(after.players[injuredTarget.id].injury?.matchesOut).toBe(2);
  });

  it('full scout intelligence token reveals the selected player only', async () => {
    const save = makeManagerSave();
    const targetId = Object.keys(save.players).find(
      (id) => !save.teams[save.userTeamId!].playerIds.includes(id),
    )!;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'scout_full_reveal',
      purchaseToken: 'tok-scout',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('scout_full_reveal');
    const reveal = useCareer.getState().useFullScoutReveal(targetId, 'token', 'scout:test');

    const after = useCareer.getState().save!;
    expect(reveal.ok).toBe(true);
    expect(after.inventory?.scout_full_reveal_token).toBe(0);
    expect(after.scoutReports?.find((r) => r.playerId === targetId)?.uncertainty).toBe(0);
    expect(after.inventory?.[`scoutIntel:${targetId}:valuation`]).toBeGreaterThan(0);
  });

  it('contract boost grants one token and consumes it on real renewal', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    const baseOffer = contractOffer(save);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'contract_boost',
      purchaseToken: 'tok-contract-boost',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await useCareer.getState().purchaseProduct('contract_boost');
    const renewed = useCareer.getState().renewUserContract();

    const after = useCareer.getState().save!;
    expect(renewed.ok).toBe(true);
    expect(after.inventory?.contract_boost_token).toBe(0);
    expect(after.players[after.userPlayerId!].contract?.wage).toBe(
      Math.round(baseOffer.wage * 1.25),
    );
  });

  it('contract boost also applies to a negotiated contract', () => {
    const save = makeCareerSave();
    const offer = contractOffer(save);
    save.inventory = { ...(save.inventory ?? {}), contract_boost_token: 1 };
    useCareer.getState().setActive(save, 'career', 1);

    const signed = useCareer.getState().signNegotiatedContract(offer);

    const after = useCareer.getState().save!;
    expect(signed.ok).toBe(true);
    expect(signed.offer?.wage).toBe(Math.round(offer.wage * 1.25));
    expect(signed.offer?.signingBonus).toBe(Math.round(offer.signingBonus * 1.25));
    expect(after.players[after.userPlayerId!].contract?.wage).toBe(Math.round(offer.wage * 1.25));
    expect(after.inventory?.contract_boost_token).toBe(0);
  });

  it('does not open checkout when a contract boost is already stored', async () => {
    const save = makeCareerSave();
    save.inventory = { ...(save.inventory ?? {}), contract_boost_token: 1 };
    useCareer.getState().setActive(save, 'career', 1);
    const purchase = jest.spyOn(purchases, 'purchase');

    await expect(useCareer.getState().purchaseProduct('contract_boost')).resolves.toEqual({
      ok: false,
      error: 'contract_boost_already_stored',
    });
    expect(purchase).not.toHaveBeenCalled();
  });

  it('Manager Legacy Edition grants only its useful manager starter resources', async () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    const startingReputation = team.reputation;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'manager_legend_pack',
      purchaseToken: 'tok-manager-legacy',
      purchaseState: 'PURCHASED',
      verificationState: 'LOCAL_MOCK',
    });

    await expect(useCareer.getState().purchaseProduct('manager_legend_pack')).resolves.toEqual({
      ok: true,
    });

    const after = useCareer.getState().save!;
    expect(after.inventory?.manager_legend_backing).toBe(1);
    expect(after.inventory?.manager_legend_office_theme).toBe(1);
    expect(after.inventory?.scout_full_reveal_token).toBe(2);
    expect(after.inventory?.facility_upgrade_token).toBe(1);
    expect(after.inventory?.squad_recovery_token).toBe(1);
    expect(after.boardConfidence).toBeGreaterThanOrEqual(82);
    expect(after.teams[after.userTeamId!].reputation).toBe(Math.min(95, startingReputation + 3));
    expect(after.entitlements.removeAds).toBeFalsy();
  });

  it('restores Player Legend ownership only into Player Career', async () => {
    const careerSave = makeCareerSave();
    useCareer.getState().setActive(careerSave, 'career', 1);
    jest.spyOn(purchases, 'restore').mockResolvedValue([
      {
        ok: true,
        productId: 'bundle_legend',
        purchaseState: 'PURCHASED',
        verificationState: 'VERIFIED',
      },
    ]);

    await expect(useCareer.getState().restorePurchases()).resolves.toBe(1);
    expect(useCareer.getState().save?.inventory?.player_legend_bundle_owned).toBe(1);
    expect(useCareer.getState().save?.entitlements.removeAds).toBe(true);

    const managerSave = makeManagerSave();
    useCareer.getState().setActive(managerSave, 'manager', 2);
    await expect(useCareer.getState().restorePurchases()).resolves.toBe(0);
    expect(useCareer.getState().save?.inventory?.player_legend_bundle_owned).toBeUndefined();
    expect(useCareer.getState().save?.entitlements.removeAds).toBeFalsy();
  });

  it('restores manager ownership idempotently without regranting consumables', async () => {
    const save = makeManagerSave();
    const startingReputation = save.teams[save.userTeamId!].reputation;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'restore').mockResolvedValue([
      {
        ok: true,
        productId: 'manager_legend_pack',
        purchaseState: 'PURCHASED',
        verificationState: 'VERIFIED',
      },
    ]);

    await expect(useCareer.getState().restorePurchases()).resolves.toBe(1);
    const first = useCareer.getState().save!;
    const firstReputation = first.teams[first.userTeamId!].reputation;
    const firstHistoryCount = first.managerProgression?.premiumAssistanceHistory.length ?? 0;
    expect(firstReputation).toBe(Math.min(95, startingReputation + 3));
    expect(first.inventory?.scout_full_reveal_token ?? 0).toBe(0);
    expect(first.inventory?.facility_upgrade_token ?? 0).toBe(0);
    expect(first.inventory?.squad_recovery_token ?? 0).toBe(0);

    await expect(useCareer.getState().restorePurchases()).resolves.toBe(1);
    const second = useCareer.getState().save!;
    expect(second.teams[second.userTeamId!].reputation).toBe(firstReputation);
    expect(second.managerProgression?.premiumAssistanceHistory.length ?? 0).toBe(firstHistoryCount);
  });

});
