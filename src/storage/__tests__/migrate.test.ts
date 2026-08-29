import { Player, SAVE_SCHEMA_VERSION } from '../../domain/types';
import { computeOverall } from '../../engine/rating';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import { PASS_BALANCE_VERSION, passLevel, xpForTier } from '../../game/liveops';
import { runMigrations } from '../migrate';

function player(overall: number): Player {
  return {
    id: 'user',
    name: 'User',
    nationality: 'india',
    age: 20,
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: {
      technique: overall,
      timing: overall,
      power: overall,
      footwork: overall,
      temperament: overall,
      running: overall,
    },
    bowling: { paceOrSpin: 30, accuracy: 30, movement: 30, variations: 30, stamina: 30 },
    fielding: { catching: overall, throwing: overall, agility: overall, keeping: overall },
    meta: {
      fitness: overall,
      form: overall,
      confidence: overall,
      aggression: overall,
      discipline: overall,
    },
    potential: 90,
    traits: [],
    overall: 1,
    isUserPlayer: true,
  };
}

describe('save migrations', () => {
  it('adds tied counts to v10 league tables without converting old no-results', () => {
    const migrated = runMigrations({
      schemaVersion: 10,
      id: 'legacy',
      leagues: {
        l1: {
          table: [
            { teamId: 'a', played: 1, won: 0, lost: 0, noResult: 1, points: 1, netRunRate: 0 },
          ],
        },
      },
    });

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.leagues.l1.table[0].tied).toBe(0);
    expect(migrated?.leagues.l1.table[0].noResult).toBe(1);
  });

  it('recomputes stale stored player overall values in v11 saves', () => {
    const stale = player(70);
    stale.overall = 12;

    const migrated = runMigrations({
      schemaVersion: 11,
      id: 'legacy',
      players: { user: stale },
    });

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.players.user.overall).toBe(computeOverall(stale));
  });

  it('repairs an existing age-33 youth career during the v12 to v13 migration', () => {
    const stale = player(55);
    stale.age = 33;

    const migrated = runMigrations({
      schemaVersion: 12,
      id: 'legacy',
      mode: 'career',
      userPlayerId: 'user',
      careerPathLevel: 'U19',
      careerPathMatches: 10,
      careerPathRuns: 400,
      careerPathWickets: 5,
      careerPathRatingSum: 72,
      players: { user: stale },
    });

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.careerPathLevel).toBe('DOMESTIC');
    expect(migrated?.careerPathMatches).toBe(0);
    expect(migrated?.careerPathRuns).toBe(0);
    expect(migrated?.careerPathWickets).toBe(0);
    expect(migrated?.careerPathRatingSum).toBe(0);
  });

  it('migrates a schema-13 Player Career into canonical schema-14 resources', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 13;
    legacy.updatedAt = 1_234_567;
    legacy.wallet = { coins: 4321, gems: 17, energy: 19, energyUpdatedAt: 100 };
    legacy.inventory = {
      training_accelerator: 2,
      contract_boost_token: 1,
      avatar_legend_frame: 1,
    };
    legacy.players[legacy.userPlayerId!].meta.fitness = 73;
    legacy.players[legacy.userPlayerId!].meta.form = 68;
    legacy.players[legacy.userPlayerId!].meta.confidence = 64;
    delete legacy.players[legacy.userPlayerId!].condition;
    delete legacy.premiumWallet;
    delete legacy.premiumInventory;
    delete legacy.playerCareerResources;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.premiumWallet).toEqual({
      accountCoins: 4321,
      gems: 17,
      updatedAt: 1_234_567,
      version: 1,
    });
    expect(migrated?.premiumInventory?.trainingAcceleratorCharges).toBe(2);
    expect(migrated?.premiumInventory?.contractBoostTokens).toBe(1);
    expect(migrated?.inventory?.avatar_legend_frame).toBe(1);
    expect(migrated?.playerCareerResources).toMatchObject({
      trainingFocus: 19,
      playerCondition: 73,
      form: 68,
      confidence: 64,
    });
  });

  it('initializes schema-20 player workload and media state without changing fitness', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 19;
    legacy.players[legacy.userPlayerId!].meta.fitness = 67;
    delete legacy.players[legacy.userPlayerId!].condition;
    delete legacy.playerCareerResources;
    legacy.experience = {
      ...legacy.experience,
      mediaScrapbook: [],
      pendingNewspaperId: 'missing-story',
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.players[migrated.userPlayerId!].meta.fitness).toBe(67);
    expect(migrated?.playerCareerResources).toMatchObject({
      playerCondition: 100,
      coachTrust: 55,
      specialization: 'ALL_FORMATS',
      consecutiveMatches: 0,
    });
    expect(migrated?.experience?.pendingNewspaperId).toBeUndefined();
  });

  it('migrates schema-13 Manager finances without changing the old budget view', () => {
    const legacy = makeManagerSave();
    legacy.schemaVersion = 13;
    legacy.updatedAt = 9_876;
    const team = legacy.teams[legacy.userTeamId!];
    team.budget = 1_250_000;
    legacy.finances = { transferBudget: 1_100_000, wageBudgetPerSeason: 750_000 };
    legacy.inventory = { facility_upgrade_token: 2, squad_recovery_token: 3 };
    delete legacy.premiumWallet;
    delete legacy.premiumInventory;
    delete legacy.clubFinance;
    delete legacy.managerProgression;
    delete legacy.auctionAssistants;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.teams[legacy.userTeamId!].budget).toBe(1_250_000);
    expect(migrated?.finances?.transferBudget).toBe(1_100_000);
    expect(migrated?.clubFinance?.clubBalance).toEqual({
      amountMinor: '125000000',
      currencyCode: 'INR',
    });
    expect(migrated?.clubFinance?.transferBudget.amountMinor).toBe('110000000');
    expect(migrated?.clubFinance?.wageBudget.amountMinor).toBe('75000000');
    expect(migrated?.premiumInventory?.facilityUpgradeTokens).toBe(2);
    expect(migrated?.premiumInventory?.squadRecoveryTokens).toBe(3);
    expect(migrated?.managerProgression?.currentClubId).toBe(legacy.userTeamId);
    expect(migrated?.managerProgression?.reputation).toBe(team.reputation);
    expect(migrated?.auctionAssistants).toEqual({});
  });

  it('migrates schema-14 saves into persistent career identities without changing balances', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 14;
    legacy.wallet = { coins: 777, gems: 3, energy: 12, energyUpdatedAt: 100 };
    delete legacy.experience;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.wallet).toEqual(legacy.wallet);
    expect(migrated?.experience?.playerArchetype).toBeDefined();
    expect(migrated?.experience?.coachPersonality).toBeDefined();
  });

  it('migrates schema-15 saves into durable journey, branding and staff state', () => {
    const legacy = makeManagerSave();
    legacy.schemaVersion = 15;
    legacy.staff = legacy.staff?.filter(
      (member) => member.role !== 'FIELDING_COACH' && member.role !== 'MARKETING_DIRECTOR',
    );
    delete legacy.staffCandidates;
    delete legacy.seasonPassBranding;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.staff?.some((member) => member.role === 'FIELDING_COACH')).toBe(true);
    expect(migrated?.staff?.some((member) => member.role === 'MARKETING_DIRECTOR')).toBe(true);
    expect(migrated?.staffCandidates?.length).toBeGreaterThan(0);
    expect(migrated?.seasonPassBranding?.originalTeamNames[legacy.userTeamId!]).toBeDefined();
  });

  it('migrates a schema-16 premium flag into one bounded period and keeps pass progress', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 16;
    legacy.updatedAt = Date.UTC(2026, 6, 22);
    legacy.pass = {
      seasonId: legacy.currentSeasonId ?? 'legacy-season',
      xp: 1_250,
      premium: true,
      claimedFree: [1, 2],
      claimedPremium: [1],
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));
    const legacyTierEightFloor = 1_088;
    const legacyTierNineGate = 1_296;
    const legacyFraction =
      (legacy.pass.xp - legacyTierEightFloor) / (legacyTierNineGate - legacyTierEightFloor);
    const expectedRemappedXp = Math.round(
      xpForTier(8) + (xpForTier(9) - xpForTier(8)) * legacyFraction,
    );

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.pass?.balanceVersion).toBe(PASS_BALANCE_VERSION);
    expect(migrated?.pass?.xp).toBe(expectedRemappedXp);
    expect(expectedRemappedXp).toBe(3_460);
    expect(passLevel(migrated?.pass?.xp ?? 0)).toBe(8);
    expect(((migrated?.pass?.xp ?? 0) - xpForTier(8)) / (xpForTier(9) - xpForTier(8))).toBeCloseTo(
      legacyFraction,
      2,
    );
    expect(migrated?.pass?.claimedFree).toEqual([1, 2]);
    expect(migrated?.pass?.claimedPremium).toEqual([1]);
    expect(migrated?.entitlements.seasonPass?.premium).toBe(true);
    expect(migrated?.entitlements.seasonPass?.provider).toBe('LEGACY_MIGRATION');
    expect(migrated?.entitlements.seasonPass?.expiresAt).toBeGreaterThan(
      migrated?.entitlements.seasonPass?.periodStartedAt ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it('migrates schema-17 monthly content and Manager wallet state without changing balances', () => {
    const legacy = makeManagerSave();
    legacy.schemaVersion = 17;
    legacy.wallet.coins = 4_321;
    legacy.wallet.gems = 54;
    legacy.seasonPassExperience = {
      scenarios: {
        existing: {
          id: 'existing',
          matches: 1,
          wins: 1,
          runs: 0,
          wickets: 0,
          completed: false,
          rewardClaimed: false,
        },
      },
      selectedStadiumTheme: 'stadium_classic',
      selectedOfficeTheme: 'office_classic',
      selectedProfileFrame: 'frame_none',
    };
    delete legacy.managerResources;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.wallet.coins).toBe(4_321);
    expect(migrated?.wallet.gems).toBe(54);
    expect(migrated?.seasonPassExperience?.scenarios.existing?.matches).toBe(1);
    expect(migrated?.managerResources).toEqual({
      totalCoinsSpent: 0,
      totalGemsSpent: 0,
      transactions: [],
    });
  });

  it('snapshots cumulative caps when upgrading a v21 Player Career', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 21;
    legacy.userCaps = 47;
    delete legacy.userCapsAtSeasonStart;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.userCapsAtSeasonStart).toBe(47);
  });

  it('initializes manager salary and international cycle state when upgrading v23', () => {
    const legacy = makeManagerSave();
    legacy.schemaVersion = 23;
    delete legacy.managerProgression!.contractSalary;
    delete legacy.wtcCycles;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.managerProgression?.contractSalary).toBeGreaterThan(0);
    expect(migrated?.wtcCycles).toEqual({});
  });

  it('removes only unplayed eager ICC knockouts when upgrading v24', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 24;
    const season = legacy.seasons[legacy.currentSeasonId!];
    const base = Object.values(legacy.fixtures)[0];
    legacy.fixtures['legacy-world-cup-semi'] = {
      ...base,
      id: 'legacy-world-cup-semi',
      competition: 'INTL_TOURNAMENT',
      competitionId: 't20-world-cup-2026',
      cupRound: 'Semi-Final',
      playoff: true,
      played: false,
    };
    legacy.fixtures['legacy-world-cup-final'] = {
      ...base,
      id: 'legacy-world-cup-final',
      competition: 'INTL_TOURNAMENT',
      competitionId: 't20-world-cup-2026',
      cupRound: 'Final',
      playoff: true,
      played: true,
    };
    season.fixtureIds.push('legacy-world-cup-semi', 'legacy-world-cup-final');

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.fixtures['legacy-world-cup-semi']).toBeUndefined();
    expect(migrated?.fixtures['legacy-world-cup-final']).toBeDefined();
    expect(migrated?.seasons[migrated.currentSeasonId!].fixtureIds).not.toContain(
      'legacy-world-cup-semi',
    );
    expect(migrated?.internationalTournaments).toEqual({});
  });

  it('moves a v25 School player out of the senior roster and removes potential labels', () => {
    const legacy = makeCareerSave(81);
    legacy.schemaVersion = 25;
    legacy.careerPathLevel = 'SCHOOL';
    legacy.players[legacy.userPlayerId!].age = 14;
    delete legacy.careerPathTeamId;
    const fixture = Object.values(legacy.fixtures)[0];
    fixture.competitionId = 'youth-u14';
    fixture.homeTeamId = legacy.userTeamId!;
    legacy.scoutReports = [
      {
        playerId: legacy.userPlayerId!,
        knownOverall: legacy.players[legacy.userPlayerId!].overall,
        uncertainty: 0.2,
        scoutedYear: 2026,
        recommended: true,
        potentialBand: 'Generational',
      } as never,
    ];

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.careerPathTeamId).toBeDefined();
    expect(migrated?.teams[migrated.userTeamId!].playerIds).not.toContain(migrated?.userPlayerId);
    expect(migrated?.teams[migrated.careerPathTeamId!].playerIds).toContain(migrated?.userPlayerId);
    expect(migrated?.fixtures[fixture.id].homeTeamId).toBe(migrated?.careerPathTeamId);
    expect('potentialBand' in migrated!.scoutReports![0]).toBe(false);
  });

  it('starts exact per-format season ledgers without inventing v28 history', () => {
    const legacy = makeCareerSave(82);
    legacy.schemaVersion = 28;
    const player = legacy.players[legacy.userPlayerId!];
    player.seasonStats = {
      matches: 8,
      runs: 412,
      balls: 300,
      fours: 40,
      sixes: 12,
      highScore: 121,
      notOuts: 1,
      fifties: 3,
      hundreds: 1,
      wickets: 9,
      ballsBowled: 210,
      runsConceded: 240,
      bestBowling: '4/28',
      catches: 5,
      stumpings: 0,
    };
    delete player.seasonFormatStats;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));
    const migratedPlayer = migrated?.players[migrated.userPlayerId!];

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migratedPlayer?.seasonStats).toMatchObject({ matches: 8, runs: 412, wickets: 9 });
    expect(migratedPlayer?.seasonFormatStats).toEqual({});
  });

  it('replaces generated numeric team codes in v30 saves and their branding snapshots', () => {
    const legacy = makeManagerSave(83);
    legacy.schemaVersion = 30;
    const teamId = Object.keys(legacy.teams).find((id) => id.startsWith('manager_'))!;
    legacy.teams[teamId].shortName = 'KS32';
    legacy.seasonPassBranding = {
      customTeamNames: {},
      customLeagueNames: {},
      originalTeamNames: {
        [teamId]: { name: legacy.teams[teamId].name, shortName: 'KS32' },
      },
      originalLeagueNames: {},
      applied: false,
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)));

    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.teams[teamId].shortName).toMatch(/^[A-Z]{2,4}$/);
    expect(migrated?.seasonPassBranding?.originalTeamNames[teamId].shortName).toBe(
      migrated?.teams[teamId].shortName,
    );
  });

  it('rejects an unsupported migration gap instead of relabelling the save', () => {
    expect(runMigrations({ schemaVersion: 1, id: 'unsupported' })).toBeNull();
  });
});
