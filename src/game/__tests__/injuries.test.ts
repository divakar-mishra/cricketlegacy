import { Player } from '../../domain/types';
import { makeRng } from '../../engine/rng';
import { autoXI, XI_SIZE } from '../squad';
import { isAvailable, rollMatchInjury, tickInjuries } from '../injuries';
import { makeCareerSave } from './_depthHelpers';

function fitPlayer(id: string, overall = 60): Player {
  return {
    id,
    name: id,
    nationality: 'india',
    age: 24,
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: {
      technique: overall,
      timing: overall,
      power: overall,
      footwork: overall,
      temperament: overall,
      running: overall,
    },
    bowling: { paceOrSpin: 20, accuracy: 20, movement: 20, variations: 20, stamina: 40 },
    fielding: { catching: 55, throwing: 55, agility: 55, keeping: 30 },
    meta: { fitness: 30, form: 60, confidence: 60, aggression: 55, discipline: 60 },
    potential: overall,
    traits: [],
    overall,
  };
}

describe('injuries', () => {
  it('isAvailable reflects injury state', () => {
    const p = fitPlayer('p1');
    expect(isAvailable(p)).toBe(true);
    p.injury = { type: 'Knock', severity: 'KNOCK', matchesOut: 2 };
    expect(isAvailable(p)).toBe(false);
  });

  it('rollMatchInjury eventually injures a low-fitness player within a valid range', () => {
    const p = fitPlayer('p2'); // fitness 30 → higher base chance
    let injured = false;
    for (let i = 0; i < 200 && !injured; i++) {
      const inj = rollMatchInjury(p, 0, makeRng(1000 + i));
      if (inj) {
        injured = true;
        expect(inj.matchesOut).toBeGreaterThanOrEqual(1);
        expect(inj.matchesOut).toBeLessThanOrEqual(9);
      }
    }
    expect(injured).toBe(true);
  });

  it('accepts a 70 percent youth risk reduction without clamping it away', () => {
    const p = fitPlayer('p3');
    let normalInjuries = 0;
    let protectedInjuries = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollMatchInjury(p, 0, makeRng(5000 + i), 1)) normalInjuries++;
      if (rollMatchInjury(p, 0, makeRng(5000 + i), 0.3)) protectedInjuries++;
    }
    expect(protectedInjuries).toBeLessThan(normalInjuries * 0.5);
  });

  it('tickInjuries decrements and clears', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    user.injury = { type: 'Strain', severity: 'STRAIN', matchesOut: 2 };
    tickInjuries(save);
    expect(user.injury?.matchesOut).toBe(1);
    tickInjuries(save);
    expect(user.injury).toBeUndefined();
  });

  it('autoXI skips injured players when enough are fit, but never fields fewer than 11', () => {
    const squad = Array.from({ length: 14 }, (_, i) => fitPlayer(`s${i}`, 60 + (i % 5)));
    squad[0].injury = { type: 'Tear', severity: 'SERIOUS', matchesOut: 4 };
    const xi = autoXI(squad);
    expect(xi.length).toBe(XI_SIZE);
    expect(xi.some((p) => p.id === 's0')).toBe(false);

    // If almost everyone is injured, we still must field 11 (fallback).
    const thin = Array.from({ length: 11 }, (_, i) => fitPlayer(`t${i}`));
    thin.forEach((p) => (p.injury = { type: 'Knock', severity: 'KNOCK', matchesOut: 1 }));
    expect(autoXI(thin).length).toBe(XI_SIZE);
  });
});
