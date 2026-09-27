import { CREATION } from '../../data/attributes';
import { activeCreationAttributeDelta, allocatedActiveCreationPoints, allocatedCreationPoints, creationAttributeDelta, CreationAttrs } from '../creationAllocation';

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

  it('charges the displayed Grade A gain, including partial final steps', () => {
    const scale = 0.52;
    const current = attrs();
    const first = activeCreationAttributeDelta(current.batting.technique, 1, 78, scale);
    current.batting.technique += first;
    expect(Math.round(current.batting.technique * scale) - Math.round(CREATION.base * scale)).toBe(3);
    expect(allocatedActiveCreationPoints(current, scale)).toBe(3);
    const last = activeCreationAttributeDelta(current.batting.technique, 1, 1, scale);
    current.batting.technique += last;
    expect(allocatedActiveCreationPoints(current, scale)).toBe(4);
    current.batting.technique += activeCreationAttributeDelta(current.batting.technique, -1, 0, scale);
    expect(allocatedActiveCreationPoints(current, scale)).toBe(1);
  });
});
