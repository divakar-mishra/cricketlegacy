import type { Fixture, MatchState, PlayerStats } from '../../domain/types';
import { ensureNationalTeam } from '../intlCalendar';
import {
  internationalPlayerRankings,
  internationalTeamRankings,
  updateInternationalPlayerRankingPeaks,
} from '../internationalRankings';
import { applyResult } from '../season';
import { emptyStats } from '../stats';
import { makeCareerSave } from './_depthHelpers';

function completedMatch(fixture: Fixture, winnerTeamId: string): MatchState {
  return {
    id: fixture.id,
    seed: 1,
    format: fixture.format,
    conditions: { pitch: 'FLAT', weather: 'CLEAR' },
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    innings: [],
    result: { winnerTeamId, margin: 'test result' },
  };
}

function rankedStats(values: Partial<PlayerStats>): PlayerStats {
  return { ...emptyStats(), ...values };
}

describe('international rankings', () => {
  it('updates only the completed format and cannot count one result twice', () => {
    const save = makeCareerSave(71);
    const india = ensureNationalTeam(save, 'india');
    const australia = ensureNationalTeam(save, 'australia');
    const fixture: Fixture = {
      id: 'rankings-odi-1',
      seasonId: save.currentSeasonId!,
      format: 'ODI',
      homeTeamId: india,
      awayTeamId: australia,
      venue: 'International Ground',
      round: 1,
      played: false,
      competition: 'BILATERAL_SERIES',
      competitionId: 'rankings-tour',
    };
    save.fixtures[fixture.id] = fixture;

    applyResult(save, completedMatch(fixture, india));
    applyResult(save, completedMatch(fixture, india));

    const odi = internationalTeamRankings(save, 'ODI');
    const tests = internationalTeamRankings(save, 'TEST');
    expect(odi.find((row) => row.countryId === 'india')?.matches).toBe(1);
    expect(odi.find((row) => row.countryId === 'australia')?.matches).toBe(1);
    expect(tests.find((row) => row.countryId === 'india')?.matches).toBe(0);
    expect(odi.find((row) => row.countryId === 'india')!.rating).toBeGreaterThan(
      odi.find((row) => row.countryId === 'australia')!.rating,
    );
  });

  it('ranks eligible players separately by format and discipline', () => {
    const save = makeCareerSave(72);
    const user = save.players[save.userPlayerId!];
    const otherPlayers = Object.values(save.players).filter((player) => player.id !== user.id);
    const bowler = otherPlayers[0];
    const retiredStar = otherPlayers[1];

    user.competitionStats = {
      ...(user.competitionStats ?? {}),
      ODI: rankedStats({
        matches: 30,
        runs: 1_650,
        balls: 1_800,
        notOuts: 3,
        wickets: 28,
        ballsBowled: 1_020,
        runsConceded: 870,
      }),
    };
    bowler.competitionStats = {
      ...(bowler.competitionStats ?? {}),
      ODI: rankedStats({
        matches: 30,
        runs: 180,
        balls: 260,
        wickets: 62,
        ballsBowled: 1_500,
        runsConceded: 1_180,
      }),
    };
    retiredStar.competitionStats = {
      ...(retiredStar.competitionStats ?? {}),
      ODI: rankedStats({
        matches: 60,
        runs: 5_000,
        balls: 4_000,
        wickets: 100,
        ballsBowled: 2_000,
        runsConceded: 1_200,
      }),
    };
    retiredStar.retired = true;

    const batting = internationalPlayerRankings(save, 'ODI', 'BATTING');
    const bowling = internationalPlayerRankings(save, 'ODI', 'BOWLING');
    const allRounders = internationalPlayerRankings(save, 'ODI', 'ALL_ROUNDER');
    const userBatting = batting.find((row) => row.playerId === user.id)!;
    const userBowling = bowling.find((row) => row.playerId === user.id)!;
    const userAllRounder = allRounders.find((row) => row.playerId === user.id)!;

    expect(batting[0].playerId).toBe(user.id);
    expect(bowling[0].playerId).toBe(bowler.id);
    expect(userAllRounder.rating).toBe(
      Math.round((userBatting.rating * userBowling.rating) / 1000),
    );
    expect(batting.some((row) => row.playerId === retiredStar.id)).toBe(false);
    expect(internationalPlayerRankings(save, 'TEST', 'BATTING')).toHaveLength(0);
  });

  it('persists independent best-position and best-rating milestones', () => {
    const save = makeCareerSave(73);
    const user = save.players[save.userPlayerId!];
    user.competitionStats = {
      ...(user.competitionStats ?? {}),
      ODI: rankedStats({
        matches: 25,
        runs: 1_200,
        balls: 1_350,
        notOuts: 2,
        wickets: 30,
        ballsBowled: 1_000,
        runsConceded: 850,
      }),
    };
    const fixture: Fixture = {
      id: 'ranking-peak-odi',
      seasonId: save.currentSeasonId!,
      format: 'ODI',
      homeTeamId: save.userTeamId!,
      awayTeamId: Object.keys(save.teams).find((teamId) => teamId !== save.userTeamId)!,
      venue: 'International Ground',
      round: 1,
      played: true,
      competition: 'BILATERAL_SERIES',
    };

    updateInternationalPlayerRankingPeaks(save, fixture);
    const first = save.internationalPlayerRankingPeaks?.ODI?.ALL_ROUNDER;
    expect(first).toMatchObject({
      bestRankSeasonId: fixture.seasonId,
      bestRankYear: save.seasons[save.currentSeasonId!].year,
      bestRankAge: user.age,
      bestRatingSeasonId: fixture.seasonId,
      bestRatingYear: save.seasons[save.currentSeasonId!].year,
      bestRatingAge: user.age,
    });

    user.age += 1;
    user.competitionStats.ODI!.runs += 500;
    user.competitionStats.ODI!.balls += 400;
    updateInternationalPlayerRankingPeaks(save, fixture);
    const improved = save.internationalPlayerRankingPeaks?.ODI?.ALL_ROUNDER;
    expect(improved!.bestRank).toBeLessThanOrEqual(first!.bestRank);
    expect(improved!.bestRating).toBeGreaterThanOrEqual(first!.bestRating);
    expect(improved!.ratingAtBestRank).toBeGreaterThan(0);
    expect(improved!.rankAtBestRating).toBeGreaterThan(0);
  });
});
