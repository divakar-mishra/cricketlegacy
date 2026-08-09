import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import {
  accrueNationalRep,
  applyCareerMatchReadiness,
  buildNationalXI,
  careerSelectionDecision,
  careerTier,
  checkAgeRetirement,
  closeInternationalCapSeason,
  CALLUP_OVERALL,
  ensurePlayerCareerResources,
  nationalState,
  prepareCareerFormat,
  prepareCareerPlayerForMatch,
  selectCareerXI,
  setCareerRestRequest,
} from '../career';
import { buildUserPlayer, createCareerSave } from '../createGame';

function makeCareer(overall = 60): SaveGame {
  const v = overall; // uniform attributes ≈ overall
  const player = buildUserPlayer({
    name: 'Cap Tester',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: v, timing: v, power: v, footwork: v, temperament: v, running: v },
    bowling: { paceOrSpin: v, accuracy: v, movement: v, variations: v, stamina: v },
    fielding: { catching: v, throwing: v, agility: v, keeping: 30 },
    meta: { fitness: v, confidence: v, aggression: 55, discipline: v },
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 12345,
  });
}

describe('national selection', () => {
  it('builds reputation from strong ratings and erodes it from poor ones', () => {
    const save = makeCareer(60);
    const user = save.players.user;
    accrueNationalRep(save, user, 9);
    const high = save.nationalRep ?? 0;
    expect(high).toBeGreaterThan(0);
    accrueNationalRep(save, user, 2);
    expect(save.nationalRep!).toBeLessThan(high);
  });

  it('calls the user up once they are good enough and in form', () => {
    const save = makeCareer(75); // overall >= CALLUP_OVERALL
    const user = save.players.user;
    expect(user.overall).toBeGreaterThanOrEqual(CALLUP_OVERALL);
    let calledUp = false;
    for (let i = 0; i < 30 && !calledUp; i++) {
      calledUp = accrueNationalRep(save, user, 10).calledUp;
    }
    expect(calledUp).toBe(true);
    expect(nationalState(save).capped).toBe(true);
    expect(save.playerCareerResources?.declaredCountry).toBe('india');
    expect(save.playerCareerResources?.cappedCountry).toBeUndefined();
  });

  it('does not call up an under-rated player no matter the form', () => {
    const save = makeCareer(50); // below the overall gate
    const user = save.players.user;
    for (let i = 0; i < 40; i++) accrueNationalRep(save, user, 10);
    expect(save.capped).toBeFalsy();
  });

  it('reflects tiers by overall and caps', () => {
    const save = makeCareer(50);
    expect(careerTier(save, save.players.user)).toBe('ACADEMY');
    const strong = makeCareer(75);
    expect(['FRANCHISE', 'DOMESTIC']).toContain(careerTier(strong, strong.players.user));
    strong.capped = true;
    expect(careerTier(strong, strong.players.user)).toBe('INTERNATIONAL');
  });
});

describe('national XI', () => {
  it('builds a national XI that includes the user and a keeper', () => {
    const save = makeCareer(70);
    const xi = buildNationalXI(save, 'india', 'user');
    expect(xi).toHaveLength(11);
    expect(xi.some((p) => p.id === 'user')).toBe(true);
    expect(xi.some((p) => p.role === 'WK_BATTER')).toBe(true);
  });
});

describe('form-driven club selection', () => {
  it('persists an 11-man merit XI and reports user selection', () => {
    const save = makeCareer(72);
    const selected = selectCareerXI(save);
    const team = save.teams[save.userTeamId!];
    expect(team.xi).toHaveLength(11);
    expect(typeof selected).toBe('boolean');
    expect(selected).toBe(team.xi!.includes('user'));
  });

  it('benches an out-of-form U19 player and explains why', () => {
    const save = makeCareer(64);
    save.careerPathLevel = 'U19';
    save.players.user.age = 18;
    save.players.user.meta.form = 39;

    const decision = careerSelectionDecision(save, 'ODI', 'u19-next');

    expect(decision.selected).toBe(false);
    expect(decision.reason).toContain('below the selector target of 40');
    expect(selectCareerXI(save, 'ODI', 'u19-next')).toBe(false);
    expect(save.teams[save.userTeamId!].xi).not.toContain('user');
  });

  it('honours a deliberate rest and restores condition without spending an appearance', () => {
    const save = makeCareer(72);
    const resources = ensurePlayerCareerResources(save)!;
    resources.playerCondition = 42;
    save.players.user.condition = 42;
    setCareerRestRequest(save, 'next', true);

    expect(careerSelectionDecision(save, 'TEST', 'next').selected).toBe(false);
    applyCareerMatchReadiness(save, {
      fixtureId: 'next',
      format: 'TEST',
      selected: false,
    });

    expect(resources.playerCondition).toBeGreaterThan(42);
    expect(resources.consecutiveMatches).toBe(0);
    expect(resources.requestedRestFixtureId).toBeUndefined();
  });

  it('uses training and adaptability to reduce a format-switch penalty', () => {
    const save = makeCareer(70);
    const resources = ensurePlayerCareerResources(save)!;
    resources.lastFormat = 'T20';
    resources.redBallMemory = 30;
    resources.adaptability = 30;
    const before = prepareCareerPlayerForMatch(save, save.players.user, 'TEST');

    prepareCareerFormat(save, 'TEST');
    prepareCareerFormat(save, 'TEST');
    const after = prepareCareerPlayerForMatch(save, save.players.user, 'TEST');

    expect(after.batting.technique).toBeGreaterThan(before.batting.technique);
  });
});

describe('late-career international retirement nudge', () => {
  it('uses caps earned in each season instead of lifetime caps', () => {
    const save = makeCareer(75);
    save.capped = true;
    save.players.user.age = 34;
    save.userCaps = 50;
    save.userCapsAtSeasonStart = 50;

    expect(checkAgeRetirement(save, closeInternationalCapSeason(save))).toBe(false);
    expect(save.intlDroppedSeasons).toBe(1);
    expect(checkAgeRetirement(save, closeInternationalCapSeason(save))).toBe(true);
    expect(save.intlDroppedSeasons).toBe(2);

    save.userCaps = 51;
    expect(checkAgeRetirement(save, closeInternationalCapSeason(save))).toBe(false);
    expect(save.intlDroppedSeasons).toBe(0);
  });
});
