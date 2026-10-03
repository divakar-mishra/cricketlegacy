import { fieldSequence, headingTo, poseVisibility, umpireSignal } from '../fieldSequence';
import type { SequenceShot, Track } from '../fieldSequence';
import { fieldGeometry, fieldingPositions, pitchGeometry } from '../fieldGeometry';

const shot: SequenceShot = { angleDeg: 72, reach: 0.7, tone: 'normal', runs: 1, outcome: '1' };
const at = (track: Track, t: number) => {
  const i = track.times.findIndex((end, index) => index > 0 && end >= t);
  if (i < 0) return track.values.at(-1)!;
  const f = (t - track.times[i - 1]) / (track.times[i] - track.times[i - 1]);
  return track.values[i - 1] + f * (track.values[i] - track.values[i - 1]);
};

describe('delivery movement staging', () => {
  it.each([220, 280, 360, 420])('meets the collector and return receiver at size %s', size => {
    const plan = fieldSequence(size, shot);
    const start = fieldingPositions(size, 'BALANCED')[plan.collector];
    const collector = plan.fielders[plan.collector];
    expect(start.x + at(collector.x, plan.collectAt)).toBeCloseTo(at(plan.ball.x, plan.collectAt));
    expect(start.y + at(collector.y, plan.collectAt)).toBeCloseTo(at(plan.ball.y, plan.collectAt));
    expect(plan.backup).not.toBe(plan.collector);
    expect(fieldGeometry(size).keeper.y + at(plan.keeper.y, 0.92)).toBeCloseTo(at(plan.ball.y, 0.92));
  });

  it.each([1, 2, 3])('runs %s legs on separate lanes, planting before turning', runs => {
    const plan = fieldSequence(300, { ...shot, runs });
    const field = fieldGeometry(300);
    expect(at(plan.striker.y, plan.contact)).toBe(0);
    expect(at(plan.striker.y, 1)).toBeCloseTo((runs % 2) * (field.nonStriker.y - field.striker.y));
    expect(at(plan.nonStriker.y, 1)).toBeCloseTo(-at(plan.striker.y, 1));
    expect(plan.striker.x.values).toEqual([0, 0]);
    for (let i = 2; i < plan.striker.y.values.length - 1; i += 2) {
      expect(plan.striker.y.values[i]).toBe(plan.striker.y.values[i + 1]);
    }
  });

  it.each(['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED', 'HIT_WICKET'] as const)('stages %s without modifying the event', dismissalType => {
    const event = Object.freeze({ ...shot, tone: 'wicket' as const, runs: 0, dismissalType });
    const plan = fieldSequence(300, event);
    expect(plan.signal).toBe('out');
    expect(plan.bailsAt !== null).toBe(!['CAUGHT', 'LBW'].includes(dismissalType));
    if (dismissalType === 'RUN_OUT') {
      expect(plan.endpoint.y).toBe(pitchGeometry(300).bowlerStumpY);
      expect(fieldGeometry(300).bowler.y + at(plan.bowlerReceive!.y, 0.92)).toBeCloseTo(plan.endpoint.y);
      expect(at(plan.striker.y, 1)).toBeCloseTo((fieldGeometry(300).nonStriker.y - fieldGeometry(300).striker.y) * 0.88);
    } else {
      expect(at(plan.striker.y, 1)).toBe(0);
    }
    if (dismissalType === 'STUMPED') {
      expect(fieldGeometry(300).keeper.y + at(plan.keeper.y, 0.92)).toBeCloseTo(plan.endpoint.y);
    }
    if (dismissalType === 'CAUGHT') expect(plan.endpoint).toEqual(plan.target);
    const tracks = [plan.ball.x, plan.ball.y, plan.striker.y, ...plan.fielders.flatMap(f => [f.x, f.y, f.heading])];
    for (const track of tracks) {
      expect(track.values.every(Number.isFinite)).toBe(true);
      expect(track.times.every((t, i) => i === 0 || t > track.times[i - 1])).toBe(true);
      expect(track.times.length).toBe(track.values.length);
    }
    expect(fieldSequence(300, event)).toEqual(plan);
  });

  it.each(['four', 'six'] as const)('does not invent running for a %s', tone => {
    expect(fieldSequence(300, { ...shot, tone, runs: 6 }).striker.y.values.every(v => v === 0)).toBe(true);
  });
  it.each([['WD', 'wide'], ['NB', 'no-ball'], ['BYE', 'bye'], ['LB', 'leg-bye']] as const)('signals %s', (outcome, signal) => {
    expect(umpireSignal({ ...shot, outcome, tone: 'extra' })).toBe(signal);
  });
  it('selects cached stride poses and correct directional headings', () => {
    expect(headingTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
    expect(headingTo({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(0);
    const frames = [{ pose: 'gather' as const, from: 0.5, to: 0.8 }];
    expect(at(poseVisibility(frames, 'gather'), 0.6)).toBe(1);
    expect(at(poseVisibility(frames, 'ready'), 0.6)).toBe(0);
    expect(at(poseVisibility(frames, 'ready'), 0.9)).toBe(1);
  });
});
