import { createCareerSave, buildUserPlayer } from '../createGame';
import { shouldRunU19WorldCup, u19Qualifies } from '../u19';

function makeU19Save() {
  const player = buildUserPlayer({
    name: 'Test Player',
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 60, timing: 60, power: 55, footwork: 55, temperament: 60, running: 55 },
    bowling: { paceOrSpin: 30, accuracy: 30, movement: 30, variations: 30, stamina: 30 },
    fielding: { catching: 50, throwing: 50, agility: 50, keeping: 30 },
    meta: { fitness: 70, confidence: 60, aggression: 50, discipline: 60 },
    age: 17,
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 42,
  });
  save.careerPathLevel = 'U19';
  save.careerPathMatches = 5;
  save.nationalRep = 80; // enough for avg rating >= 6.5
  return save;
}

describe('u19Qualifies', () => {
  it('qualifies when conditions are met', () => {
    const save = makeU19Save();
    expect(u19Qualifies(save)).toBe(true);
  });

  it('does not qualify when not U19 level', () => {
    const save = makeU19Save();
    save.careerPathLevel = 'DOMESTIC';
    expect(u19Qualifies(save)).toBe(false);
  });

  it('does not qualify with too few matches', () => {
    const save = makeU19Save();
    save.careerPathMatches = 1;
    expect(u19Qualifies(save)).toBe(false);
  });
});

describe('shouldRunU19WorldCup', () => {
  it('fires in even years', () => {
    const save = makeU19Save();
    // 2026 is even
    expect(shouldRunU19WorldCup(save)).toBe(true);
  });

  it('does not fire in odd years', () => {
    const save = makeU19Save();
    const yearId = save.currentSeasonId!;
    save.seasons[yearId].year = 2027;
    expect(shouldRunU19WorldCup(save)).toBe(false);
  });
});
