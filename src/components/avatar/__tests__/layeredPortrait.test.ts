import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { PortraitAvatar } from '../PortraitAvatar';
import { layeredPortraitArtwork, LAYERED_PORTRAIT_LAYOUT, kitBackArtwork } from '../../../avatar/layeredPortraits';
import { kitBacks } from '../../../avatar/generated/kitBackAssets.generated';
import { ProfileFrame } from '../ProfileFrame';
import { layeredHeads, layeredJerseys, kitThumbnails } from '../../../avatar/generated/layeredAssets.generated';
import { portraitAssetMetadata } from '../../../avatar/generated/portraitAssets.generated';
import { KIT_COLORS } from '../../../data/cosmetics';

const PNG = createRequire(__filename)('pngjs').PNG as {
  sync: { read: (input: Buffer) => { width: number; height: number; data: Buffer } };
};

jest.mock('react-native', () => ({
  Image: 'Image', View: 'View',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', G: 'G',
  LinearGradient: 'LinearGradient', Path: 'Path', Stop: 'Stop',
}));

describe('layered portrait catalogue', () => {
  let warning: jest.SpyInstance;
  beforeAll(() => { warning = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterAll(() => warning.mockRestore());

  it.each([40, 64, 96, 128])('keeps head and jersey registered when swapping kits at %ipx', (size) => {
    let tree!: ReactTestRenderer;
    act(() => { tree = create(createElement(PortraitAvatar, { size, kitId: 'kit_blue', config: { portraitId: 'portrait_male_001', sex: 'male' } })); });
    const images = () => tree.root.findAll(node => String(node.type) === 'Image');
    expect(images()).toHaveLength(2);
    expect(images()[0].props.testID).toBe('portrait-jersey-layer');
    expect(images()[1].props.testID).toBe('portrait-head-layer');
    const originalHead = images()[1].props.source;
    expect(images()[0].props.style).toEqual(images()[1].props.style);
    expect(images()[0].props.style.height).toBe(size * LAYERED_PORTRAIT_LAYOUT.height);
    act(() => { tree.update(createElement(PortraitAvatar, { size, kitId: 'pass_kit_noir', config: { portraitId: 'portrait_male_001', sex: 'male' } })); });
    expect(images()[1].props.source).toBe(originalHead);
    act(() => tree.unmount());
  });

  it.each(['portrait_female_999', 'portrait_male_999', 'unknown', 'toString'])('does not replace unsupported identity %s', id => {
    expect(layeredPortraitArtwork(id, 'kit_blue')).toBeUndefined();
  });
  it.each([undefined, 'unknown-kit', 'toString'])('does not invent artwork for kit %s', kit => {
    expect(layeredPortraitArtwork('portrait_male_001', kit)).toBeUndefined();
  });
  it('covers every registered portrait and every standard and Pass kit', () => {
    expect(Object.keys(layeredHeads).sort()).toEqual(portraitAssetMetadata.map(p => p.id).sort());
    expect(Object.keys(layeredJerseys).sort()).toEqual(KIT_COLORS.map(k => k.id).sort());
    expect(Object.keys(kitThumbnails).sort()).toEqual(Object.keys(layeredJerseys).sort());
    expect(Object.keys(kitBacks).sort()).toEqual(KIT_COLORS.map(k=>k.id).sort());
    expect(kitBackArtwork('unknown')).toBeUndefined();
    expect(kitBackArtwork('toString')).toBeUndefined();
    expect(kitBackArtwork()).toBeUndefined();
    for(const kit of KIT_COLORS) expect(kitBackArtwork(kit.id)).toBe(kitBacks[kit.id]);
    for (const portrait of portraitAssetMetadata) {
      for (const kit of KIT_COLORS) {
        expect(layeredPortraitArtwork(portrait.id, kit.id)).toEqual({ head: layeredHeads[portrait.id], jersey: layeredJerseys[kit.id] });
      }
    }
  });
  it('packages unique portrait and kit files with actual transparent and opaque pixels', () => {
    for (const [folder, ids] of [['heads', Object.keys(layeredHeads)], ['jerseys', Object.keys(layeredJerseys)], ['backs', Object.keys(kitBacks)]] as const) {
      const hashes = new Set<string>();
      for (const id of ids) {
        const input = fs.readFileSync(path.resolve(__dirname, '../../../..', 'assets/avatar/layered', folder, id + '.png'));
        hashes.add(createHash('sha256').update(input).digest('hex'));
        const png = PNG.sync.read(input);
        expect([png.width, png.height]).toEqual([folder === 'backs' ? 512 : 384, 512]);
        let transparent = 0, opaque = 0;
        for (let i = 3; i < png.data.length; i += 4) {
          if (png.data[i] === 0) transparent++;
          if (png.data[i] > 240) opaque++;
        }
        expect(transparent).toBeGreaterThan(1000);
        expect(opaque).toBeGreaterThan(1000);
      }
      expect(hashes.size).toBe(ids.length);
    }
  });
  it.each([40, 52, 64, 128])('gives Legend engraved geometry and VIP segmented geometry at %ipx', size => {
    let tree!:ReactTestRenderer;
    act(()=>{tree=create(createElement(ProfileFrame,{size,frameId:'frame_gold'}));});
    expect(tree.root.findAll(n=>String(n.type)==='Path')).toHaveLength((size<64?12:32)+2);
    expect(tree.root.findAll(n=>String(n.type)==='Svg')[0].props.testID).toBe('legend-engraved-frame');
    act(()=>tree.update(createElement(ProfileFrame,{size,frameId:'frame_vip'})));
    expect(tree.root.findAll(n=>String(n.type)==='Path')).toHaveLength(1);
    expect(tree.root.findAll(n=>String(n.type)==='Circle').some(n=>n.props.strokeDasharray==='52 18')).toBe(true);
    act(()=>tree.unmount());
  });
  it('ships RGBA PNGs with the expected dimensions and distinct jerseys', () => {
    const asset = (name: string) => fs.readFileSync(path.resolve(__dirname, '../../../..', 'assets/avatar/layered', name + '.png'));
    for (const name of ['male-001-head', 'navy-chevron', 'noir-sash']) {
      const png = asset(name);
      expect(png.readUInt32BE(16)).toBe(384);
      expect(png.readUInt32BE(20)).toBe(512);
      expect(png[25]).toBe(6); // PNG colour type: RGB + alpha.
    }
    expect(asset('navy-chevron').equals(asset('noir-sash'))).toBe(false);
  });
});
