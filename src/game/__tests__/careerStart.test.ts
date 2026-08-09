import { Role } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { stockMarketUnlocked } from '../readiness';

/**
 * Guarantees the player-creation bugs from the first playtest cannot recur on
 * ANY starting level: the on-screen OVR always equals the in-game OVR, the
 * youth/adult path level is assigned correctly, and the Stock Market stays
 * locked for youth pathways no matter which level the career began at.
 */

const ATTRS = {
  batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
  bowling: { paceOrSpin: 60, accuracy: 60, movement: 60, variations: 60, stamina: 60 },
  fielding: { catching: 58, throwing: 58, agility: 58, keeping: 45 },
  meta: { fitness: 60, confidence: 60, aggression: 55, discipline: 60 },
};

// Legacy/manual starting ages still need to map consistently even though the UI exposes only U14.
const STARTS = [
  { value: 'u14', age: 14, attrScale: 0.52, level: 'SCHOOL', stock: false },
  { value: 'u19', age: 17, attrScale: 0.74, level: 'U19', stock: false },
  { value: 'domestic', age: 20, attrScale: 1.0, level: 'DOMESTIC', stock: true },
] as const;

const ROLES: Role[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'];

function build(role: Role, s: (typeof STARTS)[number]) {
  return buildUserPlayer({
    name: 'Test',
    nationality: 'india',
    role,
    battingStyle: 'RHB',
    bowlingStyle: role === 'BOWLER' || role === 'ALLROUNDER' ? 'PACE' : undefined,
    ...ATTRS,
    age: s.age,
    attrScale: s.attrScale,
  });
}

describe('player creation is consistent across every start level', () => {
  it('keeps a School player out of the reserved Tier 3 senior roster', () => {
    const player = build('BATTER', STARTS[0]);
    const save = createCareerSave({
      player,
      teamId: 'mumbai_sharks',
      difficulty: 'NORMAL',
      seed: 41,
      format: 'T20',
    });

    expect(save.careerPathLevel).toBe('SCHOOL');
    expect(save.careerPathTeamId).toBeDefined();
    expect(save.careerPathTeamId).not.toBe(save.userTeamId);
    expect(save.teams[save.userTeamId!].playerIds).not.toContain(player.id);
    expect(save.teams[save.careerPathTeamId!].playerIds).toContain(player.id);
    expect(save.players[player.id].contract).toBeUndefined();
    expect(
      save.teams[save.careerPathTeamId!].playerIds
        .filter((id) => id !== player.id)
        .every((id) => save.players[id].age >= 14 && save.players[id].age <= 15),
    ).toBe(true);
    const youthFixtures = Object.values(save.fixtures).filter(
      (fixture) => fixture.competitionId === 'youth-u14',
    );
    expect(youthFixtures).toHaveLength(6);
    expect(
      youthFixtures.every(
        (fixture) =>
          fixture.homeTeamId === save.careerPathTeamId ||
          fixture.awayTeamId === save.careerPathTeamId,
      ),
    ).toBe(true);
    expect(
      save.playerCalendar?.events.filter(
        (event) => event.kind === 'MATCH' && event.fixtureId?.startsWith('youth-fx-'),
      ),
    ).toHaveLength(6);
  });

  it('buildUserPlayer is pure — identical inputs give identical OVR & potential', () => {
    for (const role of ROLES) {
      for (const s of STARTS) {
        const a = build(role, s);
        const b = build(role, s);
        expect(a.overall).toBe(b.overall);
        expect(a.potential).toBe(b.potential);
        expect(a.overall).toBeGreaterThan(0);
        expect(a.potential).toBeGreaterThanOrEqual(a.overall);
      }
    }
  });

  it('the OVR shown at creation equals the in-game OVR (save preserves it)', () => {
    for (const s of STARTS) {
      const player = build('ALLROUNDER', s);
      const save = createCareerSave({
        player,
        teamId: 'mumbai_sharks',
        difficulty: 'NORMAL',
        seed: 42,
        format: 'T20',
      });
      const inGame = save.players[save.userPlayerId!];
      expect(inGame.overall).toBe(player.overall);
      expect(inGame.potential).toBe(player.potential);
    }
  });

  it('assigns the correct youth/adult path level for each start age', () => {
    for (const s of STARTS) {
      const player = build('BATTER', s);
      const save = createCareerSave({
        player,
        teamId: 'mumbai_sharks',
        difficulty: 'NORMAL',
        seed: 7,
        format: 'T20',
      });
      expect(save.careerPathLevel).toBe(s.level);
    }
  });

  it('keeps the Stock Market locked for youth on every level', () => {
    for (const s of STARTS) {
      const player = build('BATTER', s);
      const save = createCareerSave({
        player,
        teamId: 'mumbai_sharks',
        difficulty: 'NORMAL',
        seed: 11,
        format: 'T20',
      });
      expect(stockMarketUnlocked(save.careerPathLevel, player.age)).toBe(s.stock);
    }
  });
});

describe('stockMarketUnlocked predicate', () => {
  it('requires both adulthood and a senior (non-youth) level', () => {
    expect(stockMarketUnlocked('SCHOOL', 14)).toBe(false);
    expect(stockMarketUnlocked('U19', 17)).toBe(false);
    expect(stockMarketUnlocked('U19', 25)).toBe(false); // still youth level
    expect(stockMarketUnlocked('DOMESTIC', 17)).toBe(false); // under 18
    expect(stockMarketUnlocked('DOMESTIC', 20)).toBe(true);
    expect(stockMarketUnlocked('INTERNATIONAL', 28)).toBe(true);
    expect(stockMarketUnlocked(undefined, 25)).toBe(true); // legacy save = adult domestic
  });
});
