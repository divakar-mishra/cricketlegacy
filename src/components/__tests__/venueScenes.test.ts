import { createElement } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { GroundDevelopment } from '../GroundDevelopment';
import { GroundScene } from '../GroundScene';
import { FacilityScene } from '../FacilityScene';
import type { FacilityKind } from '../venueVisuals';
import { VenueIllustration } from '../VenueIllustration';
import { academyArtwork, facilityArtwork, groundArtwork } from '../venueArtwork';

jest.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Image: 'Image',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../../theme', () => {
  const colors = {
    text: '#EDE8D8',
    textMuted: '#A8B5B3',
    border: '#334448',
    borderStrong: '#4A6266',
    accent: '#CCAE72',
    accentLight: '#E9CC87',
    surface: '#131B24',
    bgElevated: '#202A35',
    success: '#55B68D',
  };
  return {
    useColors: () => colors,
    useThemedStyles: (make: (colors: unknown) => unknown) => make(colors),
    fontSize: { xs: 11, sm: 13, md: 15, xl: 22 },
    fontWeight: { heavy: '800' },
    radius: { sm: 8, lg: 20 },
    spacing: { xs: 4, sm: 8, md: 16 },
  };
});
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'svg',
  Circle: 'circle',
  Ellipse: 'ellipse',
  G: 'g',
  Line: 'line',
  Path: 'path',
  Rect: 'rect',
  Text: 'text',
}));

// Optional contact sheet from the actual component trees; no native build required.
const previews: string[] = [];
function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
function serialize(node: ReturnType<ReactTestRenderer['toJSON']>): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(serialize).join('');
  const props = Object.entries(node.props)
    .filter(([key]) => key !== 'children')
    .map(
      ([key, value]) =>
        `${key === 'viewBox' ? key : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}="${escape(String(value))}"`,
    )
    .join(' ');
  return `<${node.type} ${props}>${(node.children ?? []).map((child) => (typeof child === 'string' ? escape(child) : serialize(child))).join('')}</${node.type}>`;
}

function svgMarkup(node: ReturnType<ReactTestRenderer['toJSON']>): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(svgMarkup).join('');
  if (String(node.props.testID ?? '').startsWith('venue-art-')) {
    const id = node.props.testID.replace('venue-art-', '');
    if (!process.env.VENUE_CONTACT_SHEET) return `<image id="${id}"/>`;
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const bytes = fs.readFileSync(path.join(__dirname, '../../../assets/venues', `${id}.webp`));
    return `<svg viewBox="0 0 360 240"><image width="360" height="240" href="data:image/webp;base64,${bytes.toString('base64')}"/></svg>`;
  }
  if (node.type === 'svg') return serialize(node);
  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? '' : svgMarkup(child)))
    .join('');
}

let consoleSpy: jest.SpyInstance;
const originalActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT;

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const originalError = console.error;
  consoleSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    // Keep all actual render warnings visible; this installed renderer is deprecated.
    if (String(args[0]).startsWith('react-test-renderer is deprecated.')) return;
    originalError(...args);
  });
});

describe('ground and facility scenes', () => {
  it('previews one track without altering the other, and returns to current', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(createElement(GroundDevelopment, { capacityLevel: 2, experienceLevel: 3 }));
    });
    const preview = tree.root.find(
      (node) => node.props.accessibilityLabel === 'Preview capacity level 5, Not built',
    );
    act(() => preview.props.onPress());
    expect(tree.root.findByType(GroundScene).props).toMatchObject({
      capacityLevel: 5,
      experienceLevel: 3,
    });
    expect(JSON.stringify(tree.toJSON())).toContain('LEVEL PREVIEW');
    const reset = tree.root
      .findAll((node) => String(node.type) === 'Pressable' && node.props.onPress)
      .at(-1)!;
    act(() => reset.props.onPress());
    expect(tree.root.findByType(GroundScene).props).toMatchObject({
      capacityLevel: 2,
      experienceLevel: 3,
    });
    act(() =>
      tree.update(createElement(GroundDevelopment, { capacityLevel: 3, experienceLevel: 3 })),
    );
    expect(tree.root.findByType(GroundScene).props.capacityLevel).toBe(3);
    const matchdayTab = tree.root.findAll(
      (node) => String(node.type) === 'Pressable' && node.props.accessibilityState,
    )[1];
    act(() => matchdayTab.props.onPress());
    expect(tree.root.findByType(GroundScene).props).toMatchObject({
      track: 'experience',
      capacityLevel: 3,
      experienceLevel: 3,
    });
    act(() =>
      tree.root
        .find((node) => node.props.accessibilityLabel === 'Preview experience level 5, Not built')
        .props.onPress(),
    );
    expect(tree.root.findByType(GroundScene).props).toMatchObject({
      track: 'experience',
      capacityLevel: 3,
      experienceLevel: 5,
    });
    act(() => tree.unmount());
  });

  it.each(['capacity', 'experience'] as const)('renders all five %s appearances', (track) => {
    const renders: string[] = [];
    for (let level = 1; level <= 5; level++) {
      let tree!: ReactTestRenderer;
      act(() => {
        tree = create(
          createElement(GroundScene, {
            track,
            capacityLevel: track === 'capacity' ? level : 3,
            experienceLevel: track === 'experience' ? level : 1,
          }),
        );
      });
      expect(tree.root.findByType(VenueIllustration).props.art.id).toBe(`${track}-${level}`);
      expect(tree.root.find((node) => String(node.type) === 'Image').props.resizeMode).toBe(
        'contain',
      );
      renders.push(svgMarkup(tree.toJSON()));
      act(() => tree.unmount());
    }
    expect(new Set(renders).size).toBe(5);
    previews.push(...renders);
  });

  it.each<FacilityKind>(['academy', 'training', 'medical'])(
    'renders five distinct %s stages with accessible labels',
    (kind) => {
      const renders: string[] = [];
      for (let level = 1; level <= 5; level++) {
        let tree!: ReactTestRenderer;
        act(() => {
          tree = create(createElement(FacilityScene, { kind, level }));
        });
        expect(
          tree.root.find((node) => node.props.accessibilityRole === 'image').props
            .accessibilityLabel,
        ).toContain(`Level ${level}`);
        expect(tree.root.findByType(VenueIllustration).props.art.id).toBe(`${kind}-${level}`);
        expect(tree.root.findByType(VenueIllustration).props.art.source).toBe(
          facilityArtwork(kind, level).source,
        );
        renders.push(svgMarkup(tree.toJSON()));
        act(() => tree.unmount());
      }
      expect(new Set(renders).size).toBe(5);
      previews.push(...renders);
    },
  );

  it('keeps each illustrated track independent for all 25 mixed-level grounds', () => {
    for (let capacityLevel = 1; capacityLevel <= 5; capacityLevel++) {
      for (let experienceLevel = 1; experienceLevel <= 5; experienceLevel++) {
        for (const track of ['capacity', 'experience'] as const) {
          let tree!: ReactTestRenderer;
          act(() => {
            tree = create(createElement(GroundScene, { capacityLevel, experienceLevel, track }));
          });
          expect(tree.root.findByType(VenueIllustration).props.art.id).toBe(
            `${track}-${track === 'capacity' ? capacityLevel : experienceLevel}`,
          );
          act(() => tree.unmount());
        }
      }
    }
  });

  it('preserves personal academy tier labels rather than showing manager levels', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        createElement(FacilityScene, { kind: 'academy', level: 3, levelLabel: 'TIER 2' }),
      );
    });
    expect(tree.root.findByType(VenueIllustration).props.art.id).toBe('academy-3');
    expect(tree.root.findByType(VenueIllustration).props.label).toContain('TIER 2');
    expect(JSON.stringify(tree.toJSON())).not.toContain('LEVEL 3');
    act(() => tree.unmount());
  });

  it('handles image errors without hiding controls or poisoning another level', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        createElement(VenueIllustration, { art: academyArtwork(1), label: 'Academy level 1' }),
      );
    });
    const staleError = tree.root.find((node) => String(node.type) === 'Image').props.onError;
    act(() => staleError());
    expect(JSON.stringify(tree.toJSON())).toContain('Illustration unavailable');
    act(() =>
      tree.update(
        createElement(VenueIllustration, { art: academyArtwork(2), label: 'Academy level 2' }),
      ),
    );
    act(() => staleError());
    expect(tree.root.findAll((node) => String(node.type) === 'Image')).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain('Illustration unavailable');
    act(() => tree.unmount());
  });

  it('clamps invalid levels and includes every offline artwork file', () => {
    expect(groundArtwork('capacity', NaN).id).toBe('capacity-1');
    expect(groundArtwork('experience', 90).id).toBe('experience-5');
    expect(academyArtwork(-5).id).toBe('academy-1');
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    expect(facilityArtwork('training', Infinity).id).toBe('training-1');
    expect(facilityArtwork('medical', 100).id).toBe('medical-5');
    for (const kind of ['capacity', 'experience', 'academy', 'training', 'medical']) {
      for (let level = 1; level <= 5; level++) {
        const file = fs.readFileSync(
          path.join(__dirname, '../../../assets/venues', `${kind}-${level}.webp`),
        );
        expect(file.subarray(8, 12).toString()).toBe('WEBP');
        expect(file.length).toBeLessThan(180_000);
      }
    }
  });
});

afterAll(() => {
  consoleSpy.mockRestore();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    originalActEnvironment;
  if (!process.env.VENUE_CONTACT_SHEET) return;
  const fs = require('fs') as typeof import('fs');
  const labels = ['STANDS', 'MATCHDAY', 'ACADEMY', 'TRAINING', 'MEDICAL'];
  const cells = previews
    .map(
      (svg, index) =>
        `<g transform="translate(${(index % 5) * 360} ${Math.floor(index / 5) * 250})"><text x="12" y="22" fill="#eee4cb" font-size="14">${labels[Math.floor(index / 5)]} · LEVEL ${(index % 5) + 1}</text>${svg.replace('<svg ', '<svg y="30" width="360" height="212" ').replace('width="100%" height="100%"', '')}</g>`,
    )
    .join('');
  fs.writeFileSync(
    process.env.VENUE_CONTACT_SHEET,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1250"><rect width="1800" height="1250" fill="#111923"/>${cells}</svg>`,
  );
});
