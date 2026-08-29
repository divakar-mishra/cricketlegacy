import {
  avatarFromSeed,
  DEFAULT_AVATAR_CONFIG,
  isValidAvatarConfig,
  normalizeAvatarConfig,
  portraitAssetMetadata,
  portraitAssetSources,
  portraitsForSex,
  portraitsForTone,
  portraitToneBand,
  randomAvatarConfig,
  switchAvatarSex,
} from '..';
import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../../game/createGame';
import { runMigrations } from '../../storage/migrate';

function makeCareer() {
  const player = buildUserPlayer({
    name: 'Avatar Test',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 55, timing: 55, power: 55, footwork: 55, temperament: 55, running: 55 },
    bowling: { paceOrSpin: 55, accuracy: 55, movement: 55, variations: 55, stamina: 55 },
    fielding: { catching: 55, throwing: 55, agility: 55, keeping: 25 },
    meta: { fitness: 60, confidence: 60, aggression: 60, discipline: 60 },
    age: 18,
  });
  return createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 3030,
  });
}

describe('fixed portrait avatar catalog', () => {
  it('registers 64 male and 64 female portraits across eight balanced tone bands', () => {
    expect(portraitAssetMetadata).toHaveLength(128);
    expect(Object.keys(portraitAssetSources)).toHaveLength(128);
    expect(new Set(portraitAssetMetadata.map((portrait) => portrait.id)).size).toBe(128);

    for (const sex of ['male', 'female'] as const) {
      expect(portraitsForSex(sex)).toHaveLength(64);
      for (const toneBand of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
        expect(portraitsForTone(sex, toneBand)).toHaveLength(8);
      }
    }
  });

  it('normalizes unknown IDs to an offline-safe default', () => {
    expect(isValidAvatarConfig(DEFAULT_AVATAR_CONFIG)).toBe(true);
    expect(normalizeAvatarConfig({ sex: 'female', portraitId: 'missing' })).toEqual({
      sex: 'female',
      portraitId: 'portrait_female_025',
    });
  });

  it('keeps the same numbered identity when switching sex and randomizes across all 64', () => {
    const male = normalizeAvatarConfig({ sex: 'male', portraitId: 'portrait_male_047' });
    expect(switchAvatarSex(male, 'female')).toEqual({
      sex: 'female',
      portraitId: 'portrait_female_047',
    });

    const ids = new Set<string>();
    for (let index = 0; index < 64; index += 1) {
      const config = randomAvatarConfig('male', () => (index + 0.25) / 64);
      expect(isValidAvatarConfig(config)).toBe(true);
      ids.add(config.portraitId);
    }
    expect(ids.size).toBe(64);
  });

  it('assigns deterministic player-age portraits to generated squad players', () => {
    const first = avatarFromSeed('Aarav Sharma');
    const second = avatarFromSeed('Aarav Sharma');
    expect(first).toEqual(second);
    const index = Number(first.portraitId.slice(-3));
    expect((index - 1) % 8).toBeLessThan(6);
  });

  it('maps the former SVG controls deterministically and retains the profile frame', () => {
    const legacy = {
      skinTone: '#8C5439',
      faceShape: 'angular' as const,
      hairStyle: 'crop' as const,
      hairColor: '#17130F',
      facialHair: 'full_beard' as const,
      moustache: 'handlebar' as const,
      eyeColor: '#314E63',
      browStyle: 'bold' as const,
    };
    const first = normalizeAvatarConfig({ ...legacy, frameId: 'frame_gold' });
    const second = normalizeAvatarConfig({ ...legacy, frameId: 'frame_gold' });

    expect(first).toEqual(second);
    expect(isValidAvatarConfig(first)).toBe(true);
    expect(portraitToneBand(first)).toBe(8);
    expect(first.frameId).toBe('frame_gold');
  });

  it('migrates a schema-31 modular recipe once without altering unrelated career data', () => {
    const save = makeCareer();
    save.schemaVersion = 31;
    save.wallet.coins = 12_345;
    save.flags = { ...save.flags, avatarMigrationSentinel: true };
    if (!save.cosmetics) throw new Error('Expected career cosmetics');
    save.cosmetics.profileFrame = 'frame_gold';
    save.cosmetics.avatarConfig = {
      sex: 'female',
      rigId: 'wide',
      baseFaceId: 'base_female_wide_medium',
      eyeColorId: 'eyes_female_wide_brown',
      hairBackId: 'hair_female_wide_braid_back',
      hairFrontId: 'hair_female_wide_braid_front',
      beardId: 'beard_none',
      moustacheId: 'moustache_none',
      headwearId: 'headwear_none',
      outfitId: 'outfit_white',
    } as unknown as typeof save.cosmetics.avatarConfig;
    const playerCount = Object.keys(save.players).length;

    const migrated = runMigrations(JSON.parse(JSON.stringify(save)));
    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.wallet.coins).toBe(12_345);
    expect(migrated?.flags?.avatarMigrationSentinel).toBe(true);
    expect(Object.keys(migrated?.players ?? {})).toHaveLength(playerCount);
    expect(
      (migrated?.cosmetics as { avatarCustomization?: unknown } | undefined)?.avatarCustomization,
    ).toBeUndefined();
    expect(migrated?.cosmetics?.avatarConfig).toEqual(
      expect.objectContaining({ sex: 'female', frameId: 'frame_gold' }),
    );
    expect(isValidAvatarConfig(migrated!.cosmetics!.avatarConfig!)).toBe(true);

    const reopened = runMigrations(JSON.parse(JSON.stringify(migrated)));
    expect(reopened?.cosmetics?.avatarConfig).toEqual(migrated?.cosmetics?.avatarConfig);
  });

  it('still upgrades schema-29 saves that only contain the legacy customization recipe', () => {
    const save = makeCareer();
    save.schemaVersion = 29;
    if (!save.cosmetics) throw new Error('Expected career cosmetics');
    delete save.cosmetics.avatarConfig;
    (
      save.cosmetics as unknown as { avatarCustomization: Record<string, unknown> }
    ).avatarCustomization = {
      skinTone: '#DFA477',
      faceShape: 'round',
      hairStyle: 'swept',
      hairColor: '#17130F',
      facialHair: 'stubble',
      moustache: 'classic',
      eyeColor: '#3E5638',
      browStyle: 'straight',
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(save)));
    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(isValidAvatarConfig(migrated!.cosmetics!.avatarConfig!)).toBe(true);
    expect(portraitToneBand(migrated!.cosmetics!.avatarConfig!)).toBe(4);
    expect(
      (migrated?.cosmetics as { avatarCustomization?: unknown } | undefined)?.avatarCustomization,
    ).toBeUndefined();
  });
});
