import { validateAvatarPack } from './avatar-pack-lib.mjs';

const { assets, presets } = validateAvatarPack();
console.log(`[avatar-pack] valid: ${assets.length} assets, ${presets.length} unique presets`);
