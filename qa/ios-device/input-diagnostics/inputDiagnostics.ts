// Temporary diagnostic-snapshot module. NOT imported by the shared app source.
import { AppState, type GestureResponderEvent } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

type Route = 'MainMenu' | 'Settings' | 'SavedGames';
type Target = 'root' | 'settings' | 'back' | 'saved-games';
type Phase = 'touch-start' | 'touch-move' | 'touch-end' | 'touch-cancel' |
  'press-in' | 'press-out' | 'press' | 'route' | 'foreground' | 'background' | 'js-gap' | 'expired' | 'work';
const WORK_STAGES = ['storage-read', 'key-read', 'transport-decode', 'sealed-data', 'aes-import',
  'aes-open', 'utf8-decode', 'json-parse', 'integrity-check', 'migrations', 'vip-sync', 'list-slots'] as const;
type WorkStage = typeof WORK_STAGES[number];
interface TraceEvent {
  seq: number; atMs: number; route: Route; target: Target; phase: Phase;
  nativeAtMs?: number; touchId?: number; x?: number; y?: number; gapMs?: number;
  stage?: WorkStage; durationMs?: number;
}
const PHASES: readonly string[] = ['touch-start', 'touch-move', 'touch-end', 'touch-cancel',
  'press-in', 'press-out', 'press', 'route', 'foreground', 'background', 'js-gap', 'expired', 'work'];
const MAX_EVENTS = 1024;
const MAX_MS = 10 * 60_000;
const FILE_NAME = 'cricket-input-trace-v1.json';
const file = FileSystem.cacheDirectory ? FileSystem.cacheDirectory + FILE_NAME : null;
let route: Route | null = null;
let started = false;
let foreground = AppState.currentState === 'active';
let expired = false;
let startAt = 0;
let lastTick = 0;
let lastPublish = 0;
let seq = 0;
let saved = false;
let writeFailed = false;
let events: TraceEvent[] = [];
const counts = { touch: 0, press: 0, cancel: 0, nav: 0, gap: 0 };
const listeners = new Set<() => void>();
let display = '';
let writes: Promise<unknown> = Promise.resolve();
let pendingPayload: string | null = null;
let flushing = false;

function publish(): void {
  const next = route && started && foreground
    ? `Input QA 2 · T:${counts.touch} P:${counts.press} C:${counts.cancel} N:${counts.nav} G:${counts.gap} · ${expired ? 'expired' : writeFailed ? 'write failed' : saved ? 'saved' : 'pending'}`
    : '';
  if (next === display) return;
  display = next;
  listeners.forEach((listener) => listener());
}
export function subscribeInputDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function readInputDiagnosticsDisplay(): string { return display; }
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

/** Whitelist numbers only; NEVER serialize a native event, text, route params or errors. */
export function traceInput(phase: Phase, target: Target, event?: GestureResponderEvent, gapMs?: number): void {
  if (!started || !route || !foreground || expired || !PHASES.includes(phase)) return;
  if (!['root', 'settings', 'back', 'saved-games'].includes(target)) return;
  if ((['settings', 'saved-games'].includes(target) && route !== 'MainMenu') ||
    (target === 'back' && route !== 'Settings' && route !== 'SavedGames')) return;
  const entry: TraceEvent = { seq: ++seq, atMs: Math.round((performance.now() - startAt) * 100) / 100,
    route, target, phase };
  if (phase.startsWith('touch-') || phase.startsWith('press')) {
    const native = event?.nativeEvent;
    entry.nativeAtMs = finite(native?.timestamp);
    entry.touchId = finite(native?.identifier);
    entry.x = finite(native?.pageX);
    entry.y = finite(native?.pageY);
  }
  if (phase === 'js-gap') entry.gapMs = finite(gapMs);
  events.push(entry);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  if (phase === 'touch-start' && target === 'root') counts.touch += 1;
  if (phase === 'press') counts.press += 1;
  if (phase === 'touch-cancel' && target === 'root') counts.cancel += 1;
  if (phase === 'route') counts.nav += 1;
  if (phase === 'js-gap') counts.gap += 1;
}

/** Known stage labels and elapsed time only. No slot, key, identity, bytes or errors. */
export function traceInputWork(stage: WorkStage, beganAt: number): void {
  if (!WORK_STAGES.includes(stage) || !Number.isFinite(beganAt)) return;
  const durationMs = finite(performance.now() - beganAt);
  if (durationMs === undefined || durationMs < 0) return;
  const before = seq;
  traceInput('work', 'root');
  if (seq === before) return;
  const entry = events[events.length - 1];
  entry.stage = stage;
  entry.durationMs = durationMs;
}

export function flushInputDiagnostics(): Promise<unknown> {
  if (!started || !file) return writes;
  // Coalesce slow writes: at most one in-flight and one latest pending snapshot.
  pendingPayload = JSON.stringify({ schema: 1, build: 'input-qa-2',
    interpretation: 'JS receipt timing plus raw native touch timestamps; not OS hardware delivery proof.',
    maxEvents: MAX_EVENTS, expiresAfterMs: MAX_MS, counts: { ...counts }, events });
  if (flushing) return writes;
  flushing = true;
  writes = writes.catch(() => undefined).then(async () => {
    while (pendingPayload) {
      const payload = pendingPayload;
      pendingPayload = null;
      try {
        await FileSystem.writeAsStringAsync(file, payload);
        saved = true;
        writeFailed = false;
      } catch { writeFailed = true; }
    }
    flushing = false;
  });
  return writes;
}

export function setInputDiagnosticRoute(value: unknown): void {
  const next = value === 'MainMenu' || value === 'Settings' || value === 'SavedGames' ? value : null;
  if (next === route) return;
  route = next;
  lastTick = performance.now();
  if (route) traceInput('route', 'root');
  else void flushInputDiagnostics();
  publish();
}

export const diagnosticRootHandlers = {
  onTouchStart: (event: GestureResponderEvent) => traceInput('touch-start', 'root', event),
  onTouchMove: (event: GestureResponderEvent) => traceInput('touch-move', 'root', event),
  onTouchEnd: (event: GestureResponderEvent) => traceInput('touch-end', 'root', event),
  onTouchCancel: (event: GestureResponderEvent) => traceInput('touch-cancel', 'root', event),
};
export function diagnosticPressHandlers(target: 'settings' | 'back' | 'saved-games') {
  return {
    onTouchStart: (event: GestureResponderEvent) => traceInput('touch-start', target, event),
    onTouchEnd: (event: GestureResponderEvent) => traceInput('touch-end', target, event),
    onTouchCancel: (event: GestureResponderEvent) => traceInput('touch-cancel', target, event),
    onPressIn: (event: GestureResponderEvent) => traceInput('press-in', target, event),
    onPressOut: (event: GestureResponderEvent) => traceInput('press-out', target, event),
  };
}

export function startInputDiagnostics(): () => void {
  if (started) return () => undefined;
  started = true;
  startAt = lastTick = lastPublish = performance.now();
  foreground = AppState.currentState === 'active';
  if (file) {
    // Rotate ONLY this diagnostic's prior file, never app storage or saves.
    writes = FileSystem.getInfoAsync(file).then((info) => info.exists
      ? FileSystem.copyAsync({ from: file, to: file.replace('.json', '.previous.json') })
      : undefined).catch(() => undefined);
  }
  if (route) traceInput('route', 'root');
  const timer = setInterval(() => {
    const now = performance.now();
    if (!route || !foreground || expired) { lastTick = now; return; }
    if (now - startAt >= MAX_MS) {
      traceInput('expired', 'root');
      expired = true;
      void flushInputDiagnostics();
      publish();
      clearInterval(timer);
      return;
    }
    const gap = now - lastTick - 100;
    if (gap >= 250) traceInput('js-gap', 'root', undefined, gap);
    lastTick = now;
    if (now - lastPublish >= 1000) {
      lastPublish = now;
      void flushInputDiagnostics();
      publish();
    }
  }, 100);
  const listener = AppState.addEventListener('change', (value) => {
    if (value !== 'active') {
      traceInput('background', 'root');
      void flushInputDiagnostics();
      foreground = false;
    } else {
      foreground = true;
      lastTick = performance.now();
      traceInput('foreground', 'root');
    }
    publish();
  });
  publish();
  return () => {
    clearInterval(timer);
    listener.remove();
    void flushInputDiagnostics();
    started = false;
    publish();
  };
}
