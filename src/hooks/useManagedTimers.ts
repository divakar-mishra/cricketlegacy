import { useEffect, useRef } from 'react';

export type ManagedTimerKey = string | symbol;

/**
 * Owns delayed UI work so replacing a banner or leaving a screen cannot leave
 * callbacks running against an unmounted tree.
 */
export class ManagedTimerRegistry {
  private timeouts = new Map<ManagedTimerKey, ReturnType<typeof setTimeout>>();
  private intervals = new Map<ManagedTimerKey, ReturnType<typeof setInterval>>();

  schedule = (key: ManagedTimerKey, callback: () => void, delayMs: number): void => {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timeouts.delete(key);
      callback();
    }, delayMs);
    this.timeouts.set(key, timer);
  };

  repeat = (key: ManagedTimerKey, callback: () => void, delayMs: number): void => {
    this.cancel(key);
    this.intervals.set(key, setInterval(callback, delayMs));
  };

  cancel = (key: ManagedTimerKey): void => {
    const timeout = this.timeouts.get(key);
    if (timeout != null) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
    const interval = this.intervals.get(key);
    if (interval != null) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  };

  clearAll = (): void => {
    this.timeouts.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    this.timeouts.clear();
    this.intervals.clear();
  };
}

export function useManagedTimers(): ManagedTimerRegistry {
  const registryRef = useRef<ManagedTimerRegistry | null>(null);
  if (!registryRef.current) registryRef.current = new ManagedTimerRegistry();

  useEffect(() => {
    const registry = registryRef.current;
    return () => registry?.clearAll();
  }, []);

  return registryRef.current;
}
