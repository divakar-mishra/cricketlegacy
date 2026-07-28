import {
  addPassXp,
  applyQuestEvent,
  claimablePassRewards,
  claimQuest,
  DAILY_CHALLENGE_REWARDS,
  DAILY_QUESTS,
  DailyState,
  evaluateDailyClaim,
  initQuestProgress,
  isQuestComplete,
  MANAGER_DAILY_QUESTS,
  MANAGER_WEEKLY_QUESTS,
  PASS_TIERS,
  PassState,
  passLevel,
  pickDailyQuests,
  QuestProgress,
  STREAK_MAX_WEEK_MULTIPLIER,
  streakReward,
  WEEKLY_QUESTS,
  weeklyQuestsForMode,
  XP_PER_MATCH,
  xpForTier,
} from '../liveops';

describe('daily streak', () => {
  it('first ever claim starts a streak of 1', () => {
    const r = evaluateDailyClaim(undefined, 100);
    expect(r.canClaim).toBe(true);
    expect(r.newStreak).toBe(1);
  });

  it('increments on a consecutive day', () => {
    const prev: DailyState = { lastClaimDay: 100, streak: 3 };
    const r = evaluateDailyClaim(prev, 101);
    expect(r.canClaim).toBe(true);
    expect(r.newStreak).toBe(4);
  });

  it('no-ops on the same day, preserving the streak', () => {
    const prev: DailyState = { lastClaimDay: 100, streak: 3 };
    const r = evaluateDailyClaim(prev, 100);
    expect(r.canClaim).toBe(false);
    expect(r.newStreak).toBe(3);
  });

  it('resets to 1 after a gap of more than one day', () => {
    const prev: DailyState = { lastClaimDay: 100, streak: 9 };
    const r = evaluateDailyClaim(prev, 103);
    expect(r.canClaim).toBe(true);
    expect(r.newStreak).toBe(1);
  });
});

describe('streakReward', () => {
  it('escalates within the 7-day cycle and grants gems only on day 7', () => {
    expect(streakReward(2).coins).toBeGreaterThan(streakReward(1).coins);
    expect(streakReward(7).coins).toBeGreaterThan(streakReward(6).coins);
    expect(streakReward(1).gems).toBe(0);
    expect(streakReward(7).gems).toBeGreaterThan(0);
  });

  it('keeps rising across weeks but caps the multiplier', () => {
    // Week 2 day-1 pays more than week 1 day-1.
    expect(streakReward(8).coins).toBeGreaterThan(streakReward(1).coins);
    // Same day-of-cycle in two very deep weeks is identical (multiplier capped).
    expect(streakReward(29).coins).toBe(streakReward(71).coins);
    // Day-1 coins concretely cap at the base (100) times the max multiplier.
    expect(streakReward(29).coins).toBe(100 * STREAK_MAX_WEEK_MULTIPLIER);
    // Nothing ever exceeds the biggest base (day 7 = 600) times the cap.
    expect(streakReward(1000).coins).toBeLessThanOrEqual(600 * STREAK_MAX_WEEK_MULTIPLIER);
  });
});

describe('quests', () => {
  it('ships the specced pool sizes', () => {
    expect(DAILY_QUESTS.length).toBeGreaterThanOrEqual(5);
    expect(WEEKLY_QUESTS.length).toBeGreaterThanOrEqual(3);
    expect(MANAGER_DAILY_QUESTS.length).toBeGreaterThanOrEqual(3);
    expect(MANAGER_WEEKLY_QUESTS.length).toBeGreaterThanOrEqual(3);
  });

  it('manager quests avoid player-only batting and bowling stat goals', () => {
    const daily = pickDailyQuests(0, MANAGER_DAILY_QUESTS.length, 'manager');
    const weekly = weeklyQuestsForMode('manager');
    expect(
      [...daily, ...weekly].every((q) => q.metric !== 'SCORE_RUNS' && q.metric !== 'TAKE_WICKETS'),
    ).toBe(true);
    expect(weekly.every((q) => !q.rewardGems)).toBe(true);
    expect(WEEKLY_QUESTS.every((q) => !q.rewardGems)).toBe(true);
  });

  it('repeatable challenge and quest rewards do not mint gems', () => {
    expect(Object.values(DAILY_CHALLENGE_REWARDS).every((r) => r.gems === 0)).toBe(true);
    expect(DAILY_QUESTS.every((q) => !q.rewardGems)).toBe(true);
    expect(WEEKLY_QUESTS.every((q) => !q.rewardGems)).toBe(true);
    expect(MANAGER_DAILY_QUESTS.every((q) => !q.rewardGems)).toBe(true);
    expect(MANAGER_WEEKLY_QUESTS.every((q) => !q.rewardGems)).toBe(true);
  });

  it('pickDailyQuests is deterministic, rotates by day, and repeats over the pool period', () => {
    const a1 = pickDailyQuests(10);
    const a2 = pickDailyQuests(10);
    expect(a1.map((q) => q.id)).toEqual(a2.map((q) => q.id)); // deterministic
    expect(a1).toHaveLength(3); // default count

    const nextDay = pickDailyQuests(11);
    expect(nextDay.map((q) => q.id)).not.toEqual(a1.map((q) => q.id)); // rotates

    const fullPeriod = pickDailyQuests(10 + DAILY_QUESTS.length);
    expect(fullPeriod.map((q) => q.id)).toEqual(a1.map((q) => q.id)); // period == pool size

    for (const q of a1) expect(DAILY_QUESTS).toContainEqual(q); // drawn from the pool
  });

  it('applyQuestEvent advances only matching quests and does not mutate its input', () => {
    const defs = pickDailyQuests(0, DAILY_QUESTS.length); // whole pool, all metrics present
    const progress = initQuestProgress(defs);
    const runsId = defs.find((d) => d.metric === 'SCORE_RUNS')!.id;
    const winId = defs.find((d) => d.metric === 'WIN_MATCH')!.id;

    const next = applyQuestEvent(progress, defs, 'SCORE_RUNS', 20);

    expect(progress.find((p) => p.id === runsId)!.progress).toBe(0); // original untouched
    expect(next.find((p) => p.id === runsId)!.progress).toBe(20); // matching quest advanced
    expect(next.find((p) => p.id === winId)!.progress).toBe(0); // non-matching untouched
  });

  it('caps progress at the target and reports completion', () => {
    const def = DAILY_QUESTS.find((d) => d.metric === 'SCORE_RUNS')!;

    const done = applyQuestEvent(initQuestProgress([def]), [def], 'SCORE_RUNS', def.target + 100);
    expect(done[0].progress).toBe(def.target); // capped, no overflow
    expect(isQuestComplete(done[0], def)).toBe(true);

    const partial = applyQuestEvent(initQuestProgress([def]), [def], 'SCORE_RUNS', 1);
    expect(isQuestComplete(partial[0], def)).toBe(false);
  });

  it('claimQuest only flips complete, unclaimed quests', () => {
    const def = DAILY_QUESTS.find((d) => d.metric === 'WIN_MATCH')!;
    const incomplete: QuestProgress[] = initQuestProgress([def]);
    expect(claimQuest(incomplete, [def], def.id)[0].claimed).toBe(false); // not complete → no-op

    const complete = applyQuestEvent(incomplete, [def], 'WIN_MATCH', def.target);
    const claimed = claimQuest(complete, [def], def.id);
    expect(claimed[0].claimed).toBe(true);
    expect(complete[0].claimed).toBe(false); // pure: source array untouched
  });
});

describe('battle pass', () => {
  it('passLevel maps cumulative xp to the highest reached tier and caps out', () => {
    expect(passLevel(0)).toBe(0);
    expect(passLevel(PASS_TIERS[0].xpRequired)).toBe(1);
    expect(passLevel(PASS_TIERS[0].xpRequired - 1)).toBe(0);
    expect(passLevel(PASS_TIERS[2].xpRequired)).toBe(3);

    const last = PASS_TIERS[PASS_TIERS.length - 1];
    expect(passLevel(last.xpRequired + 999_999)).toBe(last.tier); // caps at final tier
  });

  it('has ~20 tiers with strictly rising xp gates', () => {
    expect(PASS_TIERS.length).toBeGreaterThanOrEqual(20);
    for (let i = 1; i < PASS_TIERS.length; i++) {
      expect(PASS_TIERS[i].xpRequired).toBeGreaterThan(PASS_TIERS[i - 1].xpRequired);
    }
    expect(xpForTier(1)).toBe(PASS_TIERS[0].xpRequired);
    expect(xpForTier(999)).toBe(0); // out of range
  });

  it('addPassXp is pure, accumulates, and ignores negative xp', () => {
    const s0: PassState = {
      seasonId: 'S1',
      xp: 0,
      premium: false,
      claimedFree: [],
      claimedPremium: [],
    };
    const s1 = addPassXp(s0, XP_PER_MATCH);
    expect(s0.xp).toBe(0); // original untouched
    expect(s1.xp).toBe(XP_PER_MATCH);

    const s2 = addPassXp(s1, -50);
    expect(s2.xp).toBe(XP_PER_MATCH); // negative ignored
    expect(s2.claimedFree).not.toBe(s1.claimedFree); // arrays copied, not shared
  });

  it('claimablePassRewards lists unclaimed free (and premium) rewards up to level', () => {
    const xp = PASS_TIERS[1].xpRequired; // level 2

    const free: PassState = {
      seasonId: 'S1',
      xp,
      premium: false,
      claimedFree: [1],
      claimedPremium: [],
    };
    expect(claimablePassRewards(free)).toEqual([{ tier: 2, premium: false }]);
    expect(claimablePassRewards(free).every((r) => r.premium === false)).toBe(true); // never premium

    const prem: PassState = {
      seasonId: 'S1',
      xp,
      premium: true,
      claimedFree: [1, 2],
      claimedPremium: [],
    };
    expect(claimablePassRewards(prem)).toEqual([
      { tier: 1, premium: true },
      { tier: 2, premium: true },
    ]);
  });
});
