import {
  DomesticTier,
  Fixture,
  League,
  SaveGame,
} from '../domain/types';
import {
  buildDoubleRoundRobin,
  buildPlayerLeagueWorld,
  DIV1_LEAGUE_ID,
  DIV2_LEAGUE_ID,
  DIV3_LEAGUE_ID,
} from '../generation/world';
import { ensurePlayerCareerResources } from '../game/career';
import { syncThreeTierLeagues } from '../game/divisions';
import { prepareInternationalCalendar } from '../game/intlCalendar';
import { buildPlayerSeasonCalendar } from '../game/playerCalendar';
import { ensureCompetitionFixtures } from '../game/season';

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function emptyLeague(id: string, source: League, tier: DomesticTier, teamIds: string[]): League {
  return {
    id,
    name: source.name,
    format: source.format,
    teamIds,
    table: teamIds.map((teamId) => ({
      teamId,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      netRunRate: 0,
    })),
    divisionTier: tier,
  };
}

function importTeam(save: SaveGame, generated: SaveGameLikeWorld, teamId: string): void {
  const team = generated.teams[teamId];
  if (!team || save.teams[teamId]) return;
  save.teams[teamId] = { ...team, playerIds: [...team.playerIds] };
  for (const playerId of team.playerIds) {
    if (!save.players[playerId] && generated.players[playerId]) {
      save.players[playerId] = generated.players[playerId];
    }
  }
}

type SaveGameLikeWorld = ReturnType<typeof buildPlayerLeagueWorld>;

function inferFixtureTier(save: SaveGame, fixture: Fixture): DomesticTier | undefined {
  if (fixture.divisionTier) return fixture.divisionTier;
  if (save.divisions?.tier1.includes(fixture.homeTeamId)) return 1;
  if (save.divisions?.tier2.includes(fixture.homeTeamId)) return 2;
  if (save.divisions?.tier3?.includes(fixture.homeTeamId)) return 3;
  return undefined;
}

function isDomesticT20(fixture: Fixture): boolean {
  return (
    !fixture.playoff &&
    fixture.competition !== 'CUP' &&
    fixture.competition !== 'BILATERAL_SERIES' &&
    fixture.competition !== 'INTL_TOURNAMENT' &&
    (!fixture.competitionId || fixture.competitionId === 't20-league')
  );
}

function upgradeCurrentT20Schedule(save: SaveGame): void {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  if (!season || !save.divisions?.tier3 || save.fixtures['po-F']?.played) return;
  const existing = Object.values(save.fixtures).filter(isDomesticT20);
  const used = new Set<string>();
  const desiredIds: string[] = [];
  const year = season.year;
  const teamIdsByTier: Record<DomesticTier, string[]> = {
    1: save.divisions.tier1,
    2: save.divisions.tier2,
    3: save.divisions.tier3,
  };

  for (const tier of [1, 2, 3] as DomesticTier[]) {
    const league = Object.values(save.leagues).find((item) => item.divisionTier === tier);
    const format = league?.format ?? 'T20';
    const planned = Object.values(
      buildDoubleRoundRobin(
        teamIdsByTier[tier],
        season.id,
        format,
        save.teams,
        `fx-t20-${year}-t${tier}`,
        't20-league',
      ),
    );
    for (const fixture of planned) {
      const exact = existing.find(
        (candidate) =>
          !used.has(candidate.id) &&
          inferFixtureTier(save, candidate) === tier &&
          candidate.homeTeamId === fixture.homeTeamId &&
          candidate.awayTeamId === fixture.awayTeamId,
      );
      const reverse =
        exact ??
        existing.find(
          (candidate) =>
            !used.has(candidate.id) &&
            inferFixtureTier(save, candidate) === tier &&
            [candidate.homeTeamId, candidate.awayTeamId].sort().join(':') ===
              [fixture.homeTeamId, fixture.awayTeamId].sort().join(':'),
        );
      if (reverse) {
        used.add(reverse.id);
        reverse.competitionId = 't20-league';
        reverse.divisionTier = tier;
        reverse.round = fixture.round;
        reverse.calendarMonth = Math.min(5, 3 + Math.floor((fixture.round - 1) / 5));
        desiredIds.push(reverse.id);
        continue;
      }

      let id = fixture.id;
      if (save.fixtures[id]) id = `${id}-v21`;
      save.fixtures[id] = {
        ...fixture,
        id,
        divisionTier: tier,
        calendarMonth: Math.min(5, 3 + Math.floor((fixture.round - 1) / 5)),
      };
      desiredIds.push(id);
    }
  }

  for (const fixture of existing) {
    if (!used.has(fixture.id) && !fixture.played) delete save.fixtures[fixture.id];
  }
  const retained = season.fixtureIds.filter((id) => !existing.some((fixture) => fixture.id === id));
  season.fixtureIds = [...new Set([...retained, ...desiredIds])];
  const t20 = season.competitions?.find((competition) => competition.id === 't20-league');
  if (t20) t20.fixtureIds = desiredIds;
}

function addThirdPlayerTier(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId || !save.userTeamId) return;
  const resources = ensurePlayerCareerResources(save);
  const country =
    resources?.domesticCountry ??
    save.teams[save.userTeamId]?.country ??
    save.players[save.userPlayerId]?.nationality ??
    'india';
  const currentTier = save.userDivision === 1 ? 1 : save.userDivision === 2 ? 2 : 3;
  const generated = buildPlayerLeagueWorld(hashSeed(`${save.id}:schema21`), {
    country,
    userDivision: currentTier,
    requiredTeamId: save.userTeamId,
    seasonId: save.currentSeasonId,
  });

  if (!save.divisions) {
    save.divisions = {
      tier1: save.leagues[DIV1_LEAGUE_ID]?.teamIds.slice(0, 8) ?? [],
      tier2: save.leagues[DIV2_LEAGUE_ID]?.teamIds.slice(0, 8) ?? [],
    };
  }
  const used = new Set([...save.divisions.tier1, ...save.divisions.tier2]);
  const fillTier = (tier: 1 | 2, current: string[]): string[] => {
    const next = current.slice(0, 8);
    for (const teamId of generated.divisions[`tier${tier}`]) {
      if (next.length >= 8) break;
      if (used.has(teamId)) continue;
      importTeam(save, generated, teamId);
      next.push(teamId);
      used.add(teamId);
    }
    return next;
  };
  save.divisions.tier1 = fillTier(1, save.divisions.tier1);
  save.divisions.tier2 = fillTier(2, save.divisions.tier2);
  const tier3 = [...(save.divisions.tier3 ?? [])].slice(0, 8);
  for (const teamId of generated.divisions.tier3 ?? []) {
    if (tier3.length >= 8) break;
    if (used.has(teamId)) continue;
    importTeam(save, generated, teamId);
    tier3.push(teamId);
    used.add(teamId);
  }
  save.divisions.tier3 = tier3;

  for (const [teamId, team] of Object.entries(generated.teams)) {
    if (!team.isNationalTeam) continue;
    importTeam(save, generated, teamId);
  }

  const userLeague = save.leagues[DIV1_LEAGUE_ID];
  const otherLeague = save.leagues[DIV2_LEAGUE_ID] ?? userLeague;
  if (!userLeague) return;
  userLeague.divisionTier = currentTier;
  if (otherLeague) otherLeague.divisionTier = currentTier === 1 ? 2 : 1;
  const tierThreeSource =
    Object.values(generated.leagues).find((league) => league.divisionTier === 3) ??
    Object.values(generated.leagues)[0];
  save.leagues[DIV3_LEAGUE_ID] ??= emptyLeague(
    DIV3_LEAGUE_ID,
    tierThreeSource,
    3,
    tier3,
  );
  if (save.currentSeasonId) {
    const season = save.seasons[save.currentSeasonId];
    season.leagueIds = [...new Set([...season.leagueIds, DIV3_LEAGUE_ID])];
  }
  syncThreeTierLeagues(save);
  upgradeCurrentT20Schedule(save);
}

/** Idempotent Player Career pyramid, eligibility, calendar and window upgrade. */
export function synchronizeSchema21State(save: SaveGame): void {
  const resources = ensurePlayerCareerResources(save);
  if (save.mode !== 'career' || !resources) return;
  if (!save.fixtures || !save.seasons || !save.teams || !save.leagues) return;
  addThirdPlayerTier(save);
  ensureCompetitionFixtures(save, 'list-a');
  ensureCompetitionFixtures(save, 'first-class');
  if (save.capped) prepareInternationalCalendar(save);
  buildPlayerSeasonCalendar(save);
}
