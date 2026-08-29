import { Fixture, LeagueRow, SaveGame } from '../domain/types';
import { managerCompetitionStandings, MANAGER_PHASE_LABEL } from './managerCalendar';
import { standings } from './season';
import { YOUTH_COMP_SCHOOL, YOUTH_COMP_U19 } from './youthFixtures';
import { playerAffiliationTeamId } from './playerAffiliations';

export interface ActiveCompetitionTable {
  title: string;
  rows: LeagueRow[];
  highlightTeamId?: string;
}

function emptyRow(teamId: string): LeagueRow {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
  };
}

function userCompetitionTier(save: SaveGame, teamId = save.userTeamId): number | undefined {
  if (!teamId || !save.divisions) return save.userDivision;
  if (save.divisions.tier1.includes(teamId)) return 1;
  if (save.divisions.tier2.includes(teamId)) return 2;
  if (save.divisions.tier3?.includes(teamId)) return 3;
  return save.userDivision;
}

function fixtureWinner(fixture: Fixture): string | undefined {
  if (fixture.winnerTeamId === fixture.homeTeamId || fixture.winnerTeamId === fixture.awayTeamId) {
    return fixture.winnerTeamId;
  }
  if (fixture.resultKind === 'HOME_WIN') return fixture.homeTeamId;
  if (fixture.resultKind === 'AWAY_WIN') return fixture.awayTeamId;
  return undefined;
}

function orderedParticipants(save: SaveGame, fixtures: Fixture[]): string[] {
  const present = new Set(fixtures.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]));
  const tier = userCompetitionTier(save);
  const division =
    tier === 1 ? save.divisions?.tier1 : tier === 2 ? save.divisions?.tier2 : save.divisions?.tier3;
  const ordered = (division ?? []).filter((teamId) => present.has(teamId));
  for (const fixture of fixtures) {
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
      if (!ordered.includes(teamId)) ordered.push(teamId);
    }
  }
  return ordered;
}

/** Derive a competition table from persisted fixture outcomes. */
export function fixtureCompetitionStandings(save: SaveGame, competitionId: string): LeagueRow[] {
  const winPoints = competitionId === 'first-class' ? 4 : 2;
  const drawPoints = competitionId === 'first-class' ? 2 : 1;
  const userTier = userCompetitionTier(save, playerAffiliationTeamId(save, competitionId));
  const fixtures = Object.values(save.fixtures ?? {}).filter(
    (fixture) =>
      fixture.competitionId === competitionId &&
      (!save.currentSeasonId || fixture.seasonId === save.currentSeasonId) &&
      (fixture.divisionTier == null || userTier == null || fixture.divisionTier === userTier) &&
      !fixture.playoff,
  );
  const rows = new Map(
    orderedParticipants(save, fixtures).map((teamId) => [teamId, emptyRow(teamId)]),
  );

  for (const fixture of fixtures) {
    if (!fixture.played) continue;
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    const winnerTeamId = fixtureWinner(fixture);
    const homeWon = winnerTeamId === fixture.homeTeamId;
    const awayWon = winnerTeamId === fixture.awayTeamId;
    if (homeWon) {
      home.won += 1;
      away.lost += 1;
      home.points += winPoints;
    } else if (awayWon) {
      away.won += 1;
      home.lost += 1;
      away.points += winPoints;
    } else if (fixture.resultKind === 'TIE') {
      home.tied += 1;
      away.tied += 1;
      home.points += drawPoints;
      away.points += drawPoints;
    } else {
      home.noResult += 1;
      away.noResult += 1;
      home.points += drawPoints;
      away.points += drawPoints;
    }
  }

  return [...rows.values()].sort(
    (left, right) =>
      right.points - left.points ||
      right.won - left.won ||
      (save.teams[right.teamId]?.reputation ?? 0) - (save.teams[left.teamId]?.reputation ?? 0),
  );
}

function upcomingCareerCompetitionId(save: SaveGame): string | undefined {
  const calendar = save.playerCalendar;
  if (calendar) {
    const upcoming = calendar.events
      .slice(calendar.cursor)
      .find((event) => !event.completed && event.kind === 'MATCH' && event.fixtureId);
    const upcomingId = upcoming?.fixtureId
      ? save.fixtures[upcoming.fixtureId]?.competitionId
      : undefined;
    if (upcomingId) return upcomingId;

    const previous = calendar.events
      .slice(0, calendar.cursor + 1)
      .reverse()
      .find((event) => event.completed && event.kind === 'MATCH' && event.fixtureId);
    if (previous?.fixtureId) return save.fixtures[previous.fixtureId]?.competitionId;
  }
  return undefined;
}

function competitionTitle(competitionId: string): string {
  if (competitionId === YOUTH_COMP_SCHOOL) return 'Grade A Cricket Table';
  if (competitionId === YOUTH_COMP_U19) return 'Under-19 Table';
  if (competitionId === 'list-a') return '50-Over Championship Table';
  if (competitionId === 'first-class') return 'First-Class Championship Table';
  return 'T20 League Table';
}

function competitionRows(save: SaveGame, competitionId: string): LeagueRow[] {
  return competitionId === 't20-league'
    ? standings(save)
    : fixtureCompetitionStandings(save, competitionId);
}

function mostRecentPlayedCareerCompetitionId(save: SaveGame): string | undefined {
  const events = save.playerCalendar?.events ?? [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const fixtureId = events[index]?.fixtureId;
    const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
    if (!fixture?.played || fixture.playoff || !fixture.competitionId) continue;
    return fixture.competitionId;
  }
  return Object.values(save.fixtures ?? {})
    .filter(
      (fixture) =>
        fixture.played &&
        !fixture.playoff &&
        Boolean(fixture.competitionId) &&
        (!save.currentSeasonId || fixture.seasonId === save.currentSeasonId),
    )
    .sort(
      (left, right) =>
        (right.calendarMonth ?? 0) - (left.calendarMonth ?? 0) ||
        (right.calendarWeek ?? right.round) - (left.calendarWeek ?? left.round),
    )[0]?.competitionId;
}

/** The table relevant to what this career is actually playing right now. */
export function activeCompetitionTable(save: SaveGame): ActiveCompetitionTable {
  if (save.mode === 'manager' && save.managerCalendar && save.managerCareerLevel !== 'NATIONAL') {
    const phase = save.managerCalendar.phase === 'OFF_SEASON' ? 'T20' : save.managerCalendar.phase;
    const tier = (userCompetitionTier(save) ?? 3) as 1 | 2 | 3;
    const currentRows = managerCompetitionStandings(save, phase, tier);
    const currentUserRow = currentRows.find((row) => row.teamId === save.userTeamId);
    const completedPhase = save.managerCalendar.lastSummary?.phase;
    const completedCompetitionPhase =
      completedPhase && completedPhase !== 'OFF_SEASON' ? completedPhase : undefined;
    const displayPhase =
      currentUserRow?.played === 0 &&
      completedCompetitionPhase &&
      completedCompetitionPhase !== phase
        ? completedCompetitionPhase
        : phase;
    return {
      title: `${MANAGER_PHASE_LABEL[displayPhase]} Table`,
      rows:
        displayPhase === phase
          ? currentRows
          : managerCompetitionStandings(save, displayPhase, tier),
      highlightTeamId: save.userTeamId,
    };
  }

  const youthCompetition =
    save.careerPathLevel === 'SCHOOL'
      ? YOUTH_COMP_SCHOOL
      : save.careerPathLevel === 'U19'
        ? YOUTH_COMP_U19
        : undefined;
  const competitionId = youthCompetition ?? upcomingCareerCompetitionId(save) ?? 't20-league';
  const highlightTeamId = youthCompetition
    ? save.careerPathTeamId
    : playerAffiliationTeamId(save, competitionId);
  const rows = competitionRows(save, competitionId);
  const highlightedRow = rows.find((row) => row.teamId === highlightTeamId);
  const recentCompetitionId = mostRecentPlayedCareerCompetitionId(save);
  const shouldKeepRecentTable = Boolean(
    highlightedRow?.played === 0 && recentCompetitionId && recentCompetitionId !== competitionId,
  );
  const displayCompetitionId =
    shouldKeepRecentTable && recentCompetitionId ? recentCompetitionId : competitionId;
  const displayHighlightTeamId = youthCompetition
    ? save.careerPathTeamId
    : playerAffiliationTeamId(save, displayCompetitionId);
  return {
    title: competitionTitle(displayCompetitionId),
    rows:
      displayCompetitionId === competitionId ? rows : competitionRows(save, displayCompetitionId),
    highlightTeamId: displayHighlightTeamId,
  };
}
