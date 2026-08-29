import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { buildManagerLeagueWorld, buildPlayerLeagueWorld } from '../../generation/world';
import { runMigrations } from '../../storage/migrate';
import { accrueNationalRep, declareInternationalCountry, tickCareerResidency } from '../career';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { managerDomesticBlueprints, playerDomesticBlueprints } from '../domesticBranding';
import { generateInternationalWindowFixtures } from '../intlCalendar';
import {
  buildPlayerSeasonCalendar,
  currentPlayerCalendarEvent,
  resolvePlayerCalendarEvent,
} from '../playerCalendar';
import { applyPendingPlayerCountryMove } from '../playerMigration';

function player(age = 21) {
  return buildUserPlayer({
    name: 'Architecture Player',
    age,
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: {
      technique: 74,
      timing: 74,
      power: 72,
      footwork: 72,
      temperament: 74,
      running: 70,
    },
    bowling: {
      paceOrSpin: 72,
      accuracy: 74,
      movement: 70,
      variations: 70,
      stamina: 74,
    },
    fielding: { catching: 70, throwing: 70, agility: 70, keeping: 20 },
    meta: { fitness: 76, confidence: 70, aggression: 66, discipline: 72 },
  });
}

function career(age = 21) {
  return createCareerSave({
    player: player(age),
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 404,
  });
}

describe('Player Career architecture', () => {
  it('uses 24 domestic clubs, three tiers and 14 T20 matches per club', () => {
    const save = career();
    const clubs = Object.values(save.teams).filter((team) => !team.isNationalTeam);
    const userT20 = Object.values(save.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 't20-league' &&
        (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId),
    );

    expect(clubs).toHaveLength(24);
    expect(save.divisions?.tier1).toHaveLength(8);
    expect(save.divisions?.tier2).toHaveLength(8);
    expect(save.divisions?.tier3).toHaveLength(8);
    expect(save.userDivision).toBe(3);
    expect(userT20).toHaveLength(14);
  });

  it('keeps Player and Manager club identities distinct and country-specific', () => {
    const playerBlueprint = playerDomesticBlueprints('australia')[0];
    const managerBlueprint = managerDomesticBlueprints('australia')[0];
    const playerWorld = buildPlayerLeagueWorld(11, {
      country: 'australia',
      userDivision: 3,
      requiredTeamId: playerDomesticBlueprints('australia').find((team) => team.tier === 3)!.id,
    });
    const managerWorld = buildManagerLeagueWorld(12, {
      country: 'australia',
      userDivision: 3,
      requiredTeamId: managerDomesticBlueprints('australia').find((team) => team.tier === 3)!.id,
    });

    expect(playerBlueprint.name).not.toBe(managerBlueprint.name);
    expect(
      Object.values(playerWorld.teams)
        .filter((team) => !team.isNationalTeam)
        .every((team) => team.country === 'australia'),
    ).toBe(true);
    expect(
      Object.values(managerWorld.teams)
        .filter((team) => !team.isNationalTeam)
        .every((team) => team.country === 'australia'),
    ).toBe(true);
  });

  it('takes School and Under-19 players directly to matches while keeping senior blocks', () => {
    const school = career(14);
    const schoolState = buildPlayerSeasonCalendar(school)!;
    expect(schoolState.events).toHaveLength(6);
    expect(schoolState.events.every((item) => item.kind === 'MATCH')).toBe(true);
    expect(currentPlayerCalendarEvent(school)).toMatchObject({ kind: 'MATCH', format: 'T20' });
    expect(resolvePlayerCalendarEvent(school, 'SKILL')).toMatchObject({
      ok: false,
      reason: 'Play this fixture to advance.',
    });

    const under19 = career(18);
    const under19State = buildPlayerSeasonCalendar(under19)!;
    expect(under19State.events).toHaveLength(8);
    expect(under19State.events.every((item) => item.kind === 'MATCH')).toBe(true);
    expect(under19State.events.map((item) => item.format)).toEqual([
      'ODI',
      'ODI',
      'ODI',
      'ODI',
      'T20',
      'T20',
      'T20',
      'T20',
    ]);
    expect(currentPlayerCalendarEvent(under19)).toMatchObject({ kind: 'MATCH', format: 'ODI' });

    const senior = career(21);
    const state = buildPlayerSeasonCalendar(senior)!;
    expect(state.events.some((item) => item.kind === 'SELECTION')).toBe(true);
    expect(
      state.events.filter(
        (item) => item.kind === 'MATCH' && item.format === 'T20' && !item.id.includes('playoff'),
      ),
    ).toHaveLength(14);
    expect(state.events.at(-1)?.kind).toBe('TRANSFER_WINDOW');
  });

  it('unlocks residency eligibility, locks only the first cap and schedules year-round tours', () => {
    const save = career();
    const resources = save.playerCareerResources!;
    save.teams[save.userTeamId!].country = 'australia';
    resources.domesticCountry = 'australia';
    tickCareerResidency(save);
    tickCareerResidency(save);
    expect(tickCareerResidency(save)).toBe('australia');
    expect(resources.eligibleCountries).toContain('australia');
    expect(declareInternationalCountry(save, 'australia').ok).toBe(true);

    save.players.user.overall = 85;
    save.players.user.age = 22;
    save.nationalRep = 79;
    expect(accrueNationalRep(save, save.players.user, 10, { runs: 140, wickets: 5 }).calledUp).toBe(
      true,
    );
    expect(resources.cappedCountry).toBeUndefined();
    expect(declareInternationalCountry(save, 'india').ok).toBe(true);
    expect(declareInternationalCountry(save, 'australia').ok).toBe(true);
    save.userCaps = 1;
    resources.cappedCountry = 'australia';
    expect(declareInternationalCountry(save, 'india').ok).toBe(false);

    const ids = generateInternationalWindowFixtures(save);
    expect(ids).toHaveLength(48);
    expect(ids.every((id) => save.fixtures[id].calendarMonth !== 4)).toBe(true);
    expect(ids.every((id) => save.fixtures[id].calendarMonth !== 5)).toBe(true);
    expect(ids.some((id) => save.fixtures[id].cupRound === 'Semi-Final')).toBe(false);
    expect(ids.some((id) => save.fixtures[id].cupRound === 'Final')).toBe(false);
    expect(ids.every((id) => save.fixtures[id].homeTeamId === 'national-australia')).toBe(true);
  });

  it('applies an off-season country move without changing birth nationality', () => {
    const save = career();
    save.pendingDomesticCountry = 'england';
    expect(applyPendingPlayerCountryMove(save, 'season-2027', 2027)).toBe(true);

    expect(save.players.user.nationality).toBe('india');
    expect(save.playerCareerResources?.domesticCountry).toBe('england');
    expect(save.teams[save.userTeamId!].country).toBe('england');
    expect(save.franchiseTeamId).toBeDefined();
    expect(save.teams[save.franchiseTeamId!].country).toBe('india');
    expect(
      Object.values(save.teams)
        .filter((team) => !team.isNationalTeam && team.id !== save.franchiseTeamId)
        .every((team) => team.country === 'england'),
    ).toBe(true);
  });

  it('upgrades a two-tier in-progress save without losing a played result', () => {
    const save = career();
    const userTeamId = save.userTeamId!;
    const displaced = save.divisions!.tier2[0];
    save.divisions!.tier2[0] = userTeamId;
    save.divisions!.tier3 = save.divisions!.tier3!.map((id) =>
      id === userTeamId ? displaced : id,
    );
    save.userDivision = 2;
    save.leagues['league-1'].teamIds = [...save.divisions!.tier2];
    save.leagues['league-1'].divisionTier = 2;
    save.leagues['league-2'].teamIds = [...save.divisions!.tier1];
    save.leagues['league-2'].divisionTier = 1;
    delete save.leagues['league-3'];
    delete save.divisions!.tier3;

    const retained = Object.values(save.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 't20-league' &&
        fixture.round <= 7 &&
        save.divisions!.tier2.includes(fixture.homeTeamId) &&
        save.divisions!.tier2.includes(fixture.awayTeamId),
    );
    save.fixtures = Object.fromEntries(retained.map((fixture) => [fixture.id, fixture]));
    const playedId = retained[0].id;
    save.fixtures[playedId].played = true;
    save.fixtures[playedId].resultKind = 'HOME_WIN';
    save.fixtures[playedId].winnerTeamId = save.fixtures[playedId].homeTeamId;
    const season = save.seasons[save.currentSeasonId!];
    season.fixtureIds = retained.map((fixture) => fixture.id);
    season.leagueIds = ['league-1', 'league-2'];
    season.competitions = season.competitions?.map((competition) => ({
      ...competition,
      fixtureIds: competition.id === 't20-league' ? retained.map((fixture) => fixture.id) : [],
    }));
    save.playerCalendar = undefined;
    save.schemaVersion = 20;

    const migrated = runMigrations(JSON.parse(JSON.stringify(save)))!;
    const userT20 = Object.values(migrated.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 't20-league' &&
        (fixture.homeTeamId === userTeamId || fixture.awayTeamId === userTeamId),
    );
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.divisions?.tier3).toHaveLength(8);
    expect(userT20).toHaveLength(14);
    expect(migrated.fixtures[playedId]).toMatchObject({
      played: true,
      resultKind: 'HOME_WIN',
    });
  });
});
