import { createDeliveryTimeline, playDelivery, shouldRenderDelivery } from '../deliveryPlayback';
import type { PlaybackControls } from '../deliveryPlayback';
import type { MatchBallStep } from '../../engine/liveMatch';

function setup() {
  const controls: PlaybackControls = { paused: false, skip: false, rate: 1, epoch: 0 };
  const onFrame = jest.fn();
  const onContact = jest.fn();
  const onResolve = jest.fn();
  const options = {
    durationMs: 1000, contactMs: 200, resolveMs: 600,
    controls: () => controls, onFrame, onContact, onResolve,
  };
  const timeline = createDeliveryTimeline(options);
  let now = 0;
  timeline.tick(now);
  const advance = (ms: number) => {
    for (let i = 0; i < ms; i += 20) timeline.tick(now += 20);
  };
  return { controls, options, timeline, advance, onFrame, onContact, onResolve };
}

describe('shared delivery presentation clock', () => {
  it('reveals after contact and completes the hold, exactly once', () => {
    const s = setup();
    s.advance(180);
    expect(s.onContact).not.toHaveBeenCalled();
    expect(s.onResolve).not.toHaveBeenCalled();
    s.advance(20);
    expect(s.onContact).toHaveBeenCalledTimes(1);
    s.advance(380);
    expect(s.onResolve).not.toHaveBeenCalled();
    s.advance(20);
    expect(s.onResolve).toHaveBeenCalledWith(false);
    s.advance(800);
    expect(s.onResolve).toHaveBeenCalledTimes(1);
    expect(s.onContact).toHaveBeenCalledTimes(1);
    expect(s.timeline.tick(2000)).toBe(true);
  });

  it.each(['manual pause', 'commentary', 'tactics', 'stance', 'guide', 'background'])(
    'freezes movement and feedback during %s', () => {
      const s = setup();
      s.advance(180);
      const frame = s.onFrame.mock.calls.at(-1);
      s.controls.paused = true;
      s.advance(3000);
      expect(s.onFrame.mock.calls.at(-1)).toEqual(frame);
      expect(s.onContact).not.toHaveBeenCalled();
      expect(s.onResolve).not.toHaveBeenCalled();
      s.controls.paused = false;
      s.advance(20); // first frame after resume re-anchors time
      expect(s.onContact).not.toHaveBeenCalled();
      s.advance(20);
      expect(s.onContact).toHaveBeenCalledTimes(1);
    },
  );

  it('does not catch up when background/resume occurred between frames', () => {
    const s = setup();
    s.advance(180);
    s.controls.epoch += 2;
    s.timeline.tick(90_000);
    expect(s.onFrame).toHaveBeenLastCalledWith(180);
    expect(s.onContact).not.toHaveBeenCalled();
    s.timeline.tick(90_020);
    expect(s.onContact).toHaveBeenCalledTimes(1);
  });

  it('changes speed without resetting or repeating contact', () => {
    const s = setup();
    s.advance(200);
    s.controls.rate = 2;
    s.advance(200);
    expect(s.onResolve).toHaveBeenCalledTimes(1);
    s.controls.rate = 1;
    s.advance(400);
    expect(s.onContact).toHaveBeenCalledTimes(1);
    expect(s.onFrame).toHaveBeenLastCalledWith(1000);
  });

  it('skips a paused pending delivery silently and resolves once', () => {
    const s = setup();
    s.advance(100);
    s.controls.paused = true;
    s.controls.skip = true;
    expect(s.timeline.tick(120)).toBe(true);
    s.timeline.tick(140);
    expect(s.onContact).not.toHaveBeenCalled();
    expect(s.onResolve).toHaveBeenCalledTimes(1);
    expect(s.onResolve).toHaveBeenCalledWith(true);
  });

  it('does not replay resolution when skipping its reading hold', () => {
    const s = setup();
    s.advance(600);
    s.controls.skip = true;
    s.advance(20);
    expect(s.onResolve).toHaveBeenCalledTimes(1);
  });

  it('cancels stale fixture callbacks without revealing or sounding', () => {
    const s = setup();
    s.advance(180);
    s.timeline.cancel();
    s.advance(2000);
    expect(s.onContact).not.toHaveBeenCalled();
    expect(s.onResolve).not.toHaveBeenCalled();
  });

  it('cancels the scheduled frame and unblocks the match loop', async () => {
    const request = jest.fn().mockReturnValue(42);
    const cancel = jest.fn();
    const s = setup();
    const playback = playDelivery(s.options, { request, cancel });
    playback.cancel();
    await expect(playback.done).resolves.toBe(false);
    expect(cancel).toHaveBeenCalledWith(42);
    expect(s.onResolve).not.toHaveBeenCalled();
  });

  it('preserves fast-mode batching while always showing important deliveries', () => {
    const step = { event: { outcome: 'DOT', isWicket: false } } as MatchBallStep;
    expect(shouldRenderDelivery(step, 1, 1)).toBe(true);
    expect(shouldRenderDelivery(step, 4, 1)).toBe(false);
    expect(shouldRenderDelivery(step, 4, 4)).toBe(true);
    for (const special of [
      { overComplete: true }, { inningsBreak: true }, { matchComplete: true },
      { event: { ...step.event, isWicket: true } },
      { event: { ...step.event, outcome: '4' as const } },
      { event: { ...step.event, outcome: '6' as const } },
    ]) expect(shouldRenderDelivery({ ...step, ...special }, 4, 1)).toBe(true);
  });
});
