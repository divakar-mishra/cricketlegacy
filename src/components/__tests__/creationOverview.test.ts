import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CreationOverview, type CreationChapter } from '../CreationOverview';
import { CAREER_GUIDES } from '../../content/careerGuides';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
jest.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../../theme', () => ({
  fontSize: {}, fontWeight: {}, radius: {}, spacing: {}, useTheme: () => ({ colors: {} }),
}));

describe('compact creation overviews', () => {
  let tree: ReactTestRenderer;
  const page = (chapter: CreationChapter) => createElement(CreationOverview, { key: chapter, chapter });
  afterEach(() => act(() => tree?.unmount()));
  it.each(['manager.creation'] as const)(
    'shows one concise, inline, collapsible explanation for %s', chapter => {
      act(() => { tree = create(page(chapter)); });
      expect(tree.root.findAllByProps({ testID: 'creation-overview' })).toHaveLength(1);
      expect(JSON.stringify(tree.toJSON())).toContain(CAREER_GUIDES[chapter][0].body);
      expect(tree.root.findAllByProps({ testID: 'career-guide' })).toHaveLength(0);
      const toggle = () => tree.root.findByType('Pressable' as any);
      expect(toggle().props.accessibilityState.expanded).toBe(true);
      act(() => toggle().props.onPress());
      expect(JSON.stringify(tree.toJSON())).not.toContain(CAREER_GUIDES[chapter][0].body);
      expect(toggle().props.accessibilityState.expanded).toBe(false);
      act(() => toggle().props.onPress());
      expect(JSON.stringify(tree.toJSON())).toContain(CAREER_GUIDES[chapter][0].body);
    },
  );
  it('opens the overview in a new Manager form even if the previous one was collapsed', () => {
    act(() => { tree = create(page('manager.creation')); });
    act(() => tree.root.findByType('Pressable' as any).props.onPress());
    act(() => tree.update(createElement(CreationOverview, { key: 'new-form', chapter: 'manager.creation' })));
    expect(JSON.stringify(tree.toJSON())).toContain(CAREER_GUIDES['manager.creation'][0].body);
    expect(tree.root.findByType('Pressable' as any).props.accessibilityState.expanded).toBe(true);
  });
});
