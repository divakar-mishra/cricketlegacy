import { TEAM_BLUEPRINTS } from '../../content/teams';
import type { SaveGame } from '../../domain/types';
import { acceptAuctionOffer } from '../auction';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { careerSelectionDecision, checkPathPromotion } from '../career';
import { synchronizeCareerPromotion } from '../careerTransition';
import { isInternationalFixture } from '../intlCalendar';
import { matchDecisionAuthority } from '../matchAuthority';
import {
  buildPlayerSeasonCalendar,
  currentPlayerCalendarEvent,
  playerCalendarAllowsFixture,
} from '../playerCalendar';
import {
  applyResult,
  createLiveMatch,
  nextUserFixtureId,
  runFixture,
  seasonComplete,
  stagePlayoffsForUser,
  startNewSeason,
} from '../season';
import {
  isU19WorldCupFixture,
  nextU19WorldCupUserFixture,
  progressU19WorldCupAfterResult,
  recordU19WorldCupMerit,
  synchronizeU19WorldCupState,
} from '../u19WorldCup';
import { careerPlayingTeamId } from '../youthFixtures';

function selectedSave() {
  const player = buildUserPlayer({
    name: 'Merit Prospect',
    age: 18,
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 66, timing: 66, power: 64, footwork: 64, temperament: 66, running: 62 },
    bowling: { paceOrSpin: 35, accuracy: 35, movement: 34, variations: 34, stamina: 42 },
    fielding: { catching: 60, throwing: 60, agility: 62, keeping: 35 },
    meta: { fitness: 72, confidence: 68, aggression: 58, discipline: 66 },
  });
  const save = createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 1818,
  });
  const regional = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.competitionId === 'youth-u19' &&
        (fixture.homeTeamId === save.careerPathTeamId ||
          fixture.awayTeamId === save.careerPathTeamId),
    )
    .sort((left, right) => left.round - right.round);

  for (const fixture of regional.slice(0, 3)) {
    recordU19WorldCupMerit(save, {
      fixtureId: fixture.id,
      runs: 75,
      wickets: 0,
      rating: 7,
    });
  }
  for (const fixture of regional) fixture.played = true;
  save.playerCalendar = undefined;
  synchronizeU19WorldCupState(save);
  buildPlayerSeasonCalendar(save);
  return save;
}

function moveSelectedSaveToDomestic(save: SaveGame): void {
  save.careerPathLevel = 'DOMESTIC';
  save.careerPathMatches = 0;
  save.careerPathRuns = 0;
  save.careerPathWickets = 0;
  save.careerPathRatingSum = 0;
  synchronizeCareerPromotion(save, { promoted: true, from: 'U19', to: 'DOMESTIC' });
}

describe('U19 World Cup career integration', () => {
  it('routes the same normal Matchday fixture through the U19 national XI', () => {
    const save = selectedSave();
    const fixtureId = nextUserFixtureId(save)!;
    const fixture = save.fixtures[fixtureId];

    expect(isU19WorldCupFixture(fixture)).toBe(true);
    expect(currentPlayerCalendarEvent(save)?.fixtureId).toBe(fixtureId);
    expect(playerCalendarAllowsFixture(save, fixtureId)).toBe(true);
    expect(careerPlayingTeamId(save, fixtureId)).toBe(save.u19WorldCup?.controlledTeamId);
    expect(isInternationalFixture(fixture)).toBe(false);
    expect(careerSelectionDecision(save, fixture.format, fixtureId)).toMatchObject({
      selected: true,
      reason: 'Selected in the U19 World Cup XI on tournament merit.',
    });

    save.captainClub = true;
    expect(matchDecisionAuthority(save, fixture)).toMatchObject({
      kind: 'PLAYER',
      canControlTeam: false,
    });
    const live = createLiveMatch(save, fixtureId, save.userPlayerId);
    expect(live.controlledTeamId).toBe(save.u19WorldCup?.controlledTeamId);
    expect(save.capped).not.toBe(true);
    expect(save.userCaps ?? 0).toBe(0);
  });

  it('holds an earned Domestic promotion only until the selected tournament ends', () => {
    const save = selectedSave();
    save.careerPathMatches = 6;
    save.careerPathRuns = 320;
    save.careerPathRatingSum = 42;

    expect(checkPathPromotion(save)).toEqual({ promoted: false });
    expect(seasonComplete(save)).toBe(false);

    let guard = 0;
    while (save.u19WorldCup?.status === 'SELECTED' && guard++ < 3) {
      const fixture = nextU19WorldCupUserFixture(save)!;
      fixture.played = true;
      fixture.winnerTeamId = save.u19WorldCup!.controlledTeamId;
      fixture.resultKind = fixture.homeTeamId === fixture.winnerTeamId ? 'HOME_WIN' : 'AWAY_WIN';
      progressU19WorldCupAfterResult(save, fixture.id);
    }

    expect(save.u19WorldCup?.status).toBe('CHAMPION');
    const promotion = checkPathPromotion(save);
    expect(promotion).toEqual({ promoted: true, from: 'U19', to: 'DOMESTIC' });
    synchronizeCareerPromotion(save, promotion);
    expect(save.careerPathLevel).toBe('DOMESTIC');
    expect(Object.values(save.fixtures).filter(isU19WorldCupFixture)).toHaveLength(5);
    expect(save.capped).not.toBe(true);
    expect(save.userCaps ?? 0).toBe(0);
  });

  it('keeps the cup on an early Domestic player calendar without treating it as senior duty', () => {
    const save = selectedSave();
    moveSelectedSaveToDomestic(save);

    const calendar = buildPlayerSeasonCalendar(save)!;
    const cupEvents = calendar.events.filter(
      (event) => event.fixtureId && isU19WorldCupFixture(save.fixtures[event.fixtureId]),
    );
    const expectedCupFixtureIds = Object.values(save.fixtures)
      .filter(
        (fixture) =>
          isU19WorldCupFixture(fixture) &&
          fixture.seasonId === save.currentSeasonId &&
          (fixture.homeTeamId === save.u19WorldCup?.controlledTeamId ||
            fixture.awayTeamId === save.u19WorldCup?.controlledTeamId),
      )
      .map((fixture) => fixture.id)
      .sort();
    expect(cupEvents.map((event) => event.fixtureId!).sort()).toEqual(expectedCupFixtureIds);
    expect(new Set(cupEvents.map((event) => event.fixtureId)).size).toBe(cupEvents.length);
    expect(cupEvents.every((event) => event.month === 6)).toBe(true);
    expect(save.capped).not.toBe(true);
    expect(save.internationalCalendar?.events ?? []).toHaveLength(0);
  });

  it('never auto-simulates the player World Cup tie as a domestic playoff', () => {
    const save = selectedSave();
    const fixture = nextU19WorldCupUserFixture(save)!;
    const year = save.seasons[save.currentSeasonId!].year;
    save.playerCalendar = {
      year,
      cursor: 0,
      events: [
        {
          id: 'calendar-pause',
          year,
          month: 5,
          week: 4,
          kind: 'TRAINING',
          title: 'Calendar pause',
          detail: 'Regression guard',
          completed: false,
        },
      ],
    };

    stagePlayoffsForUser(save);
    expect(save.fixtures[fixture.id].played).toBe(false);
  });

  it('retains one completed bracket through reload and later season rollover', () => {
    const save = selectedSave();
    let guard = 0;
    while (save.u19WorldCup?.status === 'SELECTED' && guard++ < 3) {
      const fixture = nextU19WorldCupUserFixture(save)!;
      fixture.played = true;
      fixture.winnerTeamId = save.u19WorldCup!.controlledTeamId;
      fixture.resultKind = fixture.homeTeamId === fixture.winnerTeamId ? 'HOME_WIN' : 'AWAY_WIN';
      progressU19WorldCupAfterResult(save, fixture.id);
    }
    const originalIds = Object.values(save.fixtures)
      .filter(isU19WorldCupFixture)
      .map((fixture) => fixture.id)
      .sort();
    const reloaded = JSON.parse(JSON.stringify(save)) as SaveGame;
    synchronizeU19WorldCupState(reloaded);
    expect(
      Object.values(reloaded.fixtures)
        .filter(isU19WorldCupFixture)
        .map((fixture) => fixture.id)
        .sort(),
    ).toEqual(originalIds);

    startNewSeason(reloaded);
    synchronizeU19WorldCupState(reloaded);
    expect(reloaded.u19WorldCup?.status).toBe('CHAMPION');
    expect(
      Object.values(reloaded.fixtures)
        .filter(isU19WorldCupFixture)
        .map((fixture) => fixture.id)
        .sort(),
    ).toEqual(originalIds);
  });

  it('preserves the completed bracket when a later domestic auction changes clubs', () => {
    const save = selectedSave();
    let guard = 0;
    while (save.u19WorldCup?.status === 'SELECTED' && guard++ < 3) {
      const fixture = nextU19WorldCupUserFixture(save)!;
      fixture.played = true;
      fixture.winnerTeamId = save.u19WorldCup!.controlledTeamId;
      fixture.resultKind = fixture.homeTeamId === fixture.winnerTeamId ? 'HOME_WIN' : 'AWAY_WIN';
      progressU19WorldCupAfterResult(save, fixture.id);
    }
    moveSelectedSaveToDomestic(save);

    const originalIds = Object.values(save.fixtures)
      .filter(isU19WorldCupFixture)
      .map((fixture) => fixture.id)
      .sort();
    const targetTeamId = save.leagues['league-1'].teamIds.find(
      (teamId) => teamId !== save.userTeamId,
    )!;
    save.auctionOffers = [
      { teamId: targetTeamId, fee: 500_000, signingBonus: 1_000, wagePromise: 80_000 },
    ];

    expect(acceptAuctionOffer(save, targetTeamId).ok).toBe(true);
    expect(
      Object.values(save.fixtures)
        .filter(isU19WorldCupFixture)
        .map((fixture) => fixture.id)
        .sort(),
    ).toEqual(originalIds);
    expect(save.seasons[save.currentSeasonId!].fixtureIds).toEqual(
      expect.arrayContaining(originalIds),
    );
  });

  it('records a World Cup title and player award when the final is won', () => {
    const save = selectedSave();
    let guard = 0;
    while (save.u19WorldCup?.status === 'SELECTED' && guard++ < 3) {
      const fixture = nextU19WorldCupUserFixture(save)!;
      const match = runFixture(save, fixture.id);
      match.result = {
        winnerTeamId: save.u19WorldCup!.controlledTeamId,
        margin: 'Won by 5 wickets',
      };
      applyResult(save, match);
    }

    expect(save.u19WorldCup?.status).toBe('CHAMPION');
    expect(save.records?.titles.filter((title) => title.name === 'U19 World Cup')).toHaveLength(1);
    expect(save.players[save.userPlayerId!].awards).toContain('U19 World Cup Champion');
  });
});
