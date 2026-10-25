import { DEFAULT_AVATAR_CONFIGS } from '../../avatar';
import { FEMALE_FIRST_NAMES, namePoolFor } from '../../data/names';
import { SAVE_SCHEMA_VERSION, type SaveGame } from '../../domain/types';
import { makeRng } from '../../engine/rng';
import { generatePlayer } from '../../generation/players';
import { runMigrations } from '../../storage/migrate';
import { createCareerSave } from '../createGame';
import { refreshFreeAgents, rolloverSquads } from '../lifecycle';
import { playerWorldSex, synchronizePlayerIdentities } from '../playerIdentity';
import { ensureCareerPathTeam, ensureYouthTeams } from '../youthFixtures';
import { ensureNationalTeam } from '../intlCalendar';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

function makeFemaleCareer(age = 16): SaveGame {
  const base = makeCareerSave(66);
  return createCareerSave({
    player: { ...base.players[base.userPlayerId!], age, name: 'My Cricketer' },
    teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed: 66,
    now: Date.UTC(2026, 9, 24), avatarConfig: DEFAULT_AVATAR_CONFIGS.female,
  });
}

describe('female Player career roster identity', () => {
  it('generates female teammates, opponents, senior/national pools and free agents from creation', () => {
    const save = makeFemaleCareer();
    expect(save.players[save.userPlayerId!].sex).toBe('female');
    expect(save.players[save.userPlayerId!].name).toBe('My Cricketer');
    expect(save.careerPathTeamId).toBeDefined();
    expect(Object.values(save.players).length).toBeGreaterThan(500);
    for (const player of Object.values(save.players)) {
      expect(player.sex).toBe('female');
      if (player.id !== save.userPlayerId) expect(namePoolFor(player.nationality, 'female').first).toContain(player.name.split(' ')[0]);
    }
    // The fallback cannot silently reuse a known male-only pool.
    for (const country of Object.keys(FEMALE_FIRST_NAMES)) expect(namePoolFor(country, 'female').first).toBe(FEMALE_FIRST_NAMES[country]);
  });
  it('does not change ability, RNG consumption or role balance when choosing female identities', () => {
    const options = { id: 'qa', nationality: 'india', role: 'ALLROUNDER' as const, quality: 65 };
    const male = generatePlayer({ ...options, rng: makeRng(37), sex: 'male' });
    const female = generatePlayer({ ...options, rng: makeRng(37), sex: 'female' });
    const { name: _m, sex: _ms, ...maleCricket } = male;
    const { name: _f, sex: _fs, ...femaleCricket } = female;
    expect(femaleCricket).toEqual(maleCricket);
  });
  it('keeps later U19 cohorts, replacement nationals, recruits and transfer free agents female', () => {
    const save = makeFemaleCareer();
    ensureCareerPathTeam(save, 'U19');
    ensureYouthTeams(save, 'U19');
    for (const player of Object.values(save.players)) if (!player.isUserPlayer) player.age = 38;
    rolloverSquads(save, 2027, makeRng(10));
    refreshFreeAgents(save, 2027, makeRng(11));
    const newRecruits = Object.values(save.players).filter(p => /^y-2027|^fa-2027/.test(p.id));
    expect(newRecruits.length).toBeGreaterThan(0);
    expect(newRecruits.every(p => p.sex === 'female')).toBe(true);
    for (const p of Object.values(save.players)) if (p.nationality === 'ireland') p.retired = true;
    ensureNationalTeam(save, 'ireland');
    const refreshed = Object.values(save.players).filter(p => p.id.startsWith('national-refresh-ireland'));
    expect(refreshed.length).toBeGreaterThan(0);
    expect(refreshed.every(p => p.sex === 'female')).toBe(true);
    expect(Object.values(save.players).every(p => p.sex === 'female')).toBe(true);
  });
  it('repairs schema45 female careers once, preserving every non-identity player field and saved game', () => {
    const old = makeCareerSave(45);
    old.schemaVersion = 45;
    old.cosmetics!.avatarConfig = DEFAULT_AVATAR_CONFIGS.female;
    for (const p of Object.values(old.players)) delete p.sex;
    const before = JSON.parse(JSON.stringify(old)) as SaveGame;
    const migrated = runMigrations(JSON.parse(JSON.stringify(old)))!;
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.players[migrated.userPlayerId!].name).toBe(before.players[before.userPlayerId!].name);
    for (const p of Object.values(migrated.players)) {
      expect(p.sex).toBe('female');
      const { name: _name, sex: _sex, ...after } = p;
      const { name: _oldName, ...original } = before.players[p.id];
      expect(after).toEqual(original);
    }
    const { players: _ap, schemaVersion: _av, ...afterRest } = migrated;
    const { players: _bp, schemaVersion: _bv, ...beforeRest } = before;
    expect(afterRest).toEqual(beforeRest);
    const settled = JSON.stringify(migrated);
    synchronizePlayerIdentities(migrated);
    expect(JSON.stringify(migrated)).toBe(settled);
    expect(JSON.stringify(runMigrations(JSON.parse(settled)))).toBe(settled);
  });
  it('retains male/Manager names, and subsequent portrait edits do not switch an existing competition', () => {
    const manager = makeManagerSave(45);
    manager.schemaVersion = 45;
    const names = Object.values(manager.players).map(p => p.name);
    synchronizePlayerIdentities(manager);
    expect(Object.values(manager.players).map(p => p.name)).toEqual(names);
    expect(playerWorldSex(manager)).toBe('male');
    const female = makeFemaleCareer();
    female.cosmetics!.avatarConfig = DEFAULT_AVATAR_CONFIGS.male;
    expect(playerWorldSex(female)).toBe('female');
  });
});
