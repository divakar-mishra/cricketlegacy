import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AttributesGuidePopup } from '../AttributesGuidePopup';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
configureReactRenderEnvironment();
let mockFocused = true;
let mockQueue = true;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('react-native', () => ({
  View: 'View', Modal: 'Modal', ScrollView: 'ScrollView', Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));
jest.mock('../../context/ModalQueueContext', () => ({
  MODAL_PRIORITY: { prompt: 3 }, useModalQueue: (wants: boolean) => wants && mockQueue,
}));
jest.mock('../Button', () => ({ Button: 'Button' }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../../theme', () => ({
  fontSize: {}, fontWeight: {}, radius: {}, spacing: {}, useTheme: () => ({ colors: {} }),
}));
describe('single static attributes popup', () => {
  let tree: ReactTestRenderer;
  const close = jest.fn();
  beforeEach(() => { mockFocused = true; mockQueue = true; close.mockClear(); });
  afterEach(() => act(() => tree?.unmount()));
  const render = (visible = true) => act(() => { tree = create(createElement(AttributesGuidePopup, { visible, onClose: close })); });
  it('shows one explanation and one Got it action without animations, measurements or highlights', () => {
    render();
    expect(tree.root.findByType('Modal' as any).props.animationType).toBe('none');
    expect(tree.root.findAllByProps({ testID: 'attributes-guide-popup' })).toHaveLength(1);
    expect(tree.root.findByType('Button' as any).props.label).toBe('Got it');
    expect(tree.root.findAllByProps({ testID: 'guide-highlight' })).toHaveLength(0);
    expect(tree.root.findAllByType('View' as any).every(node => !node.props.onLayout)).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain('leave points unspent');
  });
  it.each(['Got it', 'backdrop', 'Android Back'])('dismisses using %s without a game action', via => {
    render();
    if (via === 'Got it') tree.root.findByType('Button' as any).props.onPress();
    else if (via === 'backdrop') tree.root.findByType('Pressable' as any).props.onPress();
    else tree.root.findByType('Modal' as any).props.onRequestClose();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it.each(['closed', 'background route', 'another modal'])('stays hidden for %s', reason => {
    mockFocused = reason !== 'background route';
    mockQueue = reason !== 'another modal';
    render(reason !== 'closed');
    expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
    expect(close).not.toHaveBeenCalled();
  });
});
