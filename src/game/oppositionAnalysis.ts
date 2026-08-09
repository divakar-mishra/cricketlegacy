import { Fixture, Player, SaveGame, Tactics } from '../domain/types';
import { managerControlledTeamId } from './managerCalendar';

export interface OppositionThreat {
  playerId: string;
  name: string;
  rating: number;
  detail: string;
}

export interface OppositionReport {
  fixtureId: string;
  opponentTeamId: string;
  opponentName: string;
  formatLabel: string;
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  topBatter: OppositionThreat;
  topBowler: OppositionThreat;
  attackShape: string;
  weakness: string;
  recommendedTactics: Tactics;
  recommendation: string;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function battingRating(player: Player): number {
  return average([
    player.batting.technique,
    player.batting.timing,
    player.batting.power,
    player.batting.footwork,
    player.batting.temperament,
    player.batting.running,
  ]);
}

function bowlingRating(player: Player): number {
  return average([
    player.bowling.paceOrSpin,
    player.bowling.accuracy,
    player.bowling.movement,
    player.bowling.variations,
    player.bowling.stamina,
  ]);
}

function fieldingRating(player: Player): number {
  return average([player.fielding.catching, player.fielding.throwing, player.fielding.agility]);
}

function selectedPlayers(save: SaveGame, teamId: string): Player[] {
  const team = save.teams[teamId];
  const ids = team?.xi?.length ? team.xi : (team?.playerIds.slice(0, 11) ?? []);
  return ids.map((id) => save.players[id]).filter((player): player is Player => Boolean(player));
}

function threat(
  players: Player[],
  rating: (player: Player) => number,
  detail: (player: Player) => string,
): OppositionThreat {
  const player = [...players].sort((left, right) => rating(right) - rating(left))[0];
  if (!player) {
    return {
      playerId: '',
      name: 'No player available',
      rating: 0,
      detail: 'No XI data available.',
    };
  }
  return {
    playerId: player.id,
    name: player.name,
    rating: rating(player),
    detail: detail(player),
  };
}

function formatLabel(fixture: Fixture): string {
  if (fixture.competitionId === 'first-class' || fixture.format === 'TEST') return 'First-Class';
  if (fixture.competitionId === 'list-a' || fixture.format === 'ODI') return 'List A';
  return fixture.format;
}

function controlledTeamForFixture(save: SaveGame, fixture: Fixture): string | undefined {
  if (save.mode === 'manager') {
    return fixture.managerPhase
      ? managerControlledTeamId(save, fixture.managerPhase)
      : save.managerCareerLevel === 'NATIONAL' && save.managerNationalTeamId
        ? save.managerNationalTeamId
        : save.userTeamId;
  }

  const fixtureTeamIds = [fixture.homeTeamId, fixture.awayTeamId];
  if (save.userPlayerId) {
    const playerTeamId = fixtureTeamIds.find((teamId) => {
      const team = save.teams[teamId];
      return team?.xi?.includes(save.userPlayerId!) || team?.playerIds.includes(save.userPlayerId!);
    });
    if (playerTeamId) return playerTeamId;
  }
  return fixtureTeamIds.find(
    (teamId) => teamId === save.careerPathTeamId || teamId === save.userTeamId,
  );
}

export function buildOppositionReport(
  save: SaveGame,
  fixtureId: string | undefined,
): OppositionReport | undefined {
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  if (!fixture) return undefined;
  const controlledTeamId = controlledTeamForFixture(save, fixture);
  if (!controlledTeamId) return undefined;
  const opponentTeamId =
    fixture.homeTeamId === controlledTeamId ? fixture.awayTeamId : fixture.homeTeamId;
  const opponent = save.teams[opponentTeamId];
  const players = selectedPlayers(save, opponentTeamId);
  if (!opponent || !players.length) return undefined;

  const batting = average(players.map(battingRating));
  const bowlingGroup = players.filter(
    (player) => player.role === 'BOWLER' || player.role === 'ALLROUNDER',
  );
  const availableBowlers = bowlingGroup.length ? bowlingGroup : players;
  const bowling = average(availableBowlers.map(bowlingRating));
  const fielding = average(players.map(fieldingRating));
  const footwork = average(players.map((player) => player.batting.footwork));
  const temperament = average(players.map((player) => player.batting.temperament));
  const paceCount = availableBowlers.filter((player) =>
    ['PACE', 'MEDIUM', 'LEFT_ARM_PACE'].includes(player.bowlingStyle ?? ''),
  ).length;
  const spinCount = Math.max(0, availableBowlers.length - paceCount);

  const topBatter = threat(
    players,
    battingRating,
    (player) =>
      `Technique ${player.batting.technique}, timing ${player.batting.timing}, power ${player.batting.power}.`,
  );
  const topBowler = threat(
    availableBowlers,
    bowlingRating,
    (player) =>
      `${player.bowlingStyle?.replaceAll('_', ' ') ?? 'Bowling'}: accuracy ${player.bowling.accuracy}, movement ${player.bowling.movement}, variations ${player.bowling.variations}.`,
  );

  let weakness: string;
  let bowlingPlan: Tactics['bowling'];
  let field: NonNullable<Tactics['field']>;
  if (footwork + 4 < average(players.map((player) => player.batting.technique))) {
    weakness = `Average footwork is only ${footwork}. Use spin/variation through the middle overs and keep catching support.`;
    bowlingPlan = 'VARY';
    field = 'CATCHING';
  } else if (temperament < 58) {
    weakness = `Average temperament is ${temperament}. Attack early wickets before their batters settle.`;
    bowlingPlan = 'ATTACK';
    field = 'ATTACKING';
  } else {
    weakness = `No major technical weakness. Their lower-order pressure point is boundary denial and scoreboard control.`;
    bowlingPlan = 'CONTAIN';
    field = 'BALANCED';
  }

  const battingPlan: Tactics['batting'] =
    bowling >= 72 ? 'DEFENSIVE' : bowling <= 58 ? 'AGGRESSIVE' : 'BALANCED';
  const recommendation =
    batting >= 72
      ? `Their batting unit rates ${batting}. Protect boundaries first, then attack the named weakness.`
      : bowling >= 72
        ? `Their bowling unit rates ${bowling}. Preserve wickets against ${topBowler.name} and target the support overs.`
        : `The matchup is balanced. Keep wickets in hand and change plans around the two named threats.`;

  return {
    fixtureId: fixture.id,
    opponentTeamId,
    opponentName: opponent.name,
    formatLabel: formatLabel(fixture),
    battingRating: batting,
    bowlingRating: bowling,
    fieldingRating: fielding,
    topBatter,
    topBowler,
    attackShape: `${paceCount} pace option${paceCount === 1 ? '' : 's'} and ${spinCount} spin option${spinCount === 1 ? '' : 's'} in the selected attack.`,
    weakness,
    recommendedTactics: { batting: battingPlan, bowling: bowlingPlan, field },
    recommendation,
  };
}
