import {
  defaultShirtName,
  defaultShirtNumber,
  normalizeShirtName,
  normalizeShirtNumber,
} from '../kitIdentity';

describe('kit identity', () => {
  it('uses the surname as the default back name and keeps it compact', () => {
    expect(defaultShirtName('Divakar Mishra')).toBe('MISHRA');
    expect(normalizeShirtName('  the   finisher  ')).toBe('THE FINISHER');
    expect(normalizeShirtName('', 'Ocean Sharma')).toBe('SHARMA');
    expect(normalizeShirtName('A very long shirt identity')).toHaveLength(14);
  });

  it('gives each player a stable 1-99 default and clamps edited numbers', () => {
    expect(defaultShirtNumber('player-one')).toBe(defaultShirtNumber('player-one'));
    expect(defaultShirtNumber('player-one')).toBeGreaterThanOrEqual(1);
    expect(defaultShirtNumber('player-one')).toBeLessThanOrEqual(99);
    expect(normalizeShirtNumber(0, 'player-one')).toBe(1);
    expect(normalizeShirtNumber(120, 'player-one')).toBe(99);
    expect(normalizeShirtNumber('23', 'player-one')).toBe(23);
  });
});
