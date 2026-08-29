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
const { PASS_BALANCE_VERSION, PASS_TIERS, WEEKLY_QUESTS, passLevel } =
  jest.requireActual<typeof import('../../game/liveops')>('../../game/liveops');
const { ensureSeasonPassExperience, seasonPassPeriod } =
  jest.requireActual<typeof import('../../game/seasonPass')>('../../game/seasonPass');
const { contractOffer } =
  jest.requireActual<typeof import('../../game/career')>('../../game/career');
const { ffpBlockReason } =
  jest.requireActual<typeof import('../../game/finance')>('../../game/finance');
const { ensureSponsorshipState } =
  jest.requireActual<typeof import('../../game/sponsorship')>('../../game/sponsorship');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');
const { purchases } = jest.requireActual<typeof import('../../services')>('../../services');
const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

function unlockPlayerSponsorStore(save: ReturnType<typeof makeCareerSave>): void {
  save.careerPathLevel = 'DOMESTIC';
  ensureSponsorshipState(save).seniorDomesticDebutFixtureId = 'verified-domestic-debut';
}

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
      persistenceError: null,
      persist: originalPersist,
      persistCritical: originalPersistCritical,
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
      balanceVersion: PASS_BALANCE_VERSION,
      xp: PASS_TIERS[1].xpRequired,
      premium: true,
      claimedFree: [],
      claimedPremium: [],
    };
    const before = { ...save.wallet };
    useCareer.getState().setActive(save, 'career', 1);
    const xpBeforeClaim = useCareer.getState().save!.pass!.xp;
    const tierBeforeClaim = passLevel(xpBeforeClaim);

    const first = useCareer.getState().claimPass();
    const afterFirst = useCareer.getState().save!;
    const second = useCareer.getState().claimPass();
    const afterSecond = useCareer.getState().save!;

    expect(first.count).toBe(4);
    expect(first.coins).toBeGreaterThan(0);
    expect(first).not.toHaveProperty('gems');
    expect(first.items.length).toBeGreaterThan(0);
    expect(first.items.every((item) => !item.includes('Gems'))).toBe(true);
    expect(first.previousCoins).toBe(before.coins);
    expect(first.newCoins).toBe(before.coins + first.coins);
    expect(afterFirst.wallet.coins).toBe(before.coins + first.coins);
    expect(afterFirst.wallet.gems).toBe(before.gems);
    expect(afterFirst.pass?.xp).toBe(xpBeforeClaim);
    expect(passLevel(afterFirst.pass!.xp)).toBe(tierBeforeClaim);
    expect(afterFirst.pass?.claimedFree).toEqual([1, 2]);
    expect(afterFirst.pass?.claimedPremium).toEqual([1, 2]);
    expect(second).toMatchObject({ coins: 0, count: 0, items: [] });
    expect(second).not.toHaveProperty('gems');
    expect(afterSecond.wallet).toEqual(afterFirst.wallet);
    expect(afterSecond.pass?.claimedFree).toEqual([1, 2]);
    expect(afterSecond.pass?.claimedPremium).toEqual([1, 2]);
  });

  it('fulfils only Manager-usable tier cosmetics in a Manager save', () => {
    const save = makeManagerSave();
    save.pass = {
      seasonId: save.currentSeasonId ?? '',
      balanceVersion: PASS_BALANCE_VERSION,
      xp: PASS_TIERS[19].xpRequired,
      premium: true,
      claimedFree: [],
      claimedPremium: [],
    };
    useCareer.getState().setActive(save, 'manager', 1);

    const result = useCareer.getState().claimPass();
    const inventory = useCareer.getState().save?.inventory;

    expect(result.count).toBe(40);
    expect(inventory?.pass_stadium_noir).toBe(1);
    expect(inventory?.pass_office_noir).toBe(1);
    expect(inventory?.pass_kit_noir).toBeUndefined();
    expect(inventory?.pass_frame_gold).toBeUndefined();
    expect(inventory?.pass_celebration_lights).toBeUndefined();
  });

  it('rotates the pass at the exact UTC boundary and persists the change once', async () => {
    const save = makeCareerSave();
    const period = seasonPassPeriod(Date.UTC(2026, 7, 15));
    save.pass = {
      seasonId: period.id,
      periodStartedAt: period.startsAt,
      periodEndsAt: period.endsAt,
      balanceVersion: PASS_BALANCE_VERSION,
      xp: PASS_TIERS[7].xpRequired,
      premium: false,
      claimedFree: [1, 2],
      claimedPremium: [],
    };
    ensureSeasonPassExperience(save, period.id);
    save.seasonPassExperience!.monthlyDropCycleId = period.id;
    save.weeklyQuests = {
      week: Math.floor((period.endsAt - 1 - period.startsAt) / (7 * 86_400_000)),
      passCycleId: period.id,
      items: WEEKLY_QUESTS.map((definition) => ({
        id: definition.id,
        progress: definition.target,
        claimed: false,
      })),
    };
    const coinsBeforeRollover = save.wallet.coins;
    useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
    const persist = jest.spyOn(useCareer.getState(), 'persist').mockResolvedValue();
    const now = jest.spyOn(Date, 'now').mockReturnValue(period.endsAt);

    await expect(useCareer.getState().synchronizeSeasonPassClock(period.endsAt - 1)).resolves.toBe(
      false,
    );
    expect(useCareer.getState().save?.pass?.seasonId).toBe(period.id);
    expect(persist).not.toHaveBeenCalled();

    await expect(useCareer.getState().synchronizeSeasonPassClock(period.endsAt)).resolves.toBe(
      true,
    );
    expect(useCareer.getState().save?.pass).toMatchObject({
      seasonId: 'pass-2026-09',
      periodStartedAt: period.endsAt,
      periodEndsAt: Date.UTC(2026, 9, 1),
      balanceVersion: PASS_BALANCE_VERSION,
      xp: 0,
      claimedFree: [],
      claimedPremium: [],
    });
    expect(useCareer.getState().save?.seasonPassExperience?.monthlyDropCycleId).toBe(period.id);
    expect(useCareer.getState().save?.weeklyQuests?.passCycleId).toBe('pass-2026-09');
    expect(
      useCareer
        .getState()
        .save?.weeklyQuests?.items.every(
          (progress) => progress.progress === 0 && !progress.claimed,
        ),
    ).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);

    expect(useCareer.getState().claimWeeklyReward(WEEKLY_QUESTS[0].id)).toEqual({
      ok: false,
      coins: 0,
      gems: 0,
    });
    expect(useCareer.getState().save?.pass?.xp).toBe(0);
    expect(useCareer.getState().save?.wallet.coins).toBe(coinsBeforeRollover);

    useCareer.getState().save!.weeklyQuests!.items[0].progress = 1;
    now.mockReturnValue(period.endsAt + 7 * 86_400_000 - 1);
    expect(useCareer.getState().claimWeeklyReward(WEEKLY_QUESTS[0].id).ok).toBe(false);
    expect(useCareer.getState().save?.weeklyQuests?.week).toBe(0);
    expect(useCareer.getState().save?.weeklyQuests?.items[0]).toMatchObject({
      id: WEEKLY_QUESTS[0].id,
      progress: 1,
      claimed: false,
    });

    now.mockReturnValue(period.endsAt + 7 * 86_400_000);
    expect(useCareer.getState().claimWeeklyReward(WEEKLY_QUESTS[0].id).ok).toBe(false);
    expect(useCareer.getState().save?.weeklyQuests?.week).toBe(1);
    expect(useCareer.getState().save?.weeklyQuests?.items[0]).toMatchObject({
      id: WEEKLY_QUESTS[0].id,
      progress: 0,
      claimed: false,
    });

    await expect(useCareer.getState().synchronizeSeasonPassClock(period.endsAt)).resolves.toBe(
      false,
    );
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('stamps an unstamped legacy weekly quest without losing same-cycle progress', () => {
    const now = Date.UTC(2026, 7, 15);
    const period = seasonPassPeriod(now);
    const save = makeCareerSave();
    save.pass = {
      seasonId: period.id,
      periodStartedAt: period.startsAt,
      periodEndsAt: period.endsAt,
      balanceVersion: PASS_BALANCE_VERSION,
      xp: 0,
      premium: false,
      claimedFree: [],
      claimedPremium: [],
    };
    save.weeklyQuests = {
      week: Math.floor((now - period.startsAt) / (7 * 86_400_000)),
      items: [{ id: WEEKLY_QUESTS[0].id, progress: 4, claimed: false }],
    };
    jest.spyOn(Date, 'now').mockReturnValue(now);

    useCareer.getState().setActive(save, 'career', 1);

    expect(useCareer.getState().save?.weeklyQuests).toMatchObject({
      passCycleId: period.id,
      items: [{ id: WEEKLY_QUESTS[0].id, progress: 4, claimed: false }],
    });
  });

  it('expires stale premium access once when foregrounded inside the same month', async () => {
    const save = makeCareerSave();
    const period = seasonPassPeriod(Date.UTC(2026, 7, 15));
    const expiresAt = Date.UTC(2026, 7, 20);
    save.pass = {
      seasonId: period.id,
      periodStartedAt: period.startsAt,
      periodEndsAt: period.endsAt,
      balanceVersion: PASS_BALANCE_VERSION,
      xp: PASS_TIERS[3].xpRequired,
      premium: true,
      claimedFree: [1],
      claimedPremium: [1],
    };
    save.entitlements.seasonPass = {
      productId: 'season_pass',
      premium: true,
      tier: 1,
      periodStartedAt: period.startsAt,
      expiresAt,
      lastVerifiedAt: period.startsAt,
      provider: 'REVENUECAT',
    };
    save.weeklyQuests = {
      week: Math.floor((expiresAt - period.startsAt) / (7 * 86_400_000)),
      passCycleId: period.id,
      items: [
        {
          id: WEEKLY_QUESTS[0].id,
          progress: WEEKLY_QUESTS[0].target - 1,
          claimed: false,
        },
      ],
    };
    const weeklyProgressBeforeExpiry = save.weeklyQuests.items.map((progress) => ({ ...progress }));
    useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
    const persist = jest.spyOn(useCareer.getState(), 'persist').mockResolvedValue();

    await expect(useCareer.getState().synchronizeSeasonPassClock(expiresAt)).resolves.toBe(true);
    expect(useCareer.getState().save?.pass).toMatchObject({
      seasonId: period.id,
      xp: PASS_TIERS[3].xpRequired,
      premium: false,
      claimedFree: [1],
      claimedPremium: [1],
    });
    expect(useCareer.getState().save?.entitlements.seasonPass?.premium).toBe(false);
    expect(useCareer.getState().save?.weeklyQuests?.items).toEqual(weeklyProgressBeforeExpiry);
    expect(persist).toHaveBeenCalledTimes(1);

    await expect(useCareer.getState().synchronizeSeasonPassClock(expiresAt)).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
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

    expect(useCareer.getState().save?.wallet.coins).toBe(beforeCoins + 10_000);
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

  it('binds a verified Player sponsor purchase only to the active Player save', async () => {
    const save = makeCareerSave();
    unlockPlayerSponsorStore(save);
    useCareer.getState().setActive(save, 'career', 1);
    jest.spyOn(purchases, 'purchase').mockResolvedValue({
      ok: true,
      productId: 'player_save_sponsor',
      purchaseToken: 'verified-player-save-sponsor',
      purchaseState: 'PURCHASED',
      verificationState: 'VERIFIED',
    });

    await expect(useCareer.getState().purchaseProduct('player_save_sponsor')).resolves.toEqual({
      ok: true,
    });
    expect(useCareer.getState().save?.sponsorship?.premium).toMatchObject({
      productId: 'player_save_sponsor',
      boundSaveId: save.id,
      purchaseToken: 'verified-player-save-sponsor',
    });
    await expect(useCareer.getState().purchaseProduct('player_save_sponsor')).resolves.toEqual({
      ok: false,
      error: 'already_owned_for_save',
    });
  });

  it('does not grant a save sponsor if the active save changes during checkout', async () => {
    const original = makeCareerSave(101);
    const replacement = makeCareerSave(102);
    unlockPlayerSponsorStore(original);
    useCareer.getState().setActive(original, 'career', 1);
    let resolvePurchase!: (result: {
      ok: true;
      productId: string;
      purchaseToken: string;
      purchaseState: 'PURCHASED';
      verificationState: 'VERIFIED';
    }) => void;
    jest.spyOn(purchases, 'purchase').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePurchase = resolve;
        }),
    );

    const pending = useCareer.getState().purchaseProduct('player_save_sponsor');
    useCareer.getState().setActive(replacement, 'career', 2);
    resolvePurchase({
      ok: true,
      productId: 'player_save_sponsor',
      purchaseToken: 'verified-after-switch',
      purchaseState: 'PURCHASED',
      verificationState: 'VERIFIED',
    });

    await expect(pending).resolves.toEqual({ ok: false, error: 'active_save_changed' });
    expect(original.sponsorship?.premium).toBeUndefined();
    expect(replacement.sponsorship?.premium).toBeUndefined();
  });

  it('rejects each save-sponsor product in the opposite career mode before checkout', async () => {
    const manager = makeManagerSave();
    useCareer.getState().setActive(manager, 'manager', 1);
    const purchase = jest.spyOn(purchases, 'purchase');
    await expect(useCareer.getState().purchaseProduct('player_save_sponsor')).resolves.toEqual({
      ok: false,
      error: 'player_career_required',
    });

    const player = makeCareerSave();
    useCareer.getState().setActive(player, 'career', 2);
    await expect(useCareer.getState().purchaseProduct('manager_save_sponsor')).resolves.toEqual({
      ok: false,
      error: 'manager_save_required',
    });
    expect(purchase).not.toHaveBeenCalled();
  });

  it('does not open Player sponsor checkout before the senior domestic debut', async () => {
    const save = makeCareerSave();
    useCareer.getState().setActive(save, 'career', 1);
    const purchase = jest.spyOn(purchases, 'purchase');

    await expect(useCareer.getState().purchaseProduct('player_save_sponsor')).resolves.toEqual({
      ok: false,
      error: 'sponsorship_not_unlocked',
    });
    expect(purchase).not.toHaveBeenCalled();
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
    const persist = jest.spyOn(useCareer.getState(), 'persistCritical').mockImplementation(
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

  it('consumes one Training Accelerator charge for one 1.5x training session', async () => {
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
    expect(result.gains.every((gain) => gain.to > gain.from)).toBe(true);
    expect(useCareer.getState().save?.inventory?.training_accelerator).toBe(2);
    expect(useCareer.getState().save?.premiumInventory?.trainingAcceleratorCharges).toBe(2);
  });

  it('adds the accelerator boost on top of an active personal coach', async () => {
    const save = makeCareerSave();
    save.careerPathLevel = 'DOMESTIC';
    save.wallet.coins = 100_000;
    const player = save.players[save.userPlayerId!];
    player.batting.technique = 25;
    player.batting.timing = 25;
    player.batting.power = 25;
    useCareer.getState().setActive(save, 'career', 1);
    expect(useCareer.getState().hirePersonalCoach('BATTING').ok).toBe(true);

    const coachedSave = JSON.parse(JSON.stringify(useCareer.getState().save));
    jest.spyOn(Date, 'now').mockReturnValue(123_456_789);
    const normal = await useCareer.getState().train('batting');
    const normalGain = normal.gains.reduce((sum, gain) => sum + gain.to - gain.from, 0);

    coachedSave.inventory = { ...(coachedSave.inventory ?? {}), training_accelerator: 1 };
    useCareer.getState().setActive(coachedSave, 'career', 1);
    const accelerated = await useCareer.getState().train('batting');
    const acceleratedGain = accelerated.gains.reduce((sum, gain) => sum + gain.to - gain.from, 0);

    expect(normal.ok).toBe(true);
    expect(accelerated.ok).toBe(true);
    expect(acceleratedGain).toBeGreaterThan(normalGain);
    expect(useCareer.getState().save?.inventory?.training_accelerator).toBe(0);
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

  it('converts gems to coins only in Player Career and saves the exchange', async () => {
    const save = makeCareerSave();
    save.wallet.gems = 100;
    const coinsBefore = save.wallet.coins;
    useCareer.getState().setActive(save, 'career', 1);
    const persistCritical = jest.spyOn(useCareer.getState(), 'persistCritical').mockResolvedValue();

    await expect(useCareer.getState().convertPlayerGems(100)).resolves.toEqual({
      ok: true,
      gems: 100,
      coins: 4_000,
    });
    expect(useCareer.getState().save?.wallet.gems).toBe(0);
    expect(useCareer.getState().save?.wallet.coins).toBe(coinsBefore + 4_000);
    expect(persistCritical).toHaveBeenCalledTimes(1);

    const manager = makeManagerSave();
    manager.wallet.gems = 300;
    useCareer.getState().setActive(manager, 'manager', 1);
    const managerWallet = { ...useCareer.getState().save!.wallet };
    await expect(useCareer.getState().convertPlayerGems(300)).resolves.toEqual({
      ok: false,
      reason: 'Gem exchange is available only in Player Career.',
    });
    expect(useCareer.getState().save?.wallet).toEqual(managerWallet);
  });

  it('restores the Player wallet when a gem exchange cannot be saved', async () => {
    const save = makeCareerSave();
    save.wallet.gems = 100;
    useCareer.getState().setActive(save, 'career', 1);
    const walletBefore = { ...useCareer.getState().save!.wallet };
    jest.spyOn(useCareer.getState(), 'persistCritical').mockRejectedValue(new Error('disk full'));

    await expect(useCareer.getState().convertPlayerGems(25)).resolves.toEqual({
      ok: false,
      reason: 'The exchange was not saved. No gems were spent.',
    });
    expect(useCareer.getState().save?.wallet).toEqual(walletBefore);
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
    const result = useCareer.getState().upgradeFacilityLevel('training', 'TOKEN');
    const after = useCareer.getState().save!;

    expect(result).toEqual({
      ok: true,
      cost: 0,
      level: beforeLevel + 1,
      paymentMethod: 'TOKEN',
    });
    expect(after.inventory?.facility_upgrade_token).toBe(0);
    expect(after.facilities?.training).toBe(beforeLevel + 1);
    expect(after.teams[after.userTeamId!].budget).toBe(beforeBudget);
  });

  it('spends Club Balance and preserves an owned facility token when cash is selected', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 5_000_000;
    save.inventory = { ...(save.inventory ?? {}), facility_upgrade_token: 1 };
    const beforeLevel = save.facilities!.academy;
    useCareer.getState().setActive(save, 'manager', 1);

    const result = useCareer.getState().upgradeFacilityLevel('academy', 'CLUB_BUDGET');
    const after = useCareer.getState().save!;

    expect(result.ok).toBe(true);
    expect(result.paymentMethod).toBe('CLUB_BUDGET');
    expect(result.cost).toBeGreaterThan(0);
    expect(after.facilities?.academy).toBe(beforeLevel + 1);
    expect(after.inventory?.facility_upgrade_token).toBe(1);
    expect(after.teams[after.userTeamId!].budget).toBe(5_000_000 - result.cost);
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
    jest.spyOn(purchases, 'restore').mockResolvedValue({
      status: 'RESTORED',
      purchases: [
        {
          ok: true,
          productId: 'bundle_legend',
          purchaseState: 'PURCHASED',
          verificationState: 'VERIFIED',
        },
      ],
    });

    await expect(useCareer.getState().restorePurchases()).resolves.toEqual({
      status: 'RESTORED',
      count: 1,
      productIds: ['bundle_legend'],
    });
    expect(useCareer.getState().save?.inventory?.player_legend_bundle_owned).toBe(1);
    expect(useCareer.getState().save?.entitlements.removeAds).toBe(true);

    const managerSave = makeManagerSave();
    useCareer.getState().setActive(managerSave, 'manager', 2);
    await expect(useCareer.getState().restorePurchases()).resolves.toEqual({
      status: 'NOTHING_APPLICABLE',
      count: 0,
      productIds: [],
    });
    expect(useCareer.getState().save?.inventory?.player_legend_bundle_owned).toBeUndefined();
    expect(useCareer.getState().save?.entitlements.removeAds).toBeFalsy();
  });

  it('restores manager ownership idempotently without regranting consumables', async () => {
    const save = makeManagerSave();
    const startingReputation = save.teams[save.userTeamId!].reputation;
    useCareer.getState().setActive(save, 'manager', 1);
    jest.spyOn(purchases, 'restore').mockResolvedValue({
      status: 'RESTORED',
      purchases: [
        {
          ok: true,
          productId: 'manager_legend_pack',
          purchaseState: 'PURCHASED',
          verificationState: 'VERIFIED',
        },
      ],
    });

    await expect(useCareer.getState().restorePurchases()).resolves.toMatchObject({
      status: 'RESTORED',
      count: 1,
      productIds: ['manager_legend_pack'],
    });
    const first = useCareer.getState().save!;
    const firstReputation = first.teams[first.userTeamId!].reputation;
    const firstHistoryCount = first.managerProgression?.premiumAssistanceHistory.length ?? 0;
    expect(firstReputation).toBe(Math.min(95, startingReputation + 3));
    expect(first.inventory?.scout_full_reveal_token ?? 0).toBe(0);
    expect(first.inventory?.facility_upgrade_token ?? 0).toBe(0);
    expect(first.inventory?.squad_recovery_token ?? 0).toBe(0);

    await expect(useCareer.getState().restorePurchases()).resolves.toMatchObject({
      status: 'RESTORED',
      count: 1,
      productIds: ['manager_legend_pack'],
    });
    const second = useCareer.getState().save!;
    expect(second.teams[second.userTeamId!].reputation).toBe(firstReputation);
    expect(second.managerProgression?.premiumAssistanceHistory.length ?? 0).toBe(firstHistoryCount);
  });
});
