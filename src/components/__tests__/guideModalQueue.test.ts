import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ModalQueueProvider, useModalQueue } from '../../context/ModalQueueContext';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
configureReactRenderEnvironment();
function Scene({ critical, native = false }: { critical: boolean; native?: boolean }) {
  const coach = useModalQueue(true, 3, 'coach', !native);
  const dialog = useModalQueue(critical, 1, 'consent');
  return createElement('State', { coach, dialog });
}
describe('non-modal coach priority', () => {
  let tree: ReactTestRenderer;
  const element = (critical: boolean, native = false) =>
    createElement(ModalQueueProvider, null, createElement(Scene, { critical, native }));
  afterEach(() => {
    act(() => tree?.unmount());
    jest.useRealTimers();
  });
  it('yields to critical dialogs and resumes the same guide after they close', () => {
    jest.useFakeTimers();
    act(() => {
      tree = create(element(false));
    });
    expect(tree.root.findByType('State' as any).props).toMatchObject({
      coach: true,
      dialog: false,
    });
    act(() => tree.update(element(true)));
    expect(tree.root.findByType('State' as any).props).toMatchObject({
      coach: false,
      dialog: true,
    });
    act(() => tree.update(element(false)));
    act(() => jest.runAllTimers());
    expect(tree.root.findByType('State' as any).props).toMatchObject({
      coach: true,
      dialog: false,
    });
  });
  it('does not preempt an ordinary already-open native modal', () => {
    act(() => {
      tree = create(element(false, true));
    });
    act(() => tree.update(element(true, true)));
    expect(tree.root.findByType('State' as any).props).toMatchObject({
      coach: true,
      dialog: false,
    });
  });
});
