import {
  DomesticTier,
  Fixture,
  LeagueRow,
  ManagerCalendarPhase,
  ManagerCareerLevel,
  ManagerPhaseSummary,
  SaveGame,
  SeasonCompetition,
} from '../domain/types';
import { getCountry } from '../data/countries';
import {
  buildDoubleRoundRobin,
  buildRoundRobin,
  DIV1_LEAGUE_ID,
  DIV2_LEAGUE_ID,
  DIV3_LEAGUE_ID,
} from '../generation/world';
import { addCoins, matchReward } from './economy';
import { domesticLeagueName } from './domesticBranding';
import { clamp } from '../utils/math';
import {
  generateCountryInternationalWindowFixtures,
  internationalWindowPlan,
} from './intlCalendar';

export const MANAGER_PHASE_ORDER: ManagerCalendarPhase[] = [
  'LIST_A',
  'FIRST_CLASS',
  'T20',
  'OFF_SEASON',
];

export const MANAGER_PHASE_LABEL: Record<ManagerCalendarPhase, string> = {
  LIST_A: '50-Over Championship',
  FIRST_CLASS: 'Four-Day Shield',
  T20: 'T20 League',
  OFF_SEASON: 'Transfer & Contracts Window',
};

export const MANAGER_PHASE_MONTHS: Record<ManagerCalendarPhase, string> = {
  LIST_A: 'September - November',
  FIRST_CLASS: 'December - March',
  T20: 'March - May',
  OFF_SEASON: 'June - August',
};

const PHASE_COMPETITION: Record<Exclude<ManagerCalendarPhase, 'OFF_SEASON'>, string> = {
  LIST_A: 'list-a',
  FIRST_CLASS: 'first-class',
  T20: 't20-league',
};

const PHASE_FORMAT = {
  LIST_A: 'ODI',
  FIRST_CLASS: 'TEST',
  T20: 'T20',
} as const;

const PHASE_START_MONTH: Record<ManagerCalendarPhase, number> = {
  LIST_A: 9,
  FIRST_CLASS: 12,
  T20: 3,
  OFF_SEASON: 6,
};

const LEAGUE_IDS = [DIV1_LEAGUE_ID, DIV2_LEAGUE_ID, DIV3_LEAGUE_ID] as const;
const TIERS: DomesticTier[] = [1, 2, 3];

function emptyTable(teamIds: string[]): LeagueRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
  }));
}

function tierTeamIds(save: SaveGame, tier: DomesticTier): string[] {
  if (!save.divisions) return [];
  if (tier === 1) return save.divisions.tier1;
  if (tier === 2) return save.divisions.tier2;
  return save.divisions.tier3 ?? [];
}

export function managerCalendarEnabled(save: SaveGame): boolean {
  return save.mode === 'manager' && Boolean(save.managerCalendar);
}

export function managerPhaseUnlocked(
  level: ManagerCareerLevel,
  phase: ManagerCalendarPhase,
): boolean {
  if (phase === 'T20' || phase === 'OFF_SEASON') return true;
  if (phase === 'LIST_A') return level !== 'CLUB';
  return level === 'ELITE' || level === 'NATIONAL';
}

export function managerCompetitionId(phase: ManagerCalendarPhase): string | undefined {
  return phase === 'OFF_SEASON' ? undefined : PHASE_COMPETITION[phase];
}

function fixtureMonth(phase: Exclude<ManagerCalendarPhase, 'OFF_SEASON'>, round: number): number {
  if (phase === 'LIST_A') return [9, 9, 9, 10, 10, 10, 11][round - 1] ?? 11;
  if (phase === 'FIRST_CLASS') return [12, 1, 1, 2, 2, 3, 3][round - 1] ?? 3;
  return [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5][round - 1] ?? 5;
}

/**
 * Build one complete manager year. Every tier and format is scheduled even
 * when the manager's current rank means a block will be simulated.
 */
export function buildManagerSeasonCalendar(save: SaveGame, year: number): void {
  if (save.mode !== 'manager' || !save.currentSeasonId) return;
  const seasonId = save.currentSeasonId;
  const countryId = save.userTeamId ? save.teams[save.userTeamId]?.country : undefined;
  const country = getCountry(countryId ?? '')?.name ?? 'National';
  const fixtureIdsByCompetition: Record<string, string[]> = {
    'list-a': [],
    'first-class': [],
    't20-league': [],
    'national-window': [],
  };
  const fixtures: Record<string, Fixture> = {};

  for (const tier of TIERS) {
    const teamIds = tierTeamIds(save, tier);
    if (teamIds.length < 2) continue;
    for (const phase of ['LIST_A', 'FIRST_CLASS', 'T20'] as const) {
      const competitionId = PHASE_COMPETITION[phase];
      const prefix = `mgr-${year}-${competitionId}-t${tier}`;
      const generated =
        phase === 'T20'
          ? buildDoubleRoundRobin(
              teamIds,
              seasonId,
              PHASE_FORMAT[phase],
              save.teams,
              prefix,
              competitionId,
            )
          : buildRoundRobin(
              teamIds,
              seasonId,
              PHASE_FORMAT[phase],
              save.teams,
              prefix,
              competitionId,
            );
      for (const fixture of Object.values(generated)) {
        fixture.divisionTier = tier;
        fixture.managerPhase = phase;
        fixture.calendarMonth = fixtureMonth(phase, fixture.round);
        fixtures[fixture.id] = fixture;
        fixtureIdsByCompetition[competitionId].push(fixture.id);
      }
    }
  }

  const activeLeague = save.leagues[DIV1_LEAGUE_ID] ?? Object.values(save.leagues)[0];
  save.fixtures = fixtures;
  const internationalPlan = internationalWindowPlan(year);
  if (save.managerCareerLevel === 'NATIONAL' && save.managerNationalTeamId) {
    const nationalCountry =
      save.teams[save.managerNationalTeamId]?.country ?? countryId ?? 'india';
    fixtureIdsByCompetition['national-window'] =
      generateCountryInternationalWindowFixtures(save, nationalCountry, {
        controlledTeamId: save.managerNationalTeamId,
        managerPhase: 'OFF_SEASON',
      });
  }
  const competitions: SeasonCompetition[] = [
    {
      id: 'list-a',
      name: `${country} 50-Over Championship`,
      format: 'ODI',
      leagueId: activeLeague?.id ?? DIV1_LEAGUE_ID,
      fixtureIds: fixtureIdsByCompetition['list-a'],
    },
    {
      id: 'first-class',
      name: `${country} Four-Day Shield`,
      format: 'TEST',
      leagueId: activeLeague?.id ?? DIV1_LEAGUE_ID,
      fixtureIds: fixtureIdsByCompetition['first-class'],
    },
    {
      id: 't20-league',
      name: `${country} T20 League`,
      format: 'T20',
      leagueId: activeLeague?.id ?? DIV1_LEAGUE_ID,
      fixtureIds: fixtureIdsByCompetition['t20-league'],
    },
    ...(fixtureIdsByCompetition['national-window'].length
      ? [
          {
            id: internationalPlan.id,
            name: internationalPlan.name,
            format: internationalPlan.format,
            leagueId: activeLeague?.id ?? DIV1_LEAGUE_ID,
            fixtureIds: fixtureIdsByCompetition['national-window'],
          },
        ]
      : []),
  ];

  save.seasons[seasonId] = {
    id: seasonId,
    year,
    leagueIds: Object.keys(save.leagues),
    fixtureIds: Object.keys(save.fixtures),
    currentRound: 1,
    competitions,
  };
  for (const league of Object.values(save.leagues)) {
    league.table = emptyTable(league.teamIds);
  }
  save.managerCalendar = {
    year,
    phase: 'LIST_A',
    phaseStartedAtMonth: 9,
    offSeasonPrepared: false,
    backgroundCoinsThisPhase: 0,
  };
  save.currentMonth = 9;
  save.championTeamId = undefined;
}

function phaseFixtures(save: SaveGame, phase: ManagerCalendarPhase): Fixture[] {
  return Object.values(save.fixtures).filter((fixture) => fixture.managerPhase === phase);
}

export function managerControlledTeamId(
  save: SaveGame,
  phase = save.managerCalendar?.phase,
): string | undefined {
  if (phase === 'OFF_SEASON' && save.managerCareerLevel === 'NATIONAL') {
    return save.managerNationalTeamId;
  }
  return save.userTeamId;
}

function regularFixtures(
  save: SaveGame,
  phase: ManagerCalendarPhase,
  tier?: DomesticTier,
): Fixture[] {
  return phaseFixtures(save, phase).filter(
    (fixture) => !fixture.playoff && (tier == null || fixture.divisionTier === tier),
  );
}

function pointsForResult(fixture: Fixture, rowTeamId: string, phase: ManagerCalendarPhase): number {
  const winPoints = phase === 'FIRST_CLASS' ? 4 : 2;
  const drawPoints = phase === 'FIRST_CLASS' ? 2 : 1;
  if (fixture.winnerTeamId === rowTeamId) return winPoints;
  if (fixture.resultKind === 'TIE' || fixture.resultKind === 'NO_RESULT') return drawPoints;
  return 0;
}

/** Competition table derived from fixture results, independent of the T20 UI table. */
export function managerCompetitionStandings(
  save: SaveGame,
  phase: Exclude<ManagerCalendarPhase, 'OFF_SEASON'>,
  tier: DomesticTier,
): LeagueRow[] {
  const rows = new Map(
    tierTeamIds(save, tier).map((teamId) => [
      teamId,
      {
        teamId,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        netRunRate: 0,
      } satisfies LeagueRow,
    ]),
  );
  for (const fixture of regularFixtures(save, phase, tier)) {
    if (!fixture.played) continue;
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.points += pointsForResult(fixture, home.teamId, phase) - (fixture.homePointsPenalty ?? 0);
    away.points += pointsForResult(fixture, away.teamId, phase) - (fixture.awayPointsPenalty ?? 0);
    if (fixture.resultKind === 'HOME_WIN') {
      home.won += 1;
      away.lost += 1;
    } else if (fixture.resultKind === 'AWAY_WIN') {
      away.won += 1;
      home.lost += 1;
    } else if (fixture.resultKind === 'TIE') {
      home.tied += 1;
      away.tied += 1;
    } else {
      home.noResult += 1;
      away.noResult += 1;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      (save.teams[b.teamId]?.reputation ?? 0) - (save.teams[a.teamId]?.reputation ?? 0),
  );
}

function advancingTeam(save: SaveGame, fixtureId: string, seeds: LeagueRow[]): string {
  const fixture = save.fixtures[fixtureId];
  if (fixture.winnerTeamId) return fixture.winnerTeamId;
  const seed = (teamId: string) => {
    const index = seeds.findIndex((row) => row.teamId === teamId);
    return index < 0 ? 999 : index;
  };
  return seed(fixture.homeTeamId) <= seed(fixture.awayTeamId)
    ? fixture.homeTeamId
    : fixture.awayTeamId;
}

function losingTeam(save: SaveGame, fixtureId: string, seeds: LeagueRow[]): string {
  const fixture = save.fixtures[fixtureId];
  const winner = advancingTeam(save, fixtureId, seeds);
  return winner === fixture.homeTeamId ? fixture.awayTeamId : fixture.homeTeamId;
}

function addKnockout(
  save: SaveGame,
  input: {
    id: string;
    phase: 'LIST_A' | 'T20';
    tier: DomesticTier;
    homeTeamId: string;
    awayTeamId: string;
    round: number;
    label: string;
  },
): void {
  if (save.fixtures[input.id] || !save.currentSeasonId) return;
  const competitionId = PHASE_COMPETITION[input.phase];
  const fixture: Fixture = {
    id: input.id,
    seasonId: save.currentSeasonId,
    format: PHASE_FORMAT[input.phase],
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    venue: input.label,
    round: input.round,
    played: false,
    playoff: true,
    competition: 'PLAYOFF',
    competitionId,
    calendarMonth: input.phase === 'LIST_A' ? 11 : 5,
    divisionTier: input.tier,
    managerPhase: input.phase,
  };
  save.fixtures[fixture.id] = fixture;
  const season = save.seasons[save.currentSeasonId];
  season.fixtureIds.push(fixture.id);
  season.competitions
    ?.find((competition) => competition.id === competitionId)
    ?.fixtureIds.push(fixture.id);
}

/** Stage every knockout whose feeder fixtures are complete. */
export function ensureManagerKnockouts(save: SaveGame): void {
  const calendar = save.managerCalendar;
  if (!calendar) return;
  const phase = calendar.phase;
  if (phase !== 'LIST_A' && phase !== 'T20') return;
  const year = calendar.year;

  for (const tier of TIERS) {
    const regular = regularFixtures(save, phase, tier);
    if (!regular.length || regular.some((fixture) => !fixture.played)) continue;
    const seeds = managerCompetitionStandings(save, phase, tier);
    if (seeds.length < 4) continue;
    const prefix: string = `mgr-${year}-${PHASE_COMPETITION[phase]}-t${tier}-po`;

    if (phase === 'LIST_A') {
      const semi1 = `${prefix}-sf1`;
      const semi2 = `${prefix}-sf2`;
      const final = `${prefix}-final`;
      addKnockout(save, {
        id: semi1,
        phase,
        tier,
        homeTeamId: seeds[0].teamId,
        awayTeamId: seeds[3].teamId,
        round: 100,
        label: '50-Over Semi-Final 1',
      });
      addKnockout(save, {
        id: semi2,
        phase,
        tier,
        homeTeamId: seeds[1].teamId,
        awayTeamId: seeds[2].teamId,
        round: 100,
        label: '50-Over Semi-Final 2',
      });
      if (save.fixtures[semi1]?.played && save.fixtures[semi2]?.played) {
        addKnockout(save, {
          id: final,
          phase,
          tier,
          homeTeamId: advancingTeam(save, semi1, seeds),
          awayTeamId: advancingTeam(save, semi2, seeds),
          round: 101,
          label: '50-Over Final',
        });
      }
      continue;
    }

    const qualifier1 = `${prefix}-q1`;
    const eliminator = `${prefix}-elim`;
    const qualifier2 = `${prefix}-q2`;
    const final = `${prefix}-final`;
    addKnockout(save, {
      id: qualifier1,
      phase,
      tier,
      homeTeamId: seeds[0].teamId,
      awayTeamId: seeds[1].teamId,
      round: 100,
      label: 'T20 Qualifier 1',
    });
    addKnockout(save, {
      id: eliminator,
      phase,
      tier,
      homeTeamId: seeds[2].teamId,
      awayTeamId: seeds[3].teamId,
      round: 100,
      label: 'T20 Eliminator',
    });
    if (save.fixtures[qualifier1]?.played && save.fixtures[eliminator]?.played) {
      addKnockout(save, {
        id: qualifier2,
        phase,
        tier,
        homeTeamId: losingTeam(save, qualifier1, seeds),
        awayTeamId: advancingTeam(save, eliminator, seeds),
        round: 101,
        label: 'T20 Qualifier 2',
      });
    }
    if (save.fixtures[qualifier1]?.played && save.fixtures[qualifier2]?.played) {
      addKnockout(save, {
        id: final,
        phase,
        tier,
        homeTeamId: advancingTeam(save, qualifier1, seeds),
        awayTeamId: advancingTeam(save, qualifier2, seeds),
        round: 102,
        label: 'T20 Final',
      });
    }
  }
}

function phaseFinalId(save: SaveGame, phase: 'LIST_A' | 'T20', tier: DomesticTier): string {
  return `mgr-${save.managerCalendar?.year ?? 2026}-${PHASE_COMPETITION[phase]}-t${tier}-po-final`;
}

export function managerPhaseComplete(save: SaveGame): boolean {
  const phase = save.managerCalendar?.phase;
  if (!phase) return false;
  if (phase === 'OFF_SEASON') {
    return (
      Boolean(save.managerCalendar?.offSeasonPrepared) &&
      phaseFixtures(save, phase).every((fixture) => fixture.played)
    );
  }
  if (regularFixtures(save, phase).some((fixture) => !fixture.played)) return false;
  if (phase === 'FIRST_CLASS') return true;
  ensureManagerKnockouts(save);
  return TIERS.every((tier) => save.fixtures[phaseFinalId(save, phase, tier)]?.played);
}

export function nextManagerUserFixtureId(save: SaveGame): string | undefined {
  if (!save.managerCalendar) return undefined;
  const phase = save.managerCalendar.phase;
  if (!managerPhaseUnlocked(save.managerCareerLevel ?? 'CLUB', phase)) return undefined;
  const controlledTeamId = managerControlledTeamId(save, phase);
  if (!controlledTeamId) return undefined;
  ensureManagerKnockouts(save);
  return phaseFixtures(save, phase)
    .filter(
      (fixture) =>
        !fixture.played &&
        (fixture.homeTeamId === controlledTeamId || fixture.awayTeamId === controlledTeamId),
    )
    .sort(
      (a, b) =>
        a.round - b.round ||
        (a.playoff === b.playoff ? 0 : a.playoff ? 1 : -1) ||
        a.id.localeCompare(b.id),
    )[0]?.id;
}

export interface ManagerPhaseProgress {
  phase: ManagerCalendarPhase;
  label: string;
  months: string;
  unlocked: boolean;
  played: number;
  total: number;
  userPlayed: number;
  userTotal: number;
}

export function managerPhaseProgress(save: SaveGame): ManagerPhaseProgress {
  const phase = save.managerCalendar?.phase ?? 'LIST_A';
  const fixtures = phase === 'OFF_SEASON' ? [] : phaseFixtures(save, phase);
  const allPhaseFixtures = phase === 'OFF_SEASON' ? phaseFixtures(save, phase) : fixtures;
  const controlledTeamId = managerControlledTeamId(save, phase);
  const userFixtures = controlledTeamId
    ? allPhaseFixtures.filter(
        (fixture) =>
          fixture.homeTeamId === controlledTeamId || fixture.awayTeamId === controlledTeamId,
      )
    : [];
  return {
    phase,
    label: MANAGER_PHASE_LABEL[phase],
    months: MANAGER_PHASE_MONTHS[phase],
    unlocked: managerPhaseUnlocked(save.managerCareerLevel ?? 'CLUB', phase),
    played: allPhaseFixtures.filter((fixture) => fixture.played).length,
    total: allPhaseFixtures.length,
    userPlayed: userFixtures.filter((fixture) => fixture.played).length,
    userTotal: userFixtures.length,
  };
}

function phaseChampion(
  save: SaveGame,
  phase: Exclude<ManagerCalendarPhase, 'OFF_SEASON'>,
  tier: DomesticTier,
): string | undefined {
  if (phase === 'FIRST_CLASS') return managerCompetitionStandings(save, phase, tier)[0]?.teamId;
  const final = save.fixtures[phaseFinalId(save, phase, tier)];
  if (!final) return undefined;
  return (
    final.winnerTeamId ??
    managerCompetitionStandings(save, phase, tier).find(
      (row) => row.teamId === final.homeTeamId || row.teamId === final.awayTeamId,
    )?.teamId
  );
}

function buildPhaseSummary(
  save: SaveGame,
  phase: Exclude<ManagerCalendarPhase, 'OFF_SEASON'>,
  walletCoins: number,
): ManagerPhaseSummary {
  const tier = save.userDivision ?? 3;
  const standings = managerCompetitionStandings(save, phase, tier);
  const userFixtures = regularFixtures(save, phase, tier).filter(
    (fixture) => fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId,
  );
  const overRatePenalties = userFixtures.reduce((total, fixture) => {
    if (fixture.homeTeamId === save.userTeamId) return total + (fixture.homePointsPenalty ?? 0);
    return total + (fixture.awayPointsPenalty ?? 0);
  }, 0);
  return {
    phase,
    year: save.managerCalendar?.year ?? 2026,
    championTeamIds: Object.fromEntries(
      TIERS.map((divisionTier) => [divisionTier, phaseChampion(save, phase, divisionTier)]).filter(
        (entry) => Boolean(entry[1]),
      ),
    ) as Partial<Record<DomesticTier, string>>,
    userPosition:
      standings.findIndex((row) => row.teamId === save.userTeamId) >= 0
        ? standings.findIndex((row) => row.teamId === save.userTeamId) + 1
        : undefined,
    userMatches: userFixtures.filter((fixture) => fixture.played).length,
    userWins: userFixtures.filter((fixture) => fixture.winnerTeamId === save.userTeamId).length,
    walletCoins,
    overRatePenalties,
  };
}

function applyListAConfidenceCarry(save: SaveGame): void {
  for (const team of Object.values(save.teams)) {
    for (const playerId of team.playerIds) {
      const player = save.players[playerId];
      if (!player) continue;
      const positiveForm = Math.max(0, player.meta.form - 50);
      player.meta.confidence = clamp(
        player.meta.confidence + Math.round(positiveForm * 0.5),
        1,
        99,
      );
    }
  }
}

function prepareOffSeason(save: SaveGame): void {
  for (const player of Object.values(save.players)) {
    player.condition = 100;
  }
  if (save.managerCalendar) save.managerCalendar.offSeasonPrepared = true;
}

function moveToNextPhase(
  save: SaveGame,
  completed: Exclude<ManagerCalendarPhase, 'OFF_SEASON'>,
): void {
  if (!save.managerCalendar) return;
  if (completed === 'LIST_A') applyListAConfidenceCarry(save);
  if (completed === 'FIRST_CLASS') {
    const champion = phaseChampion(save, completed, 1);
    if (champion && champion === save.userTeamId) save.managerWonTierOneFirstClass = true;
  }
  const index = MANAGER_PHASE_ORDER.indexOf(completed);
  const next = MANAGER_PHASE_ORDER[index + 1] ?? 'OFF_SEASON';
  save.managerCalendar.phase = next;
  save.managerCalendar.phaseStartedAtMonth = PHASE_START_MONTH[next];
  save.managerCalendar.offSeasonPrepared = next === 'OFF_SEASON';
  save.managerCalendar.backgroundCoinsThisPhase = 0;
  save.currentMonth = PHASE_START_MONTH[next];
  if (next === 'OFF_SEASON') prepareOffSeason(save);
}

export interface AdvanceManagerCalendarResult {
  kind: 'IN_PROGRESS' | 'MATCH_READY' | 'PHASE_ADVANCED' | 'YEAR_COMPLETE';
  fixtureId?: string;
  summary?: ManagerPhaseSummary;
  played?: number;
  total?: number;
}

/**
 * Simulate the current block until the user's next required match or the end of
 * the block. The injected callback keeps this module independent from the match
 * engine and allows the ordinary result pipeline to update stats and records.
 */
export function advanceManagerCalendar(
  save: SaveGame,
  simulate: (fixtureId: string) => void,
  maxFixtures = Number.MAX_SAFE_INTEGER,
): AdvanceManagerCalendarResult {
  if (!save.managerCalendar) return { kind: 'YEAR_COMPLETE' };
  if (save.managerCalendar.phase === 'OFF_SEASON') return { kind: 'YEAR_COMPLETE' };
  const phase = save.managerCalendar.phase;
  const unlocked = managerPhaseUnlocked(save.managerCareerLevel ?? 'CLUB', phase);
  let walletCoins = save.managerCalendar.backgroundCoinsThisPhase ?? 0;
  let simulated = 0;
  let guard = 0;

  while (guard++ < 1000) {
    ensureManagerKnockouts(save);
    if (unlocked) {
      const userFixtureId = nextManagerUserFixtureId(save);
      if (userFixtureId) {
        return { kind: 'MATCH_READY', fixtureId: userFixtureId };
      }
    }
    const pending = phaseFixtures(save, phase)
      .filter((fixture) => !fixture.played)
      .sort(
        (a, b) =>
          a.round - b.round ||
          (a.divisionTier ?? 9) - (b.divisionTier ?? 9) ||
          a.id.localeCompare(b.id),
      )[0];
    if (pending) {
      simulate(pending.id);
      save.currentMonth = pending.calendarMonth ?? save.currentMonth;
      if (
        !unlocked &&
        save.userTeamId &&
        (pending.homeTeamId === save.userTeamId || pending.awayTeamId === save.userTeamId)
      ) {
        const won = pending.winnerTeamId === save.userTeamId;
        const tied = pending.resultKind === 'TIE' || pending.resultKind === 'NO_RESULT';
        const reward = matchReward(won, tied);
        save.wallet = addCoins(save.wallet, reward);
        walletCoins += reward;
        save.managerCalendar.backgroundCoinsThisPhase = walletCoins;
      }
      simulated += 1;
      if (simulated >= maxFixtures) {
        const progress = managerPhaseProgress(save);
        return {
          kind: 'IN_PROGRESS',
          played: progress.played,
          total: progress.total,
        };
      }
      continue;
    }
    if (!managerPhaseComplete(save)) continue;
    const summary = buildPhaseSummary(save, phase, walletCoins);
    save.managerCalendar.lastSummary = summary;
    moveToNextPhase(save, phase);
    return { kind: 'PHASE_ADVANCED', summary };
  }

  return { kind: 'YEAR_COMPLETE' };
}

function stableChance(key: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Apply calendar-specific workload. Condition drives rotation without changing
 * a player's permanent fitness rating.
 */
export function applyManagerCalendarMatchEffects(save: SaveGame, fixture: Fixture): void {
  if (!fixture.managerPhase || fixture.managerPhase === 'OFF_SEASON') return;
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const team = save.teams[teamId];
    if (!team) continue;
    const available = team.playerIds
      .map((playerId) => save.players[playerId])
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.overall + (b.condition ?? 100) * 0.12 - (a.overall + (a.condition ?? 100) * 0.12),
      );
    const selectedIds =
      team.xi?.length === 11
        ? team.xi.filter((playerId) => save.players[playerId])
        : available.slice(0, 11).map((player) => player.id);
    const selected = selectedIds.map((playerId) => save.players[playerId]).filter(Boolean);

    for (const player of available) {
      if (player.injury) {
        player.injury.matchesOut -= 1;
        if (player.injury.matchesOut <= 0) player.injury = undefined;
      }
    }

    for (const player of selected) {
      const recovery =
        fixture.managerPhase === 'FIRST_CLASS' ? 4 : fixture.managerPhase === 'LIST_A' ? 2 : 1;
      const baseLoad =
        fixture.managerPhase === 'FIRST_CLASS'
          ? player.role === 'BOWLER' || player.role === 'ALLROUNDER'
            ? 11
            : 6
          : fixture.managerPhase === 'LIST_A'
            ? 7
            : 7.2;
      const paceExtra =
        fixture.managerPhase === 'FIRST_CLASS' && player.bowlingStyle?.includes('PACE') ? 2 : 0;
      player.condition = clamp(
        Math.round((player.condition ?? 100) + recovery - baseLoad - paceExtra),
        0,
        100,
      );

      const healthy = team.playerIds.filter((playerId) => !save.players[playerId]?.injury).length;
      const injuryChance = player.condition < 45 ? 0.035 + (45 - player.condition) / 500 : 0;
      if (
        healthy > 15 &&
        !player.injury &&
        stableChance(`${save.id}:${fixture.id}:${player.id}:workload`) < injuryChance
      ) {
        player.injury = {
          type: fixture.managerPhase === 'FIRST_CLASS' ? 'Workload strain' : 'Fatigue strain',
          matchesOut: fixture.managerPhase === 'FIRST_CLASS' ? 2 : 1,
          severity: 'STRAIN',
        };
      }
    }

    if (fixture.managerPhase === 'FIRST_CLASS') {
      const paceBowlers = selected.filter(
        (player) =>
          (player.role === 'BOWLER' || player.role === 'ALLROUNDER') &&
          player.bowlingStyle?.includes('PACE'),
      );
      const averageStamina =
        paceBowlers.reduce((total, player) => total + player.bowling.stamina, 0) /
        Math.max(1, paceBowlers.length);
      if (paceBowlers.length >= 4 && averageStamina < 72) {
        if (fixture.homeTeamId === teamId) fixture.homePointsPenalty = 1;
        else fixture.awayPointsPenalty = 1;
      }
    }
  }
}

export function managerSquadReadiness(save: SaveGame): {
  healthy: number;
  total: number;
  tired: number;
} {
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const squad = team?.playerIds.map((playerId) => save.players[playerId]).filter(Boolean) ?? [];
  return {
    healthy: squad.filter((player) => !player.injury).length,
    total: squad.length,
    tired: squad.filter((player) => (player.condition ?? 100) < 55).length,
  };
}

export function refreshManagerNationalTeams(save: SaveGame): void {
  if (!save.managerCalendar) return;
  for (const team of Object.values(save.teams)) {
    if (!team.isNationalTeam) continue;
    team.playerIds = Object.values(save.players)
      .filter(
        (player) =>
          player.nationality === team.country &&
          !player.retired &&
          player.age < 40 &&
          !save.freeAgents?.includes(player.id),
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 22)
      .map((player) => player.id);
    team.xi = undefined;
  }
}

/** Re-point league-1 at the user's tier after promotion and keep all tiers represented. */
export function syncManagerLeagues(save: SaveGame): void {
  if (!save.divisions || !save.userTeamId) return;
  const countryId = save.teams[save.userTeamId]?.country ?? '';
  const userTier = save.userDivision ?? 3;
  const order = [userTier, ...TIERS.filter((tier) => tier !== userTier)];
  order.forEach((tier, index) => {
    const leagueId = LEAGUE_IDS[index];
    const teamIds = tierTeamIds(save, tier);
    const league = save.leagues[leagueId];
    if (!league) return;
    league.teamIds = [...teamIds];
    league.table = emptyTable(teamIds);
    league.divisionTier = tier;
    league.name = domesticLeagueName(countryId, tier, 'T20');
  });
}

/** Exact two-up/two-down rollover across all three completed T20 divisions. */
export function applyManagerPyramidRollover(save: SaveGame): void {
  if (!save.divisions?.tier3 || !save.userTeamId) return;
  const oldTier = save.userDivision ?? 3;
  const order1 = managerCompetitionStandings(save, 'T20', 1).map((row) => row.teamId);
  const order2 = managerCompetitionStandings(save, 'T20', 2).map((row) => row.teamId);
  const order3 = managerCompetitionStandings(save, 'T20', 3).map((row) => row.teamId);
  if (order1.length < 4 || order2.length < 4 || order3.length < 4) return;

  const downFrom1 = order1.slice(-2);
  const upFrom2 = order2.slice(0, 2);
  const downFrom2 = order2.slice(-2);
  const upFrom3 = order3.slice(0, 2);
  save.divisions = {
    tier1: [...order1.filter((id) => !downFrom1.includes(id)), ...upFrom2],
    tier2: [
      ...order2.filter((id) => !upFrom2.includes(id) && !downFrom2.includes(id)),
      ...downFrom1,
      ...upFrom3,
    ],
    tier3: [...order3.filter((id) => !upFrom3.includes(id)), ...downFrom2],
  };
  const newTier: DomesticTier = save.divisions.tier1.includes(save.userTeamId)
    ? 1
    : save.divisions.tier2.includes(save.userTeamId)
      ? 2
      : 3;
  save.userDivision = newTier;
  const promoted = [...upFrom2, ...upFrom3];
  const relegated = [...downFrom1, ...downFrom2];
  save.promotionNews = {
    promoted,
    relegated,
    userMoved: newTier < oldTier ? 'PROMOTED' : newTier > oldTier ? 'RELEGATED' : undefined,
  };
  if (newTier < oldTier) save.promotions = (save.promotions ?? 0) + 1;
  syncManagerLeagues(save);
}
