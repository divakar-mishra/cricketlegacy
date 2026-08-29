import type { MatchState, SaveGame } from '../../domain/types';
import { TEAM_BLUEPRINTS } from '../../content/teams';
import { buildUserPlayer, createCareerSave } from '../createGame';
import {
  archiveNewspaperStory,
  buildMilestoneNewspaperStory,
  buildNewspaperStory,
  buildPromotionNewspaperStory,
  buildTournamentEliminationNewspaperStory,
  buildTrophyNewspaperStory,
  markNewspaperSeen,
} from '../newspaper';
import { hasRawNewspaperPlaceholder } from '../newspaperContent';

function makeSave() {
  const player = buildUserPlayer({
    name: 'Aarav Sen',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: {
      technique: 70,
      timing: 70,
      power: 70,
      footwork: 70,
      temperament: 70,
      running: 70,
    },
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

function chaseMatch(
  save: SaveGame,
  awayTeamId: string,
  options: {
    id?: string;
    runs?: number;
    balls?: number;
    wickets?: number;
    playerOfMatch?: boolean;
    margin?: string;
  } = {},
): MatchState {
  const userTeamId = save.userTeamId!;
  const userPlayerId = save.userPlayerId!;
  const runs = options.runs ?? 123;
  const balls = options.balls ?? 111;
  const wickets = options.wickets ?? 0;
  return {
    id: options.id ?? 'century-chase',
    seed: 2,
    format: 'ODI',
    conditions: { pitch: 'FLAT', weather: 'CLEAR' },
    homeTeamId: userTeamId,
    awayTeamId,
    innings: [
      {
        battingTeamId: awayTeamId,
        bowlingTeamId: userTeamId,
        runs: 250,
        wickets: 8,
        overs: 50,
        balls: 300,
        events: [],
        batting: [],
        bowling:
          wickets > 0 ? [{ playerId: userPlayerId, balls: 60, maidens: 1, runs: 42, wickets }] : [],
      },
      {
        battingTeamId: userTeamId,
        bowlingTeamId: awayTeamId,
        runs: 251,
        wickets: 5,
        overs: 47,
        balls: 282,
        events: [],
        batting: [
          {
            playerId: userPlayerId,
            runs,
            balls,
            fours: Math.floor(runs / 12),
            sixes: Math.floor(runs / 40),
            out: true,
            battedOrder: 1,
          },
        ],
        bowling: [],
        target: 251,
      },
    ],
    result: {
      winnerTeamId: userTeamId,
      margin: options.margin ?? '5 wickets',
      playerOfMatchId: options.playerOfMatch ? userPlayerId : undefined,
    },
  };
}

function addInternationalTournament(save: SaveGame, competitionId: string): void {
  save.internationalTournaments ??= {};
  save.internationalTournaments[competitionId] = {
    id: competitionId,
    year: 2026,
    name: 'T20 World Cup 2026',
    format: 'T20',
    controlledCountryId: 'india',
    controlledTeamId: save.userTeamId!,
    participantCountryIds: ['india', 'australia', 'england', 'pakistan', 'south-africa'],
    groupCountryIds: ['india', 'australia', 'england', 'pakistan', 'south-africa'],
    groupFixtureIds: [],
    standings: {},
    stage: 'ELIMINATED',
    position: 4,
    eliminatedAt: 'GROUP',
    rewardKeys: ['group-elimination'],
  };
}

describe('player career newspaper', () => {
  it('creates and archives a deterministic chase-century clipping once', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save, opponentId);
    const story = buildNewspaperStory(
      save,
      match,
      { selected: true, runs: 999, balls: 1, wickets: 9 },
      undefined,
      1000,
    )!;

    expect(story).toMatchObject({
      kind: 'MATCH',
      newspaperCategory: 'CENTURY_CHASE',
      runs: 123,
      balls: 111,
      wickets: 0,
      teamScore: '251/5',
      opponentScore: '250/8',
    });
    expect(story.templateId).toMatch(/^CC-/);
    expect([story.headline, story.subheadline, story.body].some(hasRawNewspaperPlaceholder)).toBe(
      false,
    );

    archiveNewspaperStory(save, story);
    archiveNewspaperStory(save, story);
    expect(save.experience?.mediaScrapbook).toHaveLength(1);
    expect(save.experience?.pendingNewspaperId).toBe(story.id);
    expect(
      buildNewspaperStory(save, match, { selected: true, runs: 0, balls: 0, wickets: 0 }),
    ).toEqual(story);

    markNewspaperSeen(save, story.id);
    expect(save.experience?.pendingNewspaperId).toBeUndefined();
  });

  it('does not manufacture a story for an ordinary appearance', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save, opponentId, { runs: 18, balls: 22 });

    expect(
      buildNewspaperStory(save, match, {
        selected: true,
        runs: 180,
        balls: 22,
        wickets: 5,
      }),
    ).toBeNull();
  });

  it('classifies large innings from the scorecard rather than caller-supplied performance', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const story = buildNewspaperStory(
      save,
      chaseMatch(save, opponentId, { id: 'double-century', runs: 204, balls: 181 }),
      { selected: true, runs: 0, balls: 0, wickets: 0 },
      undefined,
      2000,
    );

    expect(story).toMatchObject({
      kind: 'MATCH',
      newspaperCategory: 'CENTURY_CHASE',
      runs: 204,
      balls: 181,
    });
  });

  it('creates a champions clipping after a quiet personal performance in a final', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const match = chaseMatch(save, opponentId, { id: 'cup-final', runs: 8, balls: 12 });
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
      { selected: true, runs: 800, balls: 1, wickets: 10 },
      undefined,
      3000,
    );

    expect(story).toMatchObject({
      kind: 'TROPHY',
      newspaperCategory: 'TROPHY',
      trophyNames: ['National Knockout Cup'],
      runs: 8,
    });
    expect(story?.templateId).toMatch(/^TR-/);
  });

  it.each(['Quarter-Final', 'Semi-Final'])(
    'does not award a trophy newspaper for a %s win',
    (cupRound) => {
      const save = makeSave();
      const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
      const match = chaseMatch(save, opponentId, {
        id: `cup-${cupRound.toLowerCase()}`,
        runs: 8,
        balls: 12,
      });
      save.fixtures[match.id] = {
        id: match.id,
        seasonId: save.currentSeasonId!,
        format: 'ODI',
        homeTeamId: save.userTeamId!,
        awayTeamId: opponentId,
        venue: `National Knockout Cup - ${cupRound}`,
        round: 2,
        played: true,
        competition: 'CUP',
        cupRound,
        winnerTeamId: save.userTeamId,
      };

      expect(
        buildNewspaperStory(save, match, {
          selected: true,
          runs: 800,
          balls: 1,
          wickets: 10,
        }),
      ).toBeNull();
    },
  );

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
      newspaperCategory: 'TROPHY',
      trophyNames: ['Continental Cup'],
      result: 'WIN',
    });
    expect(story?.templateId).toMatch(/^TR-/);
  });

  it('creates and prioritizes a breaking promotion edition', () => {
    const save = makeSave();
    const promotion = buildPromotionNewspaperStory(save, 'U19', 'DOMESTIC', 4500)!;
    archiveNewspaperStory(save, promotion);

    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const matchStory = buildNewspaperStory(
      save,
      chaseMatch(save, opponentId, { id: 'post-promotion-match', runs: 101, balls: 90 }),
      { selected: true, runs: 0, balls: 0, wickets: 0 },
      undefined,
      4501,
    )!;
    archiveNewspaperStory(save, matchStory);

    expect(promotion).toMatchObject({
      kind: 'PROMOTION',
      newspaperCategory: 'PROMOTION',
      promotionFrom: 'U19',
      promotionTo: 'DOMESTIC',
      result: 'NEUTRAL',
    });
    expect(promotion.templateId).toMatch(/^PC-/);
    expect(save.experience?.pendingNewspaperId).toBe(promotion.id);
  });

  it('keeps a verified tournament-exit edition ahead of a later match story', () => {
    const save = makeSave();
    addInternationalTournament(save, 't20-world-cup-2026');
    const exit = buildTournamentEliminationNewspaperStory(save, {
      competitionId: 't20-world-cup-2026',
      tournamentName: 'T20 World Cup 2026',
      format: 'T20',
      year: 2026,
      position: 4,
      groupSize: 5,
      now: 5000,
    })!;
    archiveNewspaperStory(save, exit);

    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const matchStory = buildNewspaperStory(
      save,
      chaseMatch(save, opponentId, { id: 'post-exit-match', runs: 104, balls: 90 }),
      { selected: true, runs: 0, balls: 0, wickets: 0 },
      undefined,
      5001,
    )!;
    archiveNewspaperStory(save, matchStory);

    expect(exit).toMatchObject({
      kind: 'ELIMINATION',
      newspaperCategory: 'ELIMINATION',
      result: 'LOSS',
    });
    expect(exit.templateId).toMatch(/^EX-/);
    expect(save.experience?.mediaScrapbook).toHaveLength(2);
    expect(save.experience?.pendingNewspaperId).toBe(exit.id);
  });

  it('requires persisted tournament state before reporting an elimination', () => {
    const save = makeSave();
    expect(
      buildTournamentEliminationNewspaperStory(save, {
        competitionId: 'missing-event',
        tournamentName: 'Missing Event',
        format: 'T20',
        year: 2026,
        position: 4,
        groupSize: 5,
      }),
    ).toBeNull();
  });

  it('builds milestone copy only from an explicitly confirmed milestone or record', () => {
    const save = makeSave();
    expect(
      buildMilestoneNewspaperStory(save, {
        sourceId: 'empty',
        year: 2026,
        format: 'ODI',
        competition: 'Domestic One-Day Cup',
        count: 1000,
      }),
    ).toBeNull();

    const story = buildMilestoneNewspaperStory(save, {
      sourceId: 'one-thousand-runs',
      year: 2026,
      format: 'ODI',
      competition: 'Domestic One-Day Cup',
      count: 1000,
      milestone: '1,000 career runs',
      teamId: save.userTeamId,
      now: 6000,
    });
    expect(story).toMatchObject({
      kind: 'MILESTONE',
      newspaperCategory: 'MILESTONE_RECORD',
      result: 'NEUTRAL',
    });
    expect(story?.templateId).toMatch(/^MR-/);
  });

  it('rejects incomplete match state rather than inventing score or result facts', () => {
    const save = makeSave();
    const opponentId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const noResult = chaseMatch(save, opponentId);
    delete noResult.result;
    expect(
      buildNewspaperStory(save, noResult, { selected: true, runs: 123, balls: 111, wickets: 0 }),
    ).toBeNull();

    const invalidScore = chaseMatch(save, opponentId, { id: 'invalid-score' });
    invalidScore.innings[0].runs = Number.NaN;
    expect(
      buildNewspaperStory(save, invalidScore, {
        selected: true,
        runs: 123,
        balls: 111,
        wickets: 0,
      }),
    ).toBeNull();
  });
});
