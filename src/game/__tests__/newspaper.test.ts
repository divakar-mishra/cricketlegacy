import type { MatchState } from '../../domain/types';
import { TEAM_BLUEPRINTS } from '../../content/teams';
import { buildUserPlayer, createCareerSave } from '../createGame';
import {
  archiveNewspaperStory,
  buildNewspaperStory,
  buildTrophyNewspaperStory,
  markNewspaperSeen,
} from '../newspaper';

function makeSave() {
  const player = buildUserPlayer({
    name: 'Aarav Sen',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 70, timing: 70, power: 70, footwork: 70, temperament: 70, running: 70 },
    bowling: { paceOrSpin: 30, accuracy: 30, movement: 30, variations: 30, stamina: 50 },
    fielding: { catching: 65, throwing: 65, agility: 65, keeping: 20 },
    meta: { fitness: 70, confidence: 70, aggression: 60, discipline: 70 },
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 81,
  });
}

function chaseMatch(homeTeamId: string, awayTeamId: string): MatchState {
  return {
    id: 'century-chase',
    seed: 2,
    format: 'ODI',
    conditions: { pitch: 'FLAT', weather: 'CLEAR' },
    homeTeamId,
    awayTeamId,
    innings: [
      {
        battingTeamId: awayTeamId,
        bowlingTeamId: homeTeamId,
        runs: 250,
        wickets: 8,
        overs: 50,
        balls: 300,
        events: [],
        batting: [],
        bowling: [],
      },
      {
        battingTeamId: homeTeamId,
        bowlingTeamId: awayTeamId,
        runs: 251,
        wickets: 5,
        overs: 47,
        balls: 282,
        events: [],
        batting: [],
        bowling: [],
        target: 251,
      },
    ],
    result: { winnerTeamId: homeTeamId, margin: '5 wickets', playerOfMatchId: 'user' },
  };
}

describe('player career newspaper', () => {
  it('creates a chase-aware century headline and archives it once', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save.userTeamId!, opponentId);
    const story = buildNewspaperStory(
      save,
      match,
      { selected: true, runs: 123, balls: 111, wickets: 0 },
      undefined,
      1000,
    )!;

    expect(story.headline).toContain('MASTERS THE CHASE');
    archiveNewspaperStory(save, story);
    archiveNewspaperStory(save, story);
    expect(save.experience?.mediaScrapbook).toHaveLength(1);
    expect(save.experience?.pendingNewspaperId).toBe(story.id);

    markNewspaperSeen(save, story.id);
    expect(save.experience?.pendingNewspaperId).toBeUndefined();
  });

  it('does not manufacture a story for an ordinary appearance', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save.userTeamId!, opponentId);
    match.result = { winnerTeamId: save.userTeamId, margin: '5 wickets' };

    expect(
      buildNewspaperStory(save, match, {
        selected: true,
        runs: 18,
        balls: 22,
        wickets: 0,
      }),
    ).toBeNull();
  });

  it('creates a marquee clipping for a double century', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const story = buildNewspaperStory(
      save,
      chaseMatch(save.userTeamId!, opponentId),
      { selected: true, runs: 204, balls: 181, wickets: 0 },
      undefined,
      2000,
    );

    expect(story).toMatchObject({
      kind: 'MATCH',
      headline: expect.stringContaining('MAKES IT A DOUBLE'),
      runs: 204,
    });
  });

  it('creates a champions clipping after a quiet personal performance in a Final', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save.userTeamId!, opponentId);
    match.id = 'cup-final';
    save.fixtures[match.id] = {
      id: match.id,
      seasonId: save.currentSeasonId!,
      format: 'ODI',
      homeTeamId: save.userTeamId!,
      awayTeamId: opponentId,
      venue: 'National Knockout Cup - Final',
      round: 3,
      played: true,
      competition: 'CUP',
      cupRound: 'Final',
      winnerTeamId: save.userTeamId,
    };

    const story = buildNewspaperStory(
      save,
      match,
      { selected: true, runs: 8, balls: 12, wickets: 0 },
      undefined,
      3000,
    );

    expect(story).toMatchObject({
      kind: 'TROPHY',
      trophyNames: ['National Knockout Cup'],
      headline: expect.stringContaining('LIFTS THE TROPHY'),
    });
  });

  it('builds a season-end champions clipping for simulated silverware', () => {
    const save = makeSave();
    const story = buildTrophyNewspaperStory(save, {
      year: 2026,
      trophyNames: ['Continental Cup'],
      sourceId: 'season-2026',
      now: 4000,
    });

    expect(story).toMatchObject({
      id: 'paper-trophy-season-2026-4000',
      matchId: 'trophy-season-2026',
      kind: 'TROPHY',
      trophyNames: ['Continental Cup'],
      result: 'WIN',
    });
  });
});
