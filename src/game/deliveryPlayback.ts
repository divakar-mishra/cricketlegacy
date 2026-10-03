import type { MatchBallStep } from '../engine/liveMatch';
import type { MatchSpeed } from './matchTiming';

export function shouldRenderDelivery(step: MatchBallStep, speed: MatchSpeed, sequence: number) {
  return speed === 1 || step.overComplete || step.inningsBreak || step.matchComplete ||
    step.event.isWicket || Boolean(step.milestone) || step.event.outcome === '4' ||
    step.event.outcome === '6' || sequence % speed === 0;
}

/** Presentation only: never advances the engine or settles a fixture. */
export interface PlaybackControls {
  paused: boolean;
  rate: number;
  skip: boolean;
  /** Changes on app lifecycle transitions, even if no frames ran in between. */
  epoch: number;
}

export interface DeliveryPlaybackOptions {
  durationMs: number;
  contactMs: number;
  resolveMs: number;
  controls: () => PlaybackControls;
  onFrame: (elapsedMs: number) => void;
  onContact: () => void;
  onResolve: (skipped: boolean) => void;
}

/** One clock for movement, contact, reveal and the reading hold. */
export function createDeliveryTimeline(options: DeliveryPlaybackOptions) {
  let elapsed = 0;
  let previousTime: number | undefined;
  let previousEpoch: number | undefined;
  let previouslyPaused = true;
  let contacted = false;
  let resolved = false;
  let done = false;

  return {
    tick(now: number): boolean {
      if (done) return true;
      const control = options.controls();
      if (control.skip) {
        done = true;
        options.onFrame(options.resolveMs);
        if (!resolved) {
          resolved = true;
          options.onResolve(true);
        }
        return true;
      }
      const delta = previousTime === undefined || previouslyPaused || control.paused ||
        previousEpoch !== control.epoch ? 0 : Math.min(64, Math.max(0, now - previousTime));
      previousTime = now;
      previousEpoch = control.epoch;
      previouslyPaused = control.paused;
      if (control.paused) return false;
      elapsed = Math.min(options.durationMs, elapsed + delta * control.rate);
      options.onFrame(elapsed);
      if (!contacted && elapsed >= options.contactMs) {
        contacted = true;
        options.onContact();
      }
      if (!resolved && elapsed >= options.resolveMs) {
        resolved = true;
        options.onResolve(false);
      }
      done = elapsed >= options.durationMs;
      return done;
    },
    cancel() { done = true; },
  };
}

export function playDelivery(options: DeliveryPlaybackOptions, frames = {
  request: (callback: (time: number) => void) => requestAnimationFrame(callback),
  cancel: (id: number) => cancelAnimationFrame(id),
}) {
  const timeline = createDeliveryTimeline(options);
  let frame: number | undefined;
  let finish!: (completed: boolean) => void;
  const done = new Promise<boolean>((resolve) => { finish = resolve; });
  const tick = (now: number) => {
    if (timeline.tick(now)) finish(true);
    else frame = frames.request(tick);
  };
  frame = frames.request(tick);
  return {
    done,
    cancel() {
      timeline.cancel();
      if (frame !== undefined) frames.cancel(frame);
      finish(false);
    },
  };
}
