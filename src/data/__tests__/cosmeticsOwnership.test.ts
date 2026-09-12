import { KIT_COLORS, kitDesign, ownsCosmetic, ownsProfileFrame } from '../cosmetics';

describe('cosmetic bundle ownership', () => {
  it('unlocks standard kits without unlocking unclaimed Pass kits', () => {
    for (const kit of KIT_COLORS) {
      expect(ownsCosmetic({ kit_all_colors: 1 }, kit.id)).toBe(!kit.passExclusive);
    }
    expect(ownsCosmetic({ kit_all_colors: 1 }, 'celebration_unknown')).toBe(false);
  });

  it('accepts individually claimed kits', () => {
    const kit = KIT_COLORS.find((item) => item.passExclusive)!;
    expect(ownsCosmetic({ [kit.id]: 1 }, kit.id)).toBe(true);
    expect(ownsCosmetic({}, kit.id)).toBe(false);
  });

  it('connects each frame to its actual reward flag', () => {
    expect(ownsProfileFrame({}, 'frame_none')).toBe(true);
    expect(ownsProfileFrame({}, 'frame_gold')).toBe(false);
    expect(ownsProfileFrame({ avatar_legend_frame: 1 }, 'frame_gold')).toBe(true);
    expect(ownsProfileFrame({ pass_frame_gold: 1 }, 'frame_gold')).toBe(true);
    expect(ownsProfileFrame({ avatar_legend_vip: 1 }, 'frame_vip')).toBe(true);
    expect(ownsProfileFrame({ avatar_legend_frame: 1 }, 'frame_vip')).toBe(false);
    expect(ownsProfileFrame({}, 'unknown')).toBe(false);
  });

  it('provides several visible kit patterns with a safe fallback', () => {
    expect(new Set(KIT_COLORS.map((kit) => kitDesign(kit.id).pattern)).size).toBe(7);
    expect(kitDesign('unknown').pattern).toBe('classic');
  });
});
