import { COUNTRIES } from '../../data/countries';
import { STORY_EVENTS } from '../../content/storyEvents';
import { makeRng } from '../../engine/rng';
import {
  archetypePathPolicy,
  archetypeTrainingMultiplier,
  relationshipContractMultiplier,
} from '../careerArchetypes';
import { resolveStoryChoice } from '../careerEvents';
import {
  ensureSeasonPassBranding,
  playerDomesticBlueprints,
  synchronizeSeasonPassBranding,
  updateSeasonPassBranding,
} from '../domesticBranding';
import { calculateClubRating, hireStaff, staffByRole, superstarAttractionChance } from '../manager';
import { buildPlayerLeagueWorld } from '../../generation/world';
import { activateSeasonPass, SEASON_PASS_PERIOD_MS } from '../seasonPass';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('career identities with gameplay consequences', () => {
  it('gives each archetype a materially different path and training curve', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.age = 18;

    save.experience!.playerArchetype = 'PRODIGY';
    const prodigyPolicy = archetypePathPolicy(save);
    const prodigyTraining = archetypeTrainingMultiplier(save, player, 'batting');

    save.experience!.playerArchetype = 'LATE_BLOOMER';
    const latePolicy = archetypePathPolicy(save);
    const earlyLateTraining = archetypeTrainingMultiplier(save, player, 'batting');
    player.age = 25;
    const matureLateTraining = archetypeTrainingMultiplier(save, player, 'batting');

    expect(prodigyPolicy.readiness).toBeLessThan(latePolicy.readiness);
    expect(prodigyPolicy.matchAdjustment).toBeLessThan(latePolicy.matchAdjustment);
    expect(prodigyTraining).toBeGreaterThan(earlyLateTraining);
    expect(matureLateTraining).toBeGreaterThan(earlyLateTraining);
  });

  it('uses remembered agent and coach relationships in contract value', () => {
    const save = makeCareerSave();
    const base = relationshipContractMultiplier(save);
    save.relationships!.agent.level = 80;
    save.relationships!.coach.level = 70;
    expect(relationshipContractMultiplier(save)).toBeGreaterThan(base);
  });

  it('stores a durable relationship memory when a story choice changes trust', () => {
    const save = makeCareerSave();
    expect(STORY_EVENTS.some((event) => event.id === 'career_start')).toBe(true);

    const result = resolveStoryChoice(save, 'career_start', 'work', makeRng(1));

    expect(result.ok).toBe(true);
    expect(save.experience?.relationshipMemories?.[0]).toMatchObject({
      characterId: 'coach',
      delta: 12,
    });
    expect(save.experience?.relationshipMemories?.[0].consequence).toContain('selection');
  });
});

describe('country-complete domestic worlds and premium aliases', () => {
  it('uses a visible England fallback marker instead of an unsupported blank flag', () => {
    expect(COUNTRIES.find((country) => country.id === 'england')?.flag).toBe('ENG');
  });

  it.each(COUNTRIES.map((country) => [country.id, country.name]))(
    'builds three eight-club domestic divisions for %s',
    (countryId, countryName) => {
      const requiredTeamId = playerDomesticBlueprints(countryId).find(
        (team) => team.tier === 3,
      )!.id;
      const world = buildPlayerLeagueWorld(41, {
        country: countryId,
        userDivision: 3,
        requiredTeamId,
      });
      expect(world.divisions.tier1).toHaveLength(8);
      expect(world.divisions.tier2).toHaveLength(8);
      expect(world.divisions.tier3).toHaveLength(8);
      expect(
        [...world.divisions.tier1, ...world.divisions.tier2, ...world.divisions.tier3!].every(
          (teamId) => world.teams[teamId].country === countryId,
        ),
      ).toBe(true);
      expect(world.leagues['league-1'].name).toBe(`${countryName} Local T20 Division`);
    },
  );

  it('applies premium names and restores defaults when premium lapses', () => {
    const save = makeCareerSave();
    const now = Date.now();
    activateSeasonPass(save, {
      now,
      provider: 'REVENUECAT',
      expiresAt: now + SEASON_PASS_PERIOD_MS,
    });
    ensureSeasonPassBranding(save);
    const teamId = save.userTeamId!;
    const leagueId = Object.keys(save.leagues)[0];
    const originalTeam = save.teams[teamId].name;
    const originalLeague = save.leagues[leagueId].name;

    expect(
      updateSeasonPassBranding(save, {
        teamNames: { [teamId]: 'My City XI' },
        leagueNames: { [leagueId]: 'My T20 Championship' },
      }).ok,
    ).toBe(true);
    expect(save.teams[teamId].name).toBe('My City XI');
    expect(save.leagues[leagueId].name).toBe('My T20 Championship');

    save.entitlements.seasonPass!.expiresAt = now - 1;
    synchronizeSeasonPassBranding(save);
    expect(save.teams[teamId].name).toBe(originalTeam);
    expect(save.leagues[leagueId].name).toBe(originalLeague);
    expect(save.seasonPassBranding?.customTeamNames[teamId]).toBe('My City XI');
  });
});

describe('manager staff market and club appeal', () => {
  it('hires atomically and a stronger coach raises the canonical club rating', () => {
    const save = makeManagerSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 10_000_000;
    save.finances!.transferBudget = team.budget;
    const current = staffByRole(save, 'BATTING_COACH')!;
    const candidate = save
      .staffCandidates!.filter((member) => member.role === 'BATTING_COACH')
      .sort((a, b) => b.quality - a.quality)[0];
    candidate.quality = Math.min(92, Math.max(candidate.quality, current.quality + 10));
    const beforeRating = calculateClubRating(save);
    const beforeBudget = team.budget;

    const result = hireStaff(save, candidate.id);

    expect(result.ok).toBe(true);
    expect(team.budget).toBeLessThan(beforeBudget);
    expect(save.finances?.transferBudget).toBe(team.budget);
    expect(staffByRole(save, 'BATTING_COACH')?.id).not.toBe(current.id);
    expect(calculateClubRating(save)).toBeGreaterThan(beforeRating);
  });

  it('a stronger commercial director increases elite-player attraction', () => {
    const save = makeManagerSave();
    const director = staffByRole(save, 'MARKETING_DIRECTOR')!;
    director.quality = 35;
    const low = superstarAttractionChance(save);
    director.quality = 90;
    const high = superstarAttractionChance(save);
    expect(high).toBeGreaterThan(low);
  });
});
