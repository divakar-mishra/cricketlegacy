import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ModalPriority = 1 | 2 | 3;

export const MODAL_PRIORITY = {
  critical: 1,
  engagement: 2,
  prompt: 3,
} as const satisfies Record<string, ModalPriority>;

// Preserve modal ordering without making a successful claim look unresponsive.
const MODAL_GAP_MS = 180;

type QueueItem = {
  id: string;
  priority: ModalPriority;
  sequence: number;
  yieldable?: boolean;
};

type ModalQueueValue = {
  activeId: string | null;
  request: (id: string, priority: ModalPriority, yieldable?: boolean) => void;
  release: (id: string) => void;
};

const ModalQueueContext = createContext<ModalQueueValue | null>(null);

export function ModalQueueProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const activeItemRef = useRef<QueueItem | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const sequenceRef = useRef(0);
  const lastClosedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pumpRef = useRef<() => void>(() => {});

  const pump = useCallback(() => {
    if (activeRef.current || timerRef.current || queueRef.current.length === 0) return;

    const elapsed = Date.now() - lastClosedAtRef.current;
    const wait = Math.max(0, MODAL_GAP_MS - elapsed);
    if (lastClosedAtRef.current > 0 && wait > 0) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        pumpRef.current();
      }, wait);
      return;
    }

    queueRef.current.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next.id;
    activeItemRef.current = next;
    setActiveId(next.id);
  }, []);

  pumpRef.current = pump;

  const request = useCallback((id: string, priority: ModalPriority, yieldable = false) => {
    if (activeRef.current === id || queueRef.current.some((item) => item.id === id)) {
      return;
    }
    queueRef.current.push({ id, priority, sequence: sequenceRef.current++, yieldable });
    // A scene-local coach can safely yield. Never preempt a native purchase,
    // consent, reward or other ordinary modal that already owns the slot.
    const active = activeItemRef.current;
    if (active?.yieldable && priority < active.priority) {
      queueRef.current.push(active);
      activeRef.current = null;
      activeItemRef.current = null;
      setActiveId(null);
    }
    pumpRef.current();
  }, []);

  const release = useCallback((id: string) => {
    queueRef.current = queueRef.current.filter((item) => item.id !== id);
    if (activeRef.current !== id) return;

    activeRef.current = null;
    activeItemRef.current = null;
    lastClosedAtRef.current = Date.now();
    setActiveId(null);
    pumpRef.current();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ activeId, request, release }), [activeId, release, request]);

  return <ModalQueueContext.Provider value={value}>{children}</ModalQueueContext.Provider>;
}

/**
 * Returns true only when this overlay owns the global modal slot.
 * Components still work in isolated tests without a provider.
 */
export function useModalQueue(
  wantsToShow: boolean,
  priority: ModalPriority,
  label = 'modal',
  yieldToHigherPriority = false,
): boolean {
  const queue = useContext(ModalQueueContext);
  const reactId = useId();
  const id = `${label}:${reactId}`;
  const request = queue?.request;
  const release = queue?.release;

  useEffect(() => {
    if (!request || !release) return undefined;
    if (wantsToShow) {
      if (yieldToHigherPriority) request(id, priority, true);
      else request(id, priority);
    }
    else release(id);
    return () => release(id);
  }, [id, priority, release, request, wantsToShow, yieldToHigherPriority]);

  if (!wantsToShow) return false;
  return queue ? queue.activeId === id : true;
}
