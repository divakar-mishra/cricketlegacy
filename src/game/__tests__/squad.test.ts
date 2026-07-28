import { makeRng } from '../../engine/rng';
import { generateRoster } from '../../generation/players';
import { autoXI, resolveXI, validateXI, XI_SIZE } from '../squad';
import { Player } from '../../domain/types';

const roster = () =>
  generateRoster({ nationality: 'india', quality: 66, idPrefix: 't', rng: makeRng(3) });
const userAs = (role: Player['role']): Player => ({
  ...generateRoster({
    nationality: 'india',
    quality: 58,
    idPrefix: `u_${role}`,
    rng: makeRng(9),
  })[0],
  id: 'user',
  role,
  isUserPlayer: true,
});

describe('autoXI', () => {
  it('picks exactly 11 unique players including a keeper', () => {
    const xi = autoXI(roster());
    expect(xi).toHaveLength(XI_SIZE);
    expect(new Set(xi.map((p) => p.id)).size).toBe(XI_SIZE);
    expect(xi.some((p) => p.role === 'WK_BATTER')).toBe(true);
  });

  it('forces a specified player into the XI', () => {
    const r = roster();
    const worst = [...r].sort((a, b) => a.overall - b.overall)[0];
    const xi = autoXI(r, worst.id);
    expect(xi.map((p) => p.id)).toContain(worst.id);
  });

  it('orders specialist bowlers below the top order', () => {
    const xi = autoXI(roster());
    const firstBowler = xi.findIndex((p) => p.role === 'BOWLER');
    if (firstBowler >= 0) expect(firstBowler).toBeGreaterThan(0);
  });

  it('gives forced career players role-appropriate batting positions', () => {
    const base = roster();
    expect(
      autoXI([...base, userAs('BATTER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeLessThanOrEqual(3);
    expect(
      autoXI([...base, userAs('WK_BATTER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeGreaterThanOrEqual(3);
    expect(
      autoXI([...base, userAs('WK_BATTER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeLessThanOrEqual(5);
    expect(
      autoXI([...base, userAs('ALLROUNDER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeGreaterThanOrEqual(4);
    expect(
      autoXI([...base, userAs('ALLROUNDER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeLessThanOrEqual(6);
    expect(
      autoXI([...base, userAs('BOWLER')], 'user').findIndex((p) => p.id === 'user'),
    ).toBeGreaterThanOrEqual(7);
  });
});

describe('resolveXI', () => {
  it('uses a valid provided XI as-is', () => {
    const r = roster();
    const ids = autoXI(r).map((p) => p.id);
    expect(resolveXI(r, ids).map((p) => p.id)).toEqual(ids);
  });

  it('falls back to auto for an invalid XI', () => {
    const r = roster();
    expect(resolveXI(r, ['nope']).length).toBe(XI_SIZE);
    expect(resolveXI(r, undefined).length).toBe(XI_SIZE);
  });
});

describe('validateXI', () => {
  it('rejects invalid proposed swaps before they are persisted', () => {
    const r = roster();
    const ids = autoXI(r).map((p) => p.id);
    expect(validateXI(r, ids).ok).toBe(true);
    expect(validateXI(r, ids.slice(0, 10)).ok).toBe(false);
    expect(validateXI(r, [...ids.slice(0, 10), ids[0]]).ok).toBe(false);
    expect(validateXI(r, ids.filter((id) => id !== ids[0]), ids[0]).ok).toBe(false);
  });
});
