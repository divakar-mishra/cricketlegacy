import { CREATION } from '../../data/attributes';
import { allocatedCreationPoints, creationAttributeDelta, CreationAttrs } from '../creationAllocation';

function attrs(value = CREATION.base): CreationAttrs {
  return {
    batting: { technique: value, timing: value, power: value, footwork: value, temperament: value, running: value },
    bowling: { paceOrSpin: value, accuracy: value, movement: value, variations: value, stamina: value },
    fielding: { catching: value, throwing: value, agility: value, keeping: value },
    meta: { fitness: value, confidence: value, aggression: value, discipline: value },
  };
}

describe('creation attribute allocation', () => {
  it('increments by min(5, remaining points, remaining capacity)', () => {
    expect(creationAttributeDelta(40, 1, 20)).toBe(5);
    expect(creationAttributeDelta(40, 1, 4)).toBe(4);
    expect(creationAttributeDelta(40, 1, 3)).toBe(3);
    expect(creationAttributeDelta(CREATION.maxPerAttr - 2, 1, 20)).toBe(2);
  });

  it('does not allocate when no points or capacity remain', () => {
    expect(creationAttributeDelta(40, 1, 0)).toBe(0);
    expect(creationAttributeDelta(CREATION.maxPerAttr, 1, 20)).toBe(0);
  });

  it('calculates allocated points from the canonical creation attributes', () => {
    const current = attrs();
    current.batting.technique += 5;
    current.fielding.keeping += 3;

    expect(allocatedCreationPoints(current)).toBe(8);
  });
});
