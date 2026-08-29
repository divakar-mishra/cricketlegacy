import fs from 'fs';
import path from 'path';

const readScreen = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('playable U19 World Cup UI', () => {
  const tournament = readScreen('U19WorldCupScreen.tsx');
  const careerHub = readScreen('CareerHubScreen.tsx');

  it('shows the attainable merit targets using exact match-backed progress', () => {
    expect(tournament).toContain('const APPEARANCE_TARGET = U19_WORLD_CUP_MIN_APPEARANCES');
    expect(tournament).toContain('const RATING_TARGET = U19_WORLD_CUP_MIN_AVERAGE_RATING');
    expect(tournament).toContain('const READINESS_TARGET = U19_WORLD_CUP_MIN_READINESS');
    expect(tournament).toContain('selection.merit.appearances');
    expect(tournament).toContain('selection.merit.averageRating.toFixed(1)');
    expect(tournament).toContain('selection.merit.readiness * 100');
  });

  it('groups the persisted fixtures by knockout round and resolves team names from the save', () => {
    expect(tournament).toContain('getU19WorldCupFixturesByRound(save)');
    expect(tournament).toContain('rounds.quarterFinals');
    expect(tournament).toContain('rounds.semiFinals');
    expect(tournament).toContain('rounds.final');
    expect(tournament).toContain("return teams[teamId]?.name ?? 'Team pending'");
    expect(tournament).not.toContain('getCountry(');
  });

  it('presents every selection and tournament outcome without internal scheduling copy', () => {
    for (const label of [
      'Selection in progress',
      'Squad selected',
      'Tournament active',
      'Eliminated',
      'Runners-up',
      'Champions',
      'Selection missed',
      'Tournament complete',
    ]) {
      expect(tournament).toContain(label);
    }
    expect(tournament).not.toMatch(/even years?|next season/i);
    expect(tournament).not.toContain('label="Back"');
  });

  it('targets the next cup fixture and enters the normal match flow', () => {
    const targetAt = tournament.indexOf('setTargetFixture(nextFixtureId)');
    const navigateAt = tournament.indexOf("navigation.navigate('Match');", targetAt);
    expect(tournament).toContain('fixtureEnergyCost(nextFixture)');
    expect(tournament).toContain('playerCalendarAllowsFixture(save, nextFixture.id)');
    expect(tournament).toContain('Restore energy · need ${nextFixtureEnergy}');
    expect(tournament).toContain("navigation.navigate('Purchase')");
    expect(tournament).toContain('Return to Career Home');
    expect(tournament).not.toContain('disabled={!canPlayNextFixture}');
    expect(targetAt).toBeGreaterThan(-1);
    expect(navigateAt).toBeGreaterThan(targetAt);
    expect(tournament).not.toContain("navigation.navigate('Match', { intl: true })");
  });

  it('offers one clear tournament action on the Career Hub card', () => {
    const section = careerHub.match(
      /One-time, merit-based U19 World Cup opportunity\.([\s\S]*?)Career → Manager transition/,
    )?.[1];
    expect(section).toBeDefined();
    expect(section).toContain('label="View tournament"');
    expect(section).not.toContain('<Card onPress=');
    expect(section?.match(/navigation\.navigate\('U19WorldCup'\)/g)).toHaveLength(1);
  });
});
