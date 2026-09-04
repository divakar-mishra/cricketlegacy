import { TEAM_BLUEPRINTS } from '../../content/teams';
import { Role, SaveGame } from '../../domain/types';
import {
  accrueNationalRep,
  applyCareerMatchReadiness,
  careerSelectionDecision,
  careerTier,
  checkPathPromotion,
  ensurePlayerCareerResources,
  isLegend,
  pathReadiness,
  recordPathPerformance,
  resolveCareerStageForAge,
  validateAgeEligibility,
} from '../career';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { matchImpactScore } from '../progression';
import { synchronizeCareerPromotion } from '../careerTransition';

function makeSave(role: Role, attr: number): SaveGame {
  const v = attr;
  const player = buildUserPlayer({
    name: 'Prospect',
    nationality: 'india',
    role,
    battingStyle: 'RHB',
    bowlingStyle: role === 'BOWLER' || role === 'ALLROUNDER' ? 'PACE' : undefined,
    batting: { technique: v, timing: v, power: v, footwork: v, temperament: v, running: v },
    bowling: { paceOrSpin: v, accuracy: v, movement: v, variations: v, stamina: v },
    fielding: { catching: v, throwing: v, agility: v, keeping: 30 },
    meta: { fitness: v, confidence: v, aggression: 55, discipline: v },
    age: 14,
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 999,
  });
}

describe('matchImpactScore', () => {
  it('rewards batting output for a batter', () => {
    expect(matchImpactScore({ runs: 0, wickets: 0 }, 'BATTER')).toBe(0);
    expect(matchImpactScore({ runs: 60, wickets: 0 }, 'BATTER')).toBeGreaterThan(0.9);
  });
  it('rewards wickets for a bowler', () => {
    expect(matchImpactScore({ runs: 0, wickets: 0 }, 'BOWLER')).toBe(0);
    expect(matchImpactScore({ runs: 0, wickets: 4 }, 'BOWLER')).toBeGreaterThan(0.9);
  });
  it('a bowler gets little credit for runs alone', () => {
    expect(matchImpactScore({ runs: 40, wickets: 0 }, 'BOWLER')).toBe(0);
  });
});

describe('performance-based path promotion', () => {
  it('moves School -> U19 -> reserved senior club without duplicate rosters', () => {
    const save = makeSave('BATTER', 48);
    const seniorTeamId = save.userTeamId!;
    const schoolTeamId = save.careerPathTeamId!;

    save.careerPathMatches = 6;
    save.careerPathRuns = 220;
    save.careerPathRatingSum = 36;
    const u19 = checkPathPromotion(save);
    synchronizeCareerPromotion(save, u19);
    const u19TeamId = save.careerPathTeamId!;

    expect(u19.to).toBe('U19');
    expect(u19TeamId).not.toBe(schoolTeamId);
    expect(save.teams[schoolTeamId].playerIds).not.toContain(save.userPlayerId);
    expect(save.teams[u19TeamId].playerIds).toContain(save.userPlayerId);
    expect(save.teams[seniorTeamId].playerIds).not.toContain(save.userPlayerId);
    expect(save.playerCareerResources?.selectionGuaranteeMatches).toBe(3);

    save.careerPathMatches = 7;
    save.careerPathRuns = 400;
    save.careerPathRatingSum = 49;
    const domestic = checkPathPromotion(save);
    synchronizeCareerPromotion(save, domestic);

    expect(domestic.to).toBe('DOMESTIC');
    expect(save.careerPathTeamId).toBeUndefined();
    expect(save.teams[u19TeamId].playerIds).not.toContain(save.userPlayerId);
    expect(save.teams[seniorTeamId].playerIds).toContain(save.userPlayerId);
    expect(save.players[save.userPlayerId!].contract).toBeDefined();
  });

  it('resolves age eligibility at every requested boundary', () => {
    expect(resolveCareerStageForAge(13)).toBe('SCHOOL');
    expect(resolveCareerStageForAge(14)).toBe('SCHOOL');
    expect(resolveCareerStageForAge(15)).toBe('SCHOOL');
    expect(resolveCareerStageForAge(16)).toBe('SCHOOL');
    expect(resolveCareerStageForAge(18)).toBe('U19');
    expect(resolveCareerStageForAge(19)).toBe('U19');
    expect(resolveCareerStageForAge(20)).toBe('DOMESTIC');
    expect(resolveCareerStageForAge(32)).toBe('DOMESTIC');
    expect(resolveCareerStageForAge(33)).toBe('DOMESTIC');
  });

  it('repairs invalid age/stage combinations idempotently', () => {
    const age33 = makeSave('BATTER', 48);
    age33.careerPathLevel = 'U19';
    age33.players.user.age = 33;
    expect(validateAgeEligibility(age33)).toBe('DOMESTIC');
    expect(age33.careerPathLevel).toBe('DOMESTIC');
    expect(age33.careerPathMatches).toBe(0);

    const age16 = makeSave('BATTER', 48);
    age16.careerPathLevel = 'SCHOOL';
    age16.players.user.age = 16;
    expect(validateAgeEligibility(age16)).toBe('SCHOOL');
    expect(validateAgeEligibility(age16)).toBe('SCHOOL');
    expect(age16.careerPathLevel).toBe('SCHOOL');
  });

  it('promotes a SCHOOL batter who actually scores runs', () => {
    const save = makeSave('BATTER', 48); // below prodigy fast-track
    save.careerPathLevel = 'SCHOOL';
    save.careerPathMatches = 6;
    save.careerPathRuns = 220; // strong output
    save.careerPathWickets = 0;
    save.careerPathRatingSum = 6 * 6; // avg rating 6
    const res = checkPathPromotion(save);
    expect(res.promoted).toBe(true);
    expect(res.to).toBe('U19');
  });

  it.each([
    ['BATTER' as const, 110, 0],
    ['BOWLER' as const, 0, 7],
    ['ALLROUNDER' as const, 90, 8],
  ])('promotes a reasonably good SCHOOL %s through earned output', (role, runs, wickets) => {
    const save = makeSave(role, 48);
    save.careerPathLevel = 'SCHOOL';
    save.careerPathMatches = 5;
    save.careerPathRuns = runs;
    save.careerPathWickets = wickets;
    save.careerPathRatingSum = 5 * 6;

    expect(pathReadiness(save, save.players[save.userPlayerId!])).toBeGreaterThanOrEqual(0.68);
    expect(checkPathPromotion(save)).toMatchObject({
      promoted: true,
      from: 'SCHOOL',
      to: 'U19',
    });
  });

  it.each([
    ['BATTER' as const, 225, 0],
    ['BOWLER' as const, 0, 12],
    ['ALLROUNDER' as const, 190, 11],
  ])('promotes a reasonably good U19 %s through earned output', (role, runs, wickets) => {
    const save = makeSave(role, 48);
    save.careerPathLevel = 'U19';
    save.careerPathMatches = 6;
    save.careerPathRuns = runs;
    save.careerPathWickets = wickets;
    save.careerPathRatingSum = 6 * 7;

    expect(pathReadiness(save, save.players[save.userPlayerId!])).toBeGreaterThanOrEqual(0.68);
    expect(checkPathPromotion(save)).toMatchObject({
      promoted: true,
      from: 'U19',
      to: 'DOMESTIC',
    });
  });

  it('does NOT promote a player with high ratings but low output (stuck)', () => {
    const save = makeSave('BATTER', 48);
    save.careerPathLevel = 'SCHOOL';
    save.careerPathMatches = 15; // plenty of matches
    save.careerPathRuns = 20; // barely any runs
    save.careerPathWickets = 0;
    save.careerPathRatingSum = 15 * 9; // flattering avg rating of 9!
    const res = checkPathPromotion(save);
    expect(res.promoted).toBe(false); // rating alone can't carry you up
    expect(save.careerPathLevel).toBe('SCHOOL');
  });

  it.each(['BATTER', 'BOWLER', 'ALLROUNDER'] as const)(
    'does not let a high rating promote a low-output %s',
    (role) => {
      const save = makeSave(role, 48);
      save.careerPathLevel = 'SCHOOL';
      save.careerPathMatches = 6;
      save.careerPathRuns = role === 'BOWLER' ? 0 : 20;
      save.careerPathWickets = role === 'BATTER' ? 0 : 1;
      save.careerPathRatingSum = 6 * 10;

      expect(pathReadiness(save, save.players[save.userPlayerId!])).toBeLessThan(0.62);
      expect(checkPathPromotion(save).promoted).toBe(false);
    },
  );

  it('fast-tracks a genuine prodigy on overall alone', () => {
    const save = makeSave('BATTER', 80); // very high overall → prodigy
    save.careerPathLevel = 'SCHOOL';
    save.careerPathMatches = 0;
    save.careerPathRuns = 0;
    const res = checkPathPromotion(save);
    expect(res.promoted).toBe(true);
    expect(res.to).toBe('U19');
  });

  it('resets accumulated output on promotion', () => {
    const save = makeSave('BATTER', 48);
    save.careerPathLevel = 'SCHOOL';
    save.careerPathMatches = 6;
    save.careerPathRuns = 220;
    save.careerPathRatingSum = 6 * 6;
    checkPathPromotion(save);
    expect(save.careerPathRuns).toBe(0);
    expect(save.careerPathMatches).toBe(0);
    expect(save.careerPathRatingSum).toBe(0);
  });

  it('keeps Grade A merit-based while ageing Under-19 players into senior cricket', () => {
    const oldSchool = makeSave('BATTER', 48);
    oldSchool.careerPathLevel = 'SCHOOL';
    oldSchool.players.user.age = 16;
    expect(checkPathPromotion(oldSchool).promoted).toBe(false);

    const oldU19 = makeSave('BATTER', 48);
    oldU19.careerPathLevel = 'U19';
    oldU19.players.user.age = 20;
    expect(checkPathPromotion(oldU19).to).toBe('DOMESTIC');
  });
});

describe('selection rewards', () => {
  it('weights Overall, Form and Coach Trust at 40/35/25', () => {
    const save = makeSave('BATTER', 60);
    save.careerPathLevel = 'DOMESTIC';
    const user = save.players[save.userPlayerId!];
    const resources = ensurePlayerCareerResources(save)!;
    user.meta.form = 40;
    resources.coachTrust = 40;
    const baseline = careerSelectionDecision(save, 'T20').userScore;

    user.meta.form = 60;
    const formBoosted = careerSelectionDecision(save, 'T20').userScore;
    user.meta.form = 40;
    resources.coachTrust = 60;
    const trustBoosted = careerSelectionDecision(save, 'T20').userScore;

    expect(formBoosted - baseline).toBeCloseTo(7, 5);
    expect(trustBoosted - baseline).toBeCloseTo(5, 5);
  });

  it('a 10 rating grants form, trust, confidence and the next selection', () => {
    const save = makeSave('BATTER', 55);
    save.careerPathLevel = 'DOMESTIC';
    const user = save.players[save.userPlayerId!];
    user.meta.form = 35;
    user.meta.confidence = 40;
    save.playerCareerResources = undefined;

    applyCareerMatchReadiness(save, {
      fixtureId: 'rating-ten',
      format: 'T20',
      selected: true,
      rating: 10,
      ballsFaced: 45,
    });
    const resources = ensurePlayerCareerResources(save)!;

    expect(user.meta.form).toBe(55);
    expect(user.meta.confidence).toBe(55);
    expect(resources.coachTrust).toBe(70);
    expect(resources.selectionGuaranteeMatches).toBe(1);
    expect(careerSelectionDecision(save, 'T20', 'next-fixture').selected).toBe(true);
  });

  it('provides a rotation opportunity after four healthy fixtures on the bench', () => {
    const save = makeSave('BATTER', 35);
    save.careerPathLevel = 'DOMESTIC';

    for (let index = 0; index < 4; index += 1) {
      applyCareerMatchReadiness(save, {
        fixtureId: `bench-${index}`,
        format: 'T20',
        selected: false,
      });
    }

    expect(ensurePlayerCareerResources(save)?.consecutiveBenches).toBe(4);
    expect(careerSelectionDecision(save, 'T20', 'rotation-fixture')).toMatchObject({
      selected: true,
      reason: 'Selected for a rotation opportunity after time outside the XI.',
    });

    applyCareerMatchReadiness(save, {
      fixtureId: 'rotation-fixture',
      format: 'T20',
      selected: true,
      rating: 5,
    });
    expect(ensurePlayerCareerResources(save)?.consecutiveBenches).toBe(0);
  });
});

describe('recordPathPerformance', () => {
  it('accumulates runs, wickets and rating', () => {
    const save = makeSave('ALLROUNDER', 55);
    save.careerPathLevel = 'U19';
    recordPathPerformance(save, { runs: 40, wickets: 2 }, 7);
    recordPathPerformance(save, { runs: 30, wickets: 1 }, 6);
    expect(save.careerPathRuns).toBe(70);
    expect(save.careerPathWickets).toBe(3);
    expect(save.careerPathRatingSum).toBe(13);
  });
});

describe('national reputation is output-driven', () => {
  it('builds faster from real output than from a flattering rating', () => {
    const a = makeSave('BATTER', 65);
    const b = makeSave('BATTER', 65);
    accrueNationalRep(a, a.players.user, 6, { runs: 90, wickets: 0 });
    accrueNationalRep(b, b.players.user, 6, { runs: 2, wickets: 0 });
    expect(a.nationalRep ?? 0).toBeGreaterThan(b.nationalRep ?? 0);
  });
});

describe('Legend status', () => {
  it('is not awarded without international caps', () => {
    const save = makeSave('BATTER', 85);
    save.capped = false;
    expect(isLegend(save, save.players.user)).toBe(false);
  });

  it('is earned by a mountain of runs', () => {
    const save = makeSave('BATTER', 80);
    save.capped = true;
    save.players.user.careerStats = { ...save.players.user.careerStats!, runs: 8200 } as any;
    expect(isLegend(save, save.players.user)).toBe(true);
    expect(careerTier(save, save.players.user)).toBe('LEGEND');
  });

  it('can be granted directly (IAP / achievement)', () => {
    const save = makeSave('BATTER', 60);
    save.legendGranted = true;
    expect(isLegend(save, save.players.user)).toBe(true);
  });
});
