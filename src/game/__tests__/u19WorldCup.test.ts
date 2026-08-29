import { Role, SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import {
  getU19WorldCupFixturesByRound,
  isU19WorldCupFixture,
  isU19WorldCupTournamentComplete,
  nextU19WorldCupUserFixture,
  recordU19WorldCupMerit,
  progressU19WorldCupAfterResult,
  synchronizeU19WorldCupState,
  u19WorldCupBlocksPromotion,
} from '../u19WorldCup';

function makeSave(role: Role = 'BATTER', age = 17, nationality = 'india'): SaveGame {
  const player = buildUserPlayer({
    name: 'Youth Prospect',
    nationality,
    role,
    battingStyle: 'RHB',
    bowlingStyle: role === 'BOWLER' || role === 'ALLROUNDER' ? 'PACE' : undefined,
    batting: { technique: 60, timing: 60, power: 58, footwork: 58, temperament: 60, running: 58 },
    bowling: { paceOrSpin: 58, accuracy: 58, movement: 56, variations: 55, stamina: 60 },
    fielding: { catching: 58, throwing: 58, agility: 58, keeping: 40 },
    meta: { fitness: 70, confidence: 62, aggression: 52, discipline: 64 },
    age,
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 44,
  });
  save.careerPathLevel = 'U19';
  save.careerPathMatches = 0;
  save.careerPathRuns = 0;
  save.careerPathWickets = 0;
  save.careerPathRatingSum = 0;
  return save;
}

function recordStrongBattingMerit(save: SaveGame): void {
  const fixtureIds = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.competitionId === 'youth-u19' &&
        (fixture.homeTeamId === save.careerPathTeamId ||
          fixture.awayTeamId === save.careerPathTeamId),
    )
    .sort((left, right) => left.round - right.round)
    .map((fixture) => fixture.id);
  for (let index = 1; index <= 3; index += 1) {
    recordU19WorldCupMerit(save, {
      fixtureId: fixtureIds[index - 1],
      runs: 75,
      wickets: 0,
      rating: 7,
    });
  }
}

describe('U19 World Cup selection merit', () => {
  it('retains earned merit through an early Domestic promotion and waits for age 18', () => {
    const save = makeSave('BATTER', 17);
    recordStrongBattingMerit(save);

    expect(save.u19WorldCup?.merit.qualified).toBe(true);
    expect(save.u19WorldCup?.status).toBe('TRACKING');
    const snapshot = { ...save.u19WorldCup!.merit };

    save.careerPathLevel = 'DOMESTIC';
    save.careerPathMatches = 0;
    save.careerPathRuns = 0;
    save.careerPathRatingSum = 0;
    save.players[save.userPlayerId!].age = 18;
    synchronizeU19WorldCupState(save);

    expect(save.u19WorldCup?.status).toBe('SELECTED');
    expect(save.u19WorldCup?.merit.runs).toBe(snapshot.runs);
    expect(save.careerPathLevel).toBe('DOMESTIC');
    expect(save.capped).not.toBe(true);
    expect(save.userCaps ?? 0).toBe(0);
  });

  it('keeps an attainable, role-aware gate based on actual U19 appearances', () => {
    const bowler = makeSave('BOWLER', 18);
    const bowlerFixtures = Object.values(bowler.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 'youth-u19' &&
        (fixture.homeTeamId === bowler.careerPathTeamId ||
          fixture.awayTeamId === bowler.careerPathTeamId),
    );
    for (let index = 1; index <= 3; index += 1) {
      recordU19WorldCupMerit(bowler, {
        fixtureId: bowlerFixtures[index - 1].id,
        runs: 0,
        wickets: 4,
        rating: 6.5,
      });
    }
    expect(bowler.u19WorldCup?.merit.qualified).toBe(true);
    expect(bowler.u19WorldCup?.status).toBe('SELECTED');

    const batter = makeSave('BATTER', 18);
    const batterFixtures = Object.values(batter.fixtures).filter(
      (fixture) =>
        fixture.competitionId === 'youth-u19' &&
        (fixture.homeTeamId === batter.careerPathTeamId ||
          fixture.awayTeamId === batter.careerPathTeamId),
    );
    for (let index = 1; index <= 3; index += 1) {
      recordU19WorldCupMerit(batter, {
        fixtureId: batterFixtures[index - 1].id,
        runs: 0,
        wickets: 4,
        rating: 6.5,
      });
    }
    expect(batter.u19WorldCup?.merit.qualified).toBe(false);
    expect(batter.u19WorldCup?.status).toBe('TRACKING');
  });

  it('leaves the gate open throughout age 18, then closes it permanently', () => {
    const save = makeSave('BATTER', 18);
    synchronizeU19WorldCupState(save);
    expect(save.u19WorldCup?.status).toBe('TRACKING');
    expect(save.u19WorldCup?.opportunityYear).toBe(save.seasons[save.currentSeasonId!].year);

    save.players[save.userPlayerId!].age = 19;
    synchronizeU19WorldCupState(save);
    expect(save.u19WorldCup?.status).toBe('NOT_SELECTED');

    save.u19WorldCup!.merit.qualified = true;
    save.players[save.userPlayerId!].age = 18;
    synchronizeU19WorldCupState(save);
    expect(save.u19WorldCup?.status).toBe('NOT_SELECTED');
    expect(Object.values(save.fixtures).filter(isU19WorldCupFixture)).toHaveLength(0);
  });

  it('gives a qualified legacy U19 player at age 19 an immediate final chance', () => {
    const save = makeSave('BATTER', 19);
    save.careerPathMatches = 4;
    save.careerPathRuns = 250;
    save.careerPathRatingSum = 27;
    delete save.u19WorldCup;

    const state = synchronizeU19WorldCupState(save);

    expect(state?.merit.qualified).toBe(true);
    expect(state?.status).toBe('SELECTED');
  });
});

describe('six-country U19 World Cup bracket', () => {
  function selectedSave(): SaveGame {
    const save = makeSave('BATTER', 17);
    recordStrongBattingMerit(save);
    save.players[save.userPlayerId!].age = 18;
    synchronizeU19WorldCupState(save);
    return save;
  }

  it('creates stable dedicated squads and forces a healthy selected user into the XI', () => {
    const save = selectedSave();
    const state = save.u19WorldCup!;
    expect(new Set(state.participantCountryIds).size).toBe(6);
    expect(new Set(state.teamIds).size).toBe(6);
    expect(state.teamIds.every((id) => id.startsWith('u19-national-'))).toBe(true);
    expect(save.teams[state.controlledTeamId!].playerIds).toContain(save.userPlayerId);
    expect(save.teams[state.controlledTeamId!].xi).toContain(save.userPlayerId);
    expect(
      state.teamIds.every((teamId) =>
        save.teams[teamId].playerIds
          .filter((playerId) => playerId !== save.userPlayerId)
          .every((playerId) => {
            const age = save.players[playerId].age;
            return age >= 16 && age <= 19;
          }),
      ),
    ).toBe(true);

    const fixtureIds = Object.values(save.fixtures)
      .filter(isU19WorldCupFixture)
      .map((fixture) => fixture.id)
      .sort();
    synchronizeU19WorldCupState(save);
    expect(
      Object.values(save.fixtures)
        .filter(isU19WorldCupFixture)
        .map((fixture) => fixture.id)
        .sort(),
    ).toEqual(fixtureIds);
  });

  it('dynamically advances 2 quarter-finals, 2 semi-finals and a final', () => {
    const save = selectedSave();
    let guard = 0;
    while (!isU19WorldCupTournamentComplete(save) && guard++ < 3) {
      const userFixture = nextU19WorldCupUserFixture(save);
      expect(userFixture).toBeDefined();
      userFixture!.played = true;
      userFixture!.winnerTeamId = save.u19WorldCup!.controlledTeamId;
      progressU19WorldCupAfterResult(save, userFixture!.id);
    }

    const rounds = getU19WorldCupFixturesByRound(save);
    expect(rounds.quarterFinals).toHaveLength(2);
    expect(rounds.semiFinals).toHaveLength(2);
    expect(rounds.final).toHaveLength(1);
    expect([...rounds.quarterFinals, ...rounds.semiFinals, ...rounds.final]).toHaveLength(5);
    expect(save.u19WorldCup?.status).toBe('CHAMPION');
    expect(isU19WorldCupTournamentComplete(save)).toBe(true);
    expect(u19WorldCupBlocksPromotion(save)).toBe(false);
  });

  it('lets an unseeded selected country play quarter-final, semi-final and final', () => {
    const save = makeSave('BATTER', 17, 'usa');
    recordStrongBattingMerit(save);
    save.players[save.userPlayerId!].age = 18;
    synchronizeU19WorldCupState(save);

    const playedRounds: string[] = [];
    let guard = 0;
    while (!isU19WorldCupTournamentComplete(save) && guard++ < 3) {
      const fixture = nextU19WorldCupUserFixture(save)!;
      playedRounds.push(fixture.cupRound!);
      fixture.played = true;
      fixture.winnerTeamId = save.u19WorldCup!.controlledTeamId;
      progressU19WorldCupAfterResult(save, fixture.id);
    }

    expect(playedRounds).toEqual([
      'U19 World Cup Quarter-Final 1',
      'U19 World Cup Semi-Final 2',
      'U19 World Cup Final',
    ]);
    expect(save.u19WorldCup?.status).toBe('CHAMPION');
  });

  it('normalizes a knockout tie/no-result to one deterministic winner', () => {
    const first = selectedSave();
    const second = JSON.parse(JSON.stringify(first)) as SaveGame;
    const firstFixture = nextU19WorldCupUserFixture(first)!;
    firstFixture.played = true;
    firstFixture.resultKind = 'TIE';
    firstFixture.winnerTeamId = undefined;
    progressU19WorldCupAfterResult(first, firstFixture.id);
    const firstWinner = first.fixtures[firstFixture.id].winnerTeamId;

    const secondFixture = nextU19WorldCupUserFixture(second)!;
    secondFixture.played = true;
    secondFixture.resultKind = 'NO_RESULT';
    secondFixture.winnerTeamId = undefined;
    progressU19WorldCupAfterResult(second, secondFixture.id);

    expect(firstWinner).toBeDefined();
    expect(second.fixtures[secondFixture.id].winnerTeamId).toBe(firstWinner);
    expect(['HOME_WIN', 'AWAY_WIN']).toContain(first.fixtures[firstFixture.id].resultKind);
    expect(['HOME_WIN', 'AWAY_WIN']).toContain(second.fixtures[secondFixture.id].resultKind);
  });
});
