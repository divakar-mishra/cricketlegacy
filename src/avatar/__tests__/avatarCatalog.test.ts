import {
  avatarAssetMetadata,
  avatarAssetSources,
  avatarFromLegacy,
  avatarFromPreset,
  avatarPresets,
  avatarPresetsForSex,
  DEFAULT_AVATAR_CONFIG,
  isValidAvatarConfig,
  normalizeAvatarConfig,
  randomAvatarConfig,
  resolveAvatarLayers,
  switchAvatarRig,
  switchAvatarSex,
} from '..';
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

describe('supplied modular avatar catalog', () => {
  it('registers exactly 186 explicit runtime assets and 300 supplied presets', () => {
    expect(avatarAssetMetadata).toHaveLength(186);
    expect(Object.keys(avatarAssetSources)).toHaveLength(186);
    expect(avatarPresets).toHaveLength(300);
    expect(avatarPresetsForSex('male')).toHaveLength(150);
    expect(avatarPresetsForSex('female')).toHaveLength(150);
    expect(new Set(avatarAssetMetadata.map((asset) => asset.id)).size).toBe(186);
    expect(new Set(avatarPresets.map((preset) => preset.id)).size).toBe(300);
  });

  it('resolves every supplied preset to a valid configuration without changing its recipe', () => {
    for (const preset of avatarPresets) {
      const resolved = avatarFromPreset(preset);
      expect(isValidAvatarConfig(resolved)).toBe(true);
      expect(resolved).toEqual({
        sex: preset.sex,
        rigId: preset.rigId,
        baseFaceId: preset.baseFaceId,
        eyeColorId: preset.eyeColorId,
        hairBackId: preset.hairBackId,
        hairFrontId: preset.hairFrontId,
        beardId: preset.beardId,
        moustacheId: preset.moustacheId,
        headwearId: preset.headwearId,
        outfitId: preset.outfitId,
      });
    }
  });

  it('keeps randomization and rig/sex changes compatible', () => {
    for (let index = 0; index < 300; index += 1) {
      const random = () => index / 300;
      expect(isValidAvatarConfig(randomAvatarConfig(index % 2 ? 'male' : 'female', random))).toBe(
        true,
      );
    }
    for (const rig of ['narrow', 'medium', 'wide'] as const) {
      expect(isValidAvatarConfig(switchAvatarRig(DEFAULT_AVATAR_CONFIG, rig))).toBe(true);
    }
    const female = switchAvatarSex(DEFAULT_AVATAR_CONFIG, 'female');
    expect(isValidAvatarConfig(female)).toBe(true);
    expect(female.beardId).toBe('beard_none');
    expect(female.moustacheId).toBe('moustache_none');
  });

  it('falls back from invalid saved IDs and hides hair under headwear without erasing it', () => {
    const invalid = normalizeAvatarConfig({
      ...DEFAULT_AVATAR_CONFIG,
      baseFaceId: 'missing-base',
      hairFrontId: 'missing-hair',
    });
    expect(isValidAvatarConfig(invalid)).toBe(true);

    const helmet = normalizeAvatarConfig({
      ...DEFAULT_AVATAR_CONFIG,
      headwearId: 'headwear_medium_batting_helmet',
    });
    const storedHair = [helmet.hairBackId, helmet.hairFrontId];
    const layers = resolveAvatarLayers(helmet);
    expect(layers.hairBack).toBeUndefined();
    expect(layers.hairFront).toBeUndefined();
    expect([helmet.hairBackId, helmet.hairFrontId]).toEqual(storedHair);
    expect(layers.headwear).toBe('headwear_medium_batting_helmet');
  });

  it('maps the former SVG controls to a valid modular avatar', () => {
    const migrated = avatarFromLegacy(
      {
        skinTone: '#8C5439',
        faceShape: 'angular',
        hairStyle: 'crop',
        hairColor: '#17130F',
        facialHair: 'full_beard',
        moustache: 'handlebar',
        eyeColor: '#314E63',
        browStyle: 'bold',
      },
      'kit_red',
      'frame_gold',
    );
    expect(isValidAvatarConfig(migrated)).toBe(true);
    expect(migrated.rigId).toBe('narrow');
    expect(migrated.outfitId).toBe('outfit_red');
    expect(migrated.frameId).toBe('frame_gold');
  });

  it('migrates schema 29 without altering unrelated career data and survives JSON reload', () => {
    const save = makeCareer();
    save.schemaVersion = 29;
    save.wallet.coins = 12_345;
    save.flags = { ...save.flags, avatarMigrationSentinel: true };
    if (!save.cosmetics) throw new Error('Expected career cosmetics');
    save.cosmetics.avatarCustomization = {
      skinTone: '#DFA477',
      faceShape: 'round',
      hairStyle: 'swept',
      hairColor: '#17130F',
      facialHair: 'stubble',
      moustache: 'classic',
      eyeColor: '#3E5638',
      browStyle: 'straight',
    };
    delete save.cosmetics.avatarConfig;
    const playerCount = Object.keys(save.players).length;

    const migrated = runMigrations(JSON.parse(JSON.stringify(save)));
    expect(migrated?.schemaVersion).toBe(30);
    expect(migrated?.wallet.coins).toBe(12_345);
    expect(migrated?.flags?.avatarMigrationSentinel).toBe(true);
    expect(Object.keys(migrated?.players ?? {})).toHaveLength(playerCount);
    expect(migrated?.cosmetics?.avatarCustomization).toEqual(save.cosmetics.avatarCustomization);
    expect(isValidAvatarConfig(migrated!.cosmetics!.avatarConfig!)).toBe(true);

    const reopened = JSON.parse(JSON.stringify(migrated));
    expect(reopened.cosmetics.avatarConfig).toEqual(migrated?.cosmetics?.avatarConfig);
  });
});
