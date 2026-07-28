import { TEAM_BLUEPRINTS } from '../../content/teams';
import { ECONOMY } from '../../data/gameConfig';
import { SAVE_SCHEMA_VERSION, SaveGame } from '../../domain/types';
import { runMigrations } from '../../storage/migrate';
import {
  addCoins,
  canSpendEnergy,
  fixtureEnergyCost,
  matchEnergyCost,
  regenEnergy,
  simulateFirstWeekNoSpendLoop,
  simulateNoSpendLoop,
  spendEnergy,
  startingWallet,
} from '../economy';
import { buildUserPlayer, createCareerSave } from '../createGame';
import {
  finishSeason,
  nextUserFixtureId,
  playUserFixture,
  runFixture,
  seasonComplete,
  standings,
  startNewSeason,
} from '../season';

function makeCareer(): SaveGame {
  const player = buildUserPlayer({
    name: 'Test User',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
    bowling: { paceOrSpin: 60, accuracy: 60, movement: 60, variations: 60, stamina: 60 },
    fielding: { catching: 60, throwing: 60, agility: 60, keeping: 30 },
    meta: { fitness: 70, confidence: 60, aggression: 55, discipline: 60 },
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 12345,
  });
}

describe('createGame', () => {
  it('embeds the user in their team and builds a full world', () => {
    const save = makeCareer();
    expect(save.userPlayerId).toBe('user');
    expect(save.userTeamId).toBe(TEAM_BLUEPRINTS[0].id);
    expect(save.players.user).toBeDefined();
    expect(save.players.user.overall).toBeGreaterThan(0);
    const team = save.teams[save.userTeamId!];
    expect(team.playerIds).toContain('user');
    expect(team.playerIds).toHaveLength(22);
    expect(team.xi).toHaveLength(11);
    expect(team.xi).toContain('user');
    expect(Object.values(save.teams).filter((candidate) => !candidate.isNationalTeam)).toHaveLength(
      24,
    );
    expect(
      Object.values(save.fixtures).filter(
        (fixture) => fixture.competitionId === 't20-league',
      ),
    ).toHaveLength(168);
    expect(save.userDivision).toBe(3);
    expect(save.divisions?.tier1).toHaveLength(8);
    expect(save.divisions?.tier2).toHaveLength(8);
    expect(save.divisions?.tier3).toHaveLength(8);
    expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('serializes and migrates back to an identical save', () => {
    const save = makeCareer();
    const roundTripped = runMigrations(JSON.parse(JSON.stringify(save)));
    expect(roundTripped).toEqual(save);
  });
});

describe('migrations', () => {
  it('accepts current-version saves and rejects invalid/newer ones', () => {
    expect(runMigrations(null)).toBeNull();
    expect(runMigrations({})).toBeNull();
    expect(runMigrations({ schemaVersion: SAVE_SCHEMA_VERSION + 5 })).toBeNull();
    const ok = runMigrations({ schemaVersion: SAVE_SCHEMA_VERSION, id: 'x' });
    expect(ok).not.toBeNull();
  });
});

describe('economy', () => {
  it('regenerates, spends and grants correctly', () => {
    const w0 = startingWallet(1_000_000);
    expect(w0.energy).toBe(ECONOMY.energyMax);
    expect(w0.gems).toBe(0);

    const low = { coins: 100, gems: 0, energy: 10, energyUpdatedAt: 1_000_000 };
    const regen = regenEnergy(low, 1_000_000 + 20 * 60 * 1000);
    expect(regen.energy).toBe(10 + Math.floor(20 / ECONOMY.energyRegenMinutes));

    expect(spendEnergy(w0, ECONOMY.energyPerMatch).energy).toBe(
      ECONOMY.energyMax - ECONOMY.energyPerMatch,
    );
    expect(addCoins(w0, 250).coins).toBe(w0.coins + 250);
  });

  it('prevents negative-energy and negative-cost exploits', () => {
    const wallet = { coins: 0, gems: 0, energy: 4, energyUpdatedAt: 0 };
    expect(canSpendEnergy(wallet, 0)).toBe(false);
    expect(canSpendEnergy(wallet, -5)).toBe(false);
    expect(canSpendEnergy(wallet, 5)).toBe(false);
    expect(spendEnergy(wallet, -5).energy).toBe(4);
    expect(spendEnergy(wallet, 999).energy).toBe(0);
  });

  it('keeps a two-hour no-spend loop clear of early energy walls', () => {
    const sim = simulateNoSpendLoop({ minutes: 120, matchDurationMinutes: 8 });
    expect(sim.matchesPlayed).toBeGreaterThanOrEqual(14);
    expect(sim.energyBlocks).toBeLessThanOrEqual(1);
    expect(sim.minutesUntilNextMatch).toBe(0);
  });

  it('keeps the first week playable for a no-spend daily user', () => {
    const sim = simulateFirstWeekNoSpendLoop({
      days: 7,
      dailySessionMinutes: 45,
      matchDurationMinutes: 8,
      fixtureCosts: [
        matchEnergyCost('T20', 'YOUTH'),
        matchEnergyCost('T20'),
        matchEnergyCost('ODI'),
      ],
    });

    expect(sim.totalMatchesPlayed).toBeGreaterThanOrEqual(35);
    expect(sim.blockedDays).toBeLessThanOrEqual(1);
    expect(sim.averageMatchesPerDay).toBeGreaterThanOrEqual(5);
    expect(sim.minutesUntilNextMatch).toBe(0);
  });

  it('prices match energy by format and career level', () => {
    expect(matchEnergyCost('T20')).toBe(ECONOMY.energyPerMatch);
    expect(matchEnergyCost('ODI')).toBeGreaterThan(matchEnergyCost('T20'));
    expect(matchEnergyCost('TEST')).toBeGreaterThan(matchEnergyCost('ODI'));
    expect(matchEnergyCost('T20', 'YOUTH')).toBeLessThan(matchEnergyCost('T20', 'DOMESTIC'));
    expect(matchEnergyCost('T20', 'INTERNATIONAL')).toBeGreaterThan(
      matchEnergyCost('T20', 'DOMESTIC'),
    );
  });

  it('detects youth and international fixture energy levels', () => {
    expect(fixtureEnergyCost({ format: 'T20', competitionId: 'youth-u14' })).toBe(
      matchEnergyCost('T20', 'YOUTH'),
    );
    expect(fixtureEnergyCost({ format: 'ODI', competition: 'BILATERAL_SERIES' })).toBe(
      matchEnergyCost('ODI', 'INTERNATIONAL'),
    );
  });
});

describe('season flow', () => {
  it('plays the user fixture, completes the season and keeps the table consistent', () => {
    const save = makeCareer();
    const fixtureId = nextUserFixtureId(save);
    expect(fixtureId).toBeDefined();
    const fx = save.fixtures[fixtureId!];
    expect([fx.homeTeamId, fx.awayTeamId]).toContain(save.userTeamId);

    const match = playUserFixture(save, fixtureId!);
    expect(save.fixtures[fixtureId!].played).toBe(true);
    expect(match.innings).toHaveLength(2);

    finishSeason(save);
    expect(seasonComplete(save)).toBe(true);

    const table = standings(save);
    for (const row of table) expect(row.played).toBe(14); // home-and-away in an 8-team tier
    const totalPoints = table.reduce((a, r) => a + r.points, 0);
    expect(totalPoints).toBe(2 * 56); // every match distributes exactly 2 points

    expect(save.players.user.careerStats?.matches ?? 0).toBeGreaterThan(0);
  });

  it('starts a fresh season and ages the squad', () => {
    const save = makeCareer();
    finishSeason(save);
    const ageBefore = save.players.user.age;
    startNewSeason(save);
    expect(seasonComplete(save)).toBe(false);
    expect(Object.keys(save.fixtures)).toHaveLength(336);
    expect(save.players.user.age).toBe(ageBefore + 1);
  });

  it('simulates fixtures deterministically', () => {
    const save = makeCareer();
    const id = Object.keys(save.fixtures)[0];
    expect(JSON.stringify(runFixture(save, id))).toBe(JSON.stringify(runFixture(save, id)));
  });
});
