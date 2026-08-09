import { Format, PlayerStats, SaveGame } from '../domain/types';
import { managerControlledTeamId } from './managerCalendar';
import { nextUserFixtureId } from './season';

export type ManagerLeaderboardKind = 'runs' | 'wickets' | 'highScore' | 'bestBowling';

export interface ManagerLeaderboardRow {
  playerId: string;
  name: string;
  teamId?: string;
  teamShort: string;
  matches: number;
  runs: number;
  wickets: number;
  highScore: number;
  bestBowling: string;
  average: string;
  strikeRate: string;
  economy: string;
  hundreds: number;
  isManagedPlayer: boolean;
}

export interface ActiveManagerRecords {
  format: Format;
  competitionLabel: string;
  managedTeamId?: string;
  rows: ManagerLeaderboardRow[];
}

function competitionLabel(format: Format, competitionId?: string): string {
  if (competitionId === 'first-class' || format === 'TEST') return 'First-Class';
  if (competitionId === 'list-a' || format === 'ODI') return 'List A';
  return 'T20';
}

function teamForPlayer(
  save: SaveGame,
  playerId: string,
  managedTeamId: string | undefined,
): { id: string; shortName: string } | undefined {
  const managedIsNational = managedTeamId ? save.teams[managedTeamId]?.isNationalTeam : false;
  const matching = Object.values(save.teams).filter(
    (team) =>
      team.playerIds.includes(playerId) &&
      Boolean(team.isNationalTeam) === Boolean(managedIsNational),
  );
  const team = matching.find((candidate) => candidate.id === managedTeamId) ?? matching[0];
  return team ? { id: team.id, shortName: team.shortName } : undefined;
}

function rowFromStats(
  save: SaveGame,
  playerId: string,
  stats: PlayerStats,
  managedTeamId: string | undefined,
): ManagerLeaderboardRow {
  const player = save.players[playerId];
  const team = teamForPlayer(save, playerId, managedTeamId);
  const dismissals = Math.max(0, stats.matches - stats.notOuts);
  return {
    playerId,
    name: player.name,
    teamId: team?.id,
    teamShort: team?.shortName ?? '—',
    matches: stats.matches,
    runs: stats.runs,
    wickets: stats.wickets,
    highScore: stats.highScore,
    bestBowling: stats.bestBowling,
    average: dismissals > 0 ? (stats.runs / dismissals).toFixed(1) : '—',
    strikeRate: stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '—',
    economy:
      stats.ballsBowled > 0 ? ((stats.runsConceded * 6) / stats.ballsBowled).toFixed(1) : '—',
    hundreds: stats.hundreds,
    isManagedPlayer: team?.id === managedTeamId,
  };
}

export function activeManagerRecords(save: SaveGame): ActiveManagerRecords {
  const fixtureId = nextUserFixtureId(save);
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  const phase = save.managerCalendar?.phase;
  const format: Format =
    fixture?.format ?? (phase === 'FIRST_CLASS' ? 'TEST' : phase === 'LIST_A' ? 'ODI' : 'T20');
  const managedTeamId = fixture?.managerPhase
    ? managerControlledTeamId(save, fixture.managerPhase)
    : save.managerCareerLevel === 'NATIONAL' && save.managerNationalTeamId
      ? save.managerNationalTeamId
      : save.userTeamId;
  const rows = Object.values(save.players)
    .filter((player) => (player.seasonFormatStats?.[format]?.matches ?? 0) > 0)
    .map((player) =>
      rowFromStats(save, player.id, player.seasonFormatStats![format]!, managedTeamId),
    );
  return {
    format,
    competitionLabel: competitionLabel(format, fixture?.competitionId),
    managedTeamId,
    rows,
  };
}

function bestBowlingValue(value: string): [number, number] {
  const [wickets, runs] = value.split('/').map(Number);
  return [Number.isFinite(wickets) ? wickets : 0, Number.isFinite(runs) ? runs : 999];
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function rankManagerRows(
  rows: ManagerLeaderboardRow[],
  kind: ManagerLeaderboardKind,
): ManagerLeaderboardRow[] {
  return [...rows]
    .sort((left, right) => {
      if (kind === 'runs') {
        return (
          right.runs - left.runs || numericValue(right.average, -1) - numericValue(left.average, -1)
        );
      }
      if (kind === 'wickets') {
        return (
          right.wickets - left.wickets ||
          numericValue(left.economy, 999) - numericValue(right.economy, 999)
        );
      }
      if (kind === 'highScore') return right.highScore - left.highScore || right.runs - left.runs;
      const [leftWickets, leftRuns] = bestBowlingValue(left.bestBowling);
      const [rightWickets, rightRuns] = bestBowlingValue(right.bestBowling);
      return rightWickets - leftWickets || leftRuns - rightRuns;
    })
    .slice(0, 10);
}
