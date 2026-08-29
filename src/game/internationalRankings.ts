import {
  Fixture,
  InternationalPlayerRankingKind,
  InternationalPlayerRankingPeak,
  InternationalRankingFormat,
  Player,
  PlayerStats,
  SaveGame,
} from '../domain/types';
import { COUNTRIES, getCountry } from '../data/countries';
import { battingMean, bowlingMean } from '../engine/rating';
import { clamp } from '../utils/math';

export type { InternationalPlayerRankingKind, InternationalRankingFormat } from '../domain/types';

export const INTERNATIONAL_RANKING_FORMAT_LABEL: Readonly<
  Record<InternationalRankingFormat, string>
> = {
  TEST: 'Test',
  ODI: 'ODI',
  T20: 'T20I',
};

export const INTERNATIONAL_PLAYER_RANKING_LABEL: Readonly<
  Record<InternationalPlayerRankingKind, string>
> = {
  BATTING: 'Batting',
  BOWLING: 'Bowling',
  ALL_ROUNDER: 'All-Rounder',
};

export interface InternationalTeamRankingRow {
  rank: number;
  countryId: string;
  matches: number;
  points: number;
  rating: number;
}

export interface InternationalPlayerRankingRow {
  rank: number;
  playerId: string;
  name: string;
  countryId: string;
  rating: number;
  isUser: boolean;
}

const TEAM_RATING_CONFIG: Readonly<
  Record<
    InternationalRankingFormat,
    { base: number; strengthStep: number; maximum: number; matchMovement: number }
  >
> = {
  TEST: { base: 45, strengthStep: 16, maximum: 160, matchMovement: 8 },
  ODI: { base: 45, strengthStep: 15, maximum: 160, matchMovement: 8 },
  T20: { base: 85, strengthStep: 34, maximum: 320, matchMovement: 14 },
};

const PLAYER_PERFORMANCE_TARGETS: Readonly<
  Record<
    InternationalRankingFormat,
    {
      strikeRate: number;
      wicketsPerMatch: number;
      bowlingAverage: number;
      economy: number;
      qualificationMatches: number;
    }
  >
> = {
  TEST: {
    strikeRate: 55,
    wicketsPerMatch: 3,
    bowlingAverage: 28,
    economy: 3.2,
    qualificationMatches: 20,
  },
  ODI: {
    strikeRate: 90,
    wicketsPerMatch: 1.5,
    bowlingAverage: 32,
    economy: 5.2,
    qualificationMatches: 20,
  },
  T20: {
    strikeRate: 130,
    wicketsPerMatch: 1.2,
    bowlingAverage: 26,
    economy: 7.5,
    qualificationMatches: 20,
  },
};

function stableNumber(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function teamRatingKey(format: InternationalRankingFormat, countryId: string): string {
  return `TEAM:${format}:${countryId}:RATING`;
}

function teamMatchesKey(format: InternationalRankingFormat, countryId: string): string {
  return `TEAM:${format}:${countryId}:MATCHES`;
}

function rankingCountries(save: SaveGame): string[] {
  return [
    ...new Set([
      ...COUNTRIES.map((country) => country.id),
      ...Object.values(save.teams)
        .filter((team) => team.isNationalTeam)
        .map((team) => team.country),
    ]),
  ].filter((countryId) => Boolean(getCountry(countryId)));
}

function initialTeamRating(format: InternationalRankingFormat, countryId: string): number {
  const config = TEAM_RATING_CONFIG[format];
  const strength = getCountry(countryId)?.strength ?? 1;
  const formatVariation = (stableNumber(`${format}:${countryId}:ranking`) % 13) - 6;
  return clamp(config.base + strength * config.strengthStep + formatVariation, 1, config.maximum);
}

function readTeamRating(
  save: SaveGame,
  format: InternationalRankingFormat,
  countryId: string,
): number {
  const stored = save.iccRankings?.[teamRatingKey(format, countryId)];
  if (typeof stored === 'number' && Number.isFinite(stored)) return Math.round(stored);
  const legacy = save.iccRankings?.[countryId];
  if (typeof legacy === 'number' && Number.isFinite(legacy)) return Math.round(legacy);
  return initialTeamRating(format, countryId);
}

function readTeamMatches(
  save: SaveGame,
  format: InternationalRankingFormat,
  countryId: string,
): number {
  const value = save.iccRankings?.[teamMatchesKey(format, countryId)];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function countryForTeam(save: SaveGame, teamId: string): string | undefined {
  return save.teams[teamId]?.country;
}

function isInternationalFixture(fixture: Fixture): boolean {
  return fixture.competition === 'BILATERAL_SERIES' || fixture.competition === 'INTL_TOURNAMENT';
}

/**
 * Update the format-specific team table once from the canonical completed
 * fixture. The caller already rejects replayed fixture IDs before reaching it.
 */
export function updateInternationalTeamRankings(save: SaveGame, fixture: Fixture): void {
  if (!isInternationalFixture(fixture) || !fixture.resultKind) return;
  const format = fixture.format as InternationalRankingFormat;
  if (format !== 'TEST' && format !== 'ODI' && format !== 'T20') return;
  const homeCountry = countryForTeam(save, fixture.homeTeamId);
  const awayCountry = countryForTeam(save, fixture.awayTeamId);
  if (!homeCountry || !awayCountry || homeCountry === awayCountry) return;

  save.iccRankings ??= {};
  const homeRating = readTeamRating(save, format, homeCountry);
  const awayRating = readTeamRating(save, format, awayCountry);
  const expectedHome = homeRating / Math.max(1, homeRating + awayRating);
  const actualHome =
    fixture.resultKind === 'HOME_WIN' ? 1 : fixture.resultKind === 'AWAY_WIN' ? 0 : 0.5;
  const movement =
    fixture.resultKind === 'NO_RESULT'
      ? 0
      : Math.round(TEAM_RATING_CONFIG[format].matchMovement * (actualHome - expectedHome));
  const maximum = TEAM_RATING_CONFIG[format].maximum;

  save.iccRankings[teamRatingKey(format, homeCountry)] = clamp(homeRating + movement, 1, maximum);
  save.iccRankings[teamRatingKey(format, awayCountry)] = clamp(awayRating - movement, 1, maximum);
  save.iccRankings[teamMatchesKey(format, homeCountry)] =
    readTeamMatches(save, format, homeCountry) + 1;
  save.iccRankings[teamMatchesKey(format, awayCountry)] =
    readTeamMatches(save, format, awayCountry) + 1;
}

/** ICC-style position, team, matches, points and rating table for one format. */
export function internationalTeamRankings(
  save: SaveGame,
  format: InternationalRankingFormat,
): InternationalTeamRankingRow[] {
  return rankingCountries(save)
    .map((countryId) => {
      const matches = readTeamMatches(save, format, countryId);
      const rating = readTeamRating(save, format, countryId);
      return {
        countryId,
        matches,
        points: matches * rating,
        rating,
      };
    })
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        right.matches - left.matches ||
        left.countryId.localeCompare(right.countryId),
    )
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function competitionStats(
  player: Player,
  format: InternationalRankingFormat,
): PlayerStats | undefined {
  return player.competitionStats?.[format === 'T20' ? 'T20I' : format];
}

function qualificationFactor(matches: number, format: InternationalRankingFormat): number {
  const target = PLAYER_PERFORMANCE_TARGETS[format].qualificationMatches;
  return 0.55 + 0.45 * Math.min(1, matches / target);
}

function battingRating(
  player: Player,
  stats: PlayerStats,
  format: InternationalRankingFormat,
): number {
  if (stats.matches <= 0 || stats.balls <= 0) return 0;
  const targets = PLAYER_PERFORMANCE_TARGETS[format];
  const dismissals = Math.max(1, stats.matches - stats.notOuts);
  const average = stats.runs / dismissals;
  const strikeRate = (stats.runs / stats.balls) * 100;
  const performance = clamp(
    (average / 50) * 0.7 + (strikeRate / targets.strikeRate) * 0.3,
    0.35,
    1.6,
  );
  const ability =
    battingMean(player) * 0.75 + player.meta.form * 0.15 + player.meta.confidence * 0.1;
  return Math.round(
    clamp(
      ability * 10 * (0.65 + performance * 0.35) * qualificationFactor(stats.matches, format),
      0,
      1000,
    ),
  );
}

function bowlingRating(
  player: Player,
  stats: PlayerStats,
  format: InternationalRankingFormat,
): number {
  if (stats.matches <= 0 || stats.ballsBowled <= 0) return 0;
  const targets = PLAYER_PERFORMANCE_TARGETS[format];
  const wicketsPerMatch = stats.wickets / stats.matches;
  const bowlingAverage = stats.wickets > 0 ? stats.runsConceded / stats.wickets : 80;
  const economy = (stats.runsConceded / stats.ballsBowled) * 6;
  const performance = clamp(
    (wicketsPerMatch / targets.wicketsPerMatch) * 0.55 +
      (targets.bowlingAverage / Math.max(1, bowlingAverage)) * 0.3 +
      (targets.economy / Math.max(0.5, economy)) * 0.15,
    0.3,
    1.7,
  );
  const ability =
    bowlingMean(player) * 0.75 + player.meta.form * 0.15 + player.meta.confidence * 0.1;
  return Math.round(
    clamp(
      ability * 10 * (0.65 + performance * 0.35) * qualificationFactor(stats.matches, format),
      0,
      1000,
    ),
  );
}

function rankedCountry(save: SaveGame, player: Player): string {
  if (player.id === save.userPlayerId) {
    return (
      save.playerCareerResources?.cappedCountry ??
      save.playerCareerResources?.declaredCountry ??
      player.nationality
    );
  }
  return player.nationality;
}

/**
 * Format/category player rankings. All-Rounder rating follows the published
 * batting-rating × bowling-rating ÷ 1000 index used by the real ICC tables.
 */
export function internationalPlayerRankings(
  save: SaveGame,
  format: InternationalRankingFormat,
  kind: InternationalPlayerRankingKind,
): InternationalPlayerRankingRow[] {
  return Object.values(save.players)
    .filter((player) => !player.hidden && !player.retired)
    .map((player) => {
      const stats = competitionStats(player, format);
      const batting = stats ? battingRating(player, stats, format) : 0;
      const bowling = stats ? bowlingRating(player, stats, format) : 0;
      const rating =
        kind === 'BATTING'
          ? batting
          : kind === 'BOWLING'
            ? bowling
            : Math.round((batting * bowling) / 1000);
      return {
        playerId: player.id,
        name: player.name,
        countryId: rankedCountry(save, player),
        rating,
        isUser: player.id === save.userPlayerId,
      };
    })
    .filter((row) => row.rating > 0)
    .sort(
      (left, right) =>
        right.rating - left.rating ||
        left.name.localeCompare(right.name) ||
        left.playerId.localeCompare(right.playerId),
    )
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function rankingYear(save: SaveGame, fixture: Fixture): number {
  return (
    save.seasons[fixture.seasonId]?.year ??
    (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ??
    2026
  );
}

function nextPeak(
  current: InternationalPlayerRankingPeak | undefined,
  row: InternationalPlayerRankingRow,
  seasonId: string,
  year: number,
  age: number,
): InternationalPlayerRankingPeak {
  if (!current) {
    return {
      bestRank: row.rank,
      ratingAtBestRank: row.rating,
      bestRankSeasonId: seasonId,
      bestRankYear: year,
      bestRankAge: age,
      bestRating: row.rating,
      rankAtBestRating: row.rank,
      bestRatingSeasonId: seasonId,
      bestRatingYear: year,
      bestRatingAge: age,
    };
  }
  const result = { ...current };
  if (
    row.rank < current.bestRank ||
    (row.rank === current.bestRank && row.rating > current.ratingAtBestRank)
  ) {
    result.bestRank = row.rank;
    result.ratingAtBestRank = row.rating;
    result.bestRankSeasonId = seasonId;
    result.bestRankYear = year;
    result.bestRankAge = age;
  }
  if (
    row.rating > current.bestRating ||
    (row.rating === current.bestRating && row.rank < current.rankAtBestRating)
  ) {
    result.bestRating = row.rating;
    result.rankAtBestRating = row.rank;
    result.bestRatingSeasonId = seasonId;
    result.bestRatingYear = year;
    result.bestRatingAge = age;
  }
  return result;
}

/** Record the protagonist's independent best rank and best rating after a match. */
export function updateInternationalPlayerRankingPeaks(save: SaveGame, fixture: Fixture): void {
  if (save.mode !== 'career' || !save.userPlayerId || !isInternationalFixture(fixture)) return;
  const format = fixture.format as InternationalRankingFormat;
  if (format !== 'TEST' && format !== 'ODI' && format !== 'T20') return;
  const user = save.players[save.userPlayerId];
  if (!user || user.retired) return;

  save.internationalPlayerRankingPeaks ??= {};
  const formatPeaks = (save.internationalPlayerRankingPeaks[format] ??= {});
  const year = rankingYear(save, fixture);
  for (const kind of ['BATTING', 'BOWLING', 'ALL_ROUNDER'] as const) {
    const userRow = internationalPlayerRankings(save, format, kind).find((row) => row.isUser);
    if (!userRow) continue;
    formatPeaks[kind] = nextPeak(formatPeaks[kind], userRow, fixture.seasonId, year, user.age);
  }
}
