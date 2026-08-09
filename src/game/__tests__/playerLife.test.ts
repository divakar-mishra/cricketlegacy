import {
  bookPersonalPhysio,
  buyPerformanceAnalysis,
  buyPlayerAsset,
  buyPlayerEquipment,
  ensurePlayerLifeState,
  hirePersonalCoach,
  negotiatePlayerSponsor,
  personalCoachTrainingMultiplier,
  PLAYER_LIFE_COSTS,
  processPlayerLifeSeason,
  publishPlayerSocialPost,
  recordPlayerLifeMatch,
  sponsorNegotiationPreview,
  tradeLegacyToken,
  transferPlayerBank,
} from '../playerLife';
import { makeCareerSave } from './_depthHelpers';

function seniorCareer() {
  const save = makeCareerSave(928);
  const player = save.players[save.userPlayerId!];
  player.age = 22;
  save.careerPathLevel = 'DOMESTIC';
  save.wallet.coins = 500_000;
  ensurePlayerLifeState(save);
  return save;
}

describe('Player Life economy and development', () => {
  it('initialises without altering the established wallet', () => {
    const save = seniorCareer();
    const before = save.wallet.coins;
    save.playerLife = undefined;
    const life = ensurePlayerLifeState(save);
    expect(save.wallet.coins).toBe(before);
    expect(life.bankCoins).toBe(0);
    expect(life.propertyIds).toEqual([]);
  });

  it('moves money through the bank and prevents duplicate asset ownership', () => {
    const save = seniorCareer();
    expect(transferPlayerBank(save, 'DEPOSIT', 10_000).ok).toBe(true);
    expect(save.playerLife?.bankCoins).toBe(10_000);
    expect(transferPlayerBank(save, 'WITHDRAW', 2_500).ok).toBe(true);
    expect(save.playerLife?.bankCoins).toBe(7_500);

    const first = buyPlayerAsset(save, 'PROPERTY', 'starter-apartment');
    const duplicate = buyPlayerAsset(save, 'PROPERTY', 'starter-apartment');
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(save.playerLife?.propertyIds).toEqual(['starter-apartment']);
  });

  it('applies equipment boosts exactly once', () => {
    const save = seniorCareer();
    const player = save.players[save.userPlayerId!];
    const before = player.batting.technique;
    expect(buyPlayerEquipment(save, 'balanced-bat').ok).toBe(true);
    expect(player.batting.technique).toBe(before + 1);
    expect(buyPlayerEquipment(save, 'balanced-bat').ok).toBe(false);
    expect(player.batting.technique).toBe(before + 1);
  });

  it('gives active specialist coaches a bounded training multiplier', () => {
    const save = seniorCareer();
    expect(personalCoachTrainingMultiplier(save, 'batting')).toBe(1);
    expect(hirePersonalCoach(save, 'BATTING').ok).toBe(true);
    expect(personalCoachTrainingMultiplier(save, 'batting')).toBe(1.5);
    expect(personalCoachTrainingMultiplier(save, 'bowling')).toBe(1);
    expect(hirePersonalCoach(save, 'BATTING').ok).toBe(false);
  });

  it('limits physio and analysis services by season and fixture', () => {
    const save = seniorCareer();
    const player = save.players[save.userPlayerId!];
    const coinsBeforePhysio = save.wallet.coins;
    player.condition = 20;
    save.playerCareerResources!.playerCondition = 20;
    expect(bookPersonalPhysio(save).ok).toBe(true);
    expect(save.wallet.coins).toBe(coinsBeforePhysio - PLAYER_LIFE_COSTS.physio);
    player.condition = 20;
    save.playerCareerResources!.playerCondition = 20;
    expect(bookPersonalPhysio(save).ok).toBe(true);
    player.condition = 20;
    save.playerCareerResources!.playerCondition = 20;
    expect(bookPersonalPhysio(save).ok).toBe(true);
    expect(bookPersonalPhysio(save).ok).toBe(false);

    const opponentTeam = Object.values(save.teams).find(
      (team) => !team.isNationalTeam && team.id !== save.userTeamId,
    )!;
    const analysedFixtureId = 'analysis-fixture';
    save.fixtures[analysedFixtureId] = {
      id: analysedFixtureId,
      seasonId: save.currentSeasonId!,
      format: 'T20',
      homeTeamId: save.userTeamId!,
      awayTeamId: opponentTeam.id,
      venue: 'Analysis Ground',
      round: 1,
      played: false,
      competition: 'LEAGUE',
      competitionId: 't20-league',
    };
    const confidenceBefore = player.meta.confidence;
    const trustBefore = save.playerCareerResources!.coachTrust;
    const coinsBeforeAnalysis = save.wallet.coins;
    const analysis = buyPerformanceAnalysis(save, analysedFixtureId);
    expect(analysis).toEqual(expect.objectContaining({ ok: true }));
    expect(save.wallet.coins).toBe(coinsBeforeAnalysis - PLAYER_LIFE_COSTS.analyst);
    expect(player.meta.confidence).toBe(confidenceBefore + 3);
    expect(save.playerCareerResources!.confidence).toBe(player.meta.confidence);
    expect(save.playerCareerResources!.coachTrust).toBe(trustBefore + 2);
    expect(save.playerLife?.lastAnalysisReport).toMatchObject({
      fixtureId: analysedFixtureId,
      format: save.fixtures[analysedFixtureId].format,
    });
    expect(save.playerLife?.lastAnalysisReport?.threatName).toBeTruthy();
    expect(save.playerLife?.lastAnalysisReport?.matchAdvice).toBeTruthy();
    expect(save.playerLife?.lastAnalysisReport?.trainingReason).toContain('training');
    expect(buyPerformanceAnalysis(save, analysedFixtureId).ok).toBe(false);
  });

  it('uses the requested premium service prices', () => {
    expect(PLAYER_LIFE_COSTS.physio).toBe(9_000);
    expect(PLAYER_LIFE_COSTS.analyst).toBe(12_000);
  });

  it('trades only the fictional in-game token and cannot sell unowned units', () => {
    const save = seniorCareer();
    expect(tradeLegacyToken(save, 'SELL', 1).ok).toBe(false);
    expect(tradeLegacyToken(save, 'BUY', 3).ok).toBe(true);
    expect(save.playerLife?.legacyTokenUnits).toBe(3);
    expect(tradeLegacyToken(save, 'SELL', 2).ok).toBe(true);
    expect(save.playerLife?.legacyTokenUnits).toBe(1);
  });
});

describe('Player Life history and season processing', () => {
  it('keeps a newest-first rolling ten-match report', () => {
    const save = seniorCareer();
    for (let index = 0; index < 12; index += 1) {
      recordPlayerLifeMatch(save, {
        id: `match-${index}`,
        year: 2026,
        opponent: `Opponent ${index}`,
        competition: 't20-league',
        format: 'T20',
        runs: index,
        wickets: index % 3,
        rating: 6 + index / 10,
        result: index % 2 ? 'W' : 'L',
        international: false,
      });
    }
    expect(save.playerLife?.recentMatches).toHaveLength(10);
    expect(save.playerLife?.recentMatches[0].id).toBe('match-11');
    expect(save.playerLife?.recentMatches[9].id).toBe('match-2');
  });

  it('posts milestones, tracks followers and limits manual media posts', () => {
    const save = seniorCareer();
    const initialFollowers = save.playerLife!.followers;
    recordPlayerLifeMatch(save, {
      id: 'century',
      year: 2026,
      opponent: 'Rivals',
      competition: 'first-class',
      format: 'TEST',
      runs: 140,
      wickets: 1,
      rating: 9.4,
      result: 'W',
      international: false,
    });
    expect(save.playerLife!.followers).toBeGreaterThan(initialFollowers);
    expect(save.playerLife!.socialFeed[0].headline).toContain('140');
    expect(publishPlayerSocialPost(save, 'HUMBLE').ok).toBe(true);
    expect(publishPlayerSocialPost(save, 'CONFIDENT').ok).toBe(true);
    expect(publishPlayerSocialPost(save, 'TEAM_FIRST').ok).toBe(true);
    expect(publishPlayerSocialPost(save, 'HUMBLE').ok).toBe(false);
  });

  it('pays asset income to the bank and expires seasonal coaches', () => {
    const save = seniorCareer();
    transferPlayerBank(save, 'DEPOSIT', 10_000);
    buyPlayerAsset(save, 'PROPERTY', 'starter-apartment');
    buyPlayerAsset(save, 'BUSINESS', 'bat-workshop');
    hirePersonalCoach(save, 'MENTAL');
    const before = save.playerLife!.bankCoins;
    const payout = processPlayerLifeSeason(save, 2026);
    expect(payout).toBe(2_150);
    expect(save.playerLife!.bankCoins).toBe(before + payout);
    expect(save.playerLife!.personalCoaches.MENTAL).toBeUndefined();
  });

  it('allows only one sponsor negotiation per season', () => {
    const save = seniorCareer();
    save.sponsors = [];
    const safe = sponsorNegotiationPreview(save, 'SAFE');
    const balanced = sponsorNegotiationPreview(save, 'BALANCED');
    const bold = sponsorNegotiationPreview(save, 'BOLD');
    expect(safe.chance).toBe(100);
    expect(safe.signingBonus).toBeLessThan(balanced.signingBonus);
    expect(balanced.signingBonus).toBeLessThan(bold.signingBonus);
    expect(safe.perMatchCoins).toBeLessThan(bold.perMatchCoins);
    expect(bold.seasons).toBe(2);
    expect(negotiatePlayerSponsor(save, 'SAFE').ok).toBe(true);
    expect(negotiatePlayerSponsor(save, 'SAFE').ok).toBe(false);
    expect(save.sponsors).toHaveLength(1);
  });
});
