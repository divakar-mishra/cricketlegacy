import { Fixture } from '../../domain/types';
import {
  advanceCup,
  cupChampionId,
  ensureCup,
  finishCup,
  nextUserCupTie,
  userCupStatus,
} from '../cup';
import { standings } from '../season';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

const cupTies = (save: { fixtures: Record<string, Fixture> }): Fixture[] =>
  Object.values(save.fixtures).filter((f) => f.competition === 'CUP');

describe('domestic cup', () => {
  it('builds an 8-team quarter-final bracket without touching the league table', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'STATE';
    ensureCup(save);
    const qf = cupTies(save);
    expect(qf.length).toBe(4);
    expect(qf.every((f) => f.cupRound === 'Quarter-Final')).toBe(true);
    expect(standings(save).every((r) => r.played === 0)).toBe(true);
  });

  it('advanceCup auto-sims AI ties and pauses at the user tie', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'STATE';
    advanceCup(save);
    expect(nextUserCupTie(save)).toBeTruthy();
    expect(userCupStatus(save)).toBe('PLAYING');
  });

  it('finishCup crowns a champion (7 ties total) and never edits the league table', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'STATE';
    finishCup(save);
    expect(cupChampionId(save)).toBeTruthy();
    // 4 QF + 2 SF + 1 Final.
    expect(cupTies(save).length).toBe(7);
    expect(standings(save).every((r) => r.played === 0)).toBe(true);
    expect(['WON', 'ELIMINATED']).toContain(userCupStatus(save));
  });

  it('does not create a national cup for school or U19 career players', () => {
    const save = makeCareerSave();
    save.careerPathLevel = 'SCHOOL';
    ensureCup(save);
    expect(cupTies(save)).toHaveLength(0);
    expect(nextUserCupTie(save)).toBeUndefined();
    expect(userCupStatus(save)).toBe('NONE');
  });

  it('does not create a national cup for a club-level manager', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'CLUB';
    ensureCup(save);
    expect(cupTies(save)).toHaveLength(0);
    expect(nextUserCupTie(save)).toBeUndefined();
    expect(userCupStatus(save)).toBe('NONE');
  });
});
