import { ManagedTimerRegistry } from '../useManagedTimers';

describe('ManagedTimerRegistry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('replaces delayed work registered under the same key', () => {
    const registry = new ManagedTimerRegistry();
    const first = jest.fn();
    const second = jest.fn();
    registry.schedule('banner', first, 100);
    registry.schedule('banner', second, 100);

    jest.advanceTimersByTime(100);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clears timeouts and intervals during cleanup', () => {
    const registry = new ManagedTimerRegistry();
    const delayed = jest.fn();
    const repeating = jest.fn();
    registry.schedule('delayed', delayed, 100);
    registry.repeat('repeating', repeating, 25);
    registry.clearAll();

    jest.advanceTimersByTime(200);
    expect(delayed).not.toHaveBeenCalled();
    expect(repeating).not.toHaveBeenCalled();
  });
});
