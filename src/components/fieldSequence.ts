import type { BallOutcome } from '../domain/types';
import { deliveryBallFlightMs, DELIVERY_ROLE_MOTION_MS, DELIVERY_RUN_UP_MS } from './fieldMotion';
import { deliveryBouncePoint, fieldGeometry, fieldingPositions, fieldShotPath, pitchGeometry } from './fieldGeometry';
import type { FieldLayout, FieldPoint, FieldShot } from './fieldGeometry';

export type ActorPose = 'ready' | 'run-left' | 'run-right' | 'gather' | 'catch' | 'throw' | 'appeal' | 'walk';
export type UmpireSignal = 'none' | 'out' | 'four' | 'six' | 'wide' | 'no-ball' | 'bye' | 'leg-bye';
export interface SequenceShot extends FieldShot { runs?: number; delivery?: string; shot?: string; outcome?: BallOutcome }
export interface Track { times: number[]; values: number[] }
export interface PoseFrame { pose: ActorPose; from: number; to: number }
export interface ActorTrack { x: Track; y: Track; heading: Track; poses: PoseFrame[] }
const track = (times: number[], values: number[]): Track => ({ times, values });
const still = () => track([0, 1], [0, 0]);

/** Opacity tracks select cached SVG poses without React updates on every frame. */
export function poseVisibility(frames: PoseFrame[], pose: ActorPose): Track {
  const times = [...new Set([0, 1, ...frames.flatMap(f => [
    Math.max(0, f.from - 0.0001), f.from, Math.max(0, f.to - 0.0001), f.to,
  ])])].sort((a, b) => a - b);
  return track(times, times.map(t => {
    const active = frames.find(f => t >= f.from && (t < f.to || (t === 1 && f.to === 1)));
    return (active?.pose ?? 'ready') === pose ? 1 : 0;
  }));
}

/** Artwork faces up at zero degrees. Direction follows travel, not the camera. */
export function headingTo(from: FieldPoint, to: FieldPoint): number {
  return Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
}
function shortestHeading(from: number, to: number) {
  return from + ((to - from + 540) % 360) - 180;
}
function runPoses(from: number, to: number, strides = 4): PoseFrame[] {
  return Array.from({ length: strides }, (_, i) => ({
    pose: i % 2 ? 'run-right' : 'run-left',
    from: from + (to - from) * i / strides,
    to: from + (to - from) * (i + 1) / strides,
  }));
}

export function umpireSignal(shot?: SequenceShot | null): UmpireSignal {
  if (!shot) return 'none';
  if (shot.tone === 'wicket') return 'out';
  if (shot.outcome === 'WD') return 'wide';
  if (shot.outcome === 'NB') return 'no-ball';
  if (shot.outcome === 'BYE') return 'bye';
  if (shot.outcome === 'LB') return 'leg-bye';
  if (shot.tone === 'four') return 'four';
  if (shot.tone === 'six') return 'six';
  return 'none';
}

/** Timed staging of an already-decided delivery. No RNG, engine writes or new rules. */
export function fieldSequence(size: number, shot: SequenceShot, layout: FieldLayout = 'BALANCED') {
  const field = fieldGeometry(size);
  const { striker, nonStriker, bowler, keeper, cx, cy, groundR } = field;
  const pitch = pitchGeometry(size);
  const release = DELIVERY_RUN_UP_MS / DELIVERY_ROLE_MOTION_MS;
  const flight = deliveryBallFlightMs(shot.tone) / DELIVERY_ROLE_MOTION_MS;
  const contact = release + flight * 0.46;
  const catchBall = shot.dismissalType === 'CAUGHT';
  const runOut = shot.dismissalType === 'RUN_OUT';
  const stumped = shot.dismissalType === 'STUMPED';
  const bowled = shot.dismissalType === 'BOWLED' || shot.dismissalType === 'HIT_WICKET';
  const lbw = shot.dismissalType === 'LBW';
  const missed = shot.shot === 'LEAVE' || shot.outcome === 'WD' || stumped || shot.outcome === 'BYE';
  const boundary = shot.tone === 'four' || shot.tone === 'six';
  const collectAt = 0.72;
  const throwAt = 0.8;
  const receiveAt = 0.92;
  const shotPath = fieldShotPath(size, catchBall || runOut
    ? { ...shot, tone: 'normal', reach: 0.68 } : shot);
  const rawTarget = shotPath.end;
  const distance = Math.hypot(rawTarget.x - cx, rawTarget.y - cy);
  const ratio = Math.min(1, groundR * 0.9 / Math.max(1, distance));
  const target = { x: cx + (rawTarget.x - cx) * ratio, y: cy + (rawTarget.y - cy) * ratio };
  const fielders = fieldingPositions(size, layout);
  const nearest = fielders.map((p, index) => ({ index, distance: Math.hypot(p.x - target.x, p.y - target.y) }))
    .sort((a, b) => a.distance - b.distance);
  const collector = nearest[0].index;
  const backup = nearest[1].index;
  const fielded = !missed && !bowled && !lbw && shot.tone !== 'six';
  const returnEnd = runOut
    ? { x: cx, y: pitch.bowlerStumpY }
    : { x: cx, y: pitch.strikerStumpY };
  const fielderTracks = fielders.map((start, index): ActorTrack => {
    const initial = headingTo(start, { x: cx, y: cy });
    if (!fielded || (index !== collector && index !== backup)) {
      return { x: still(), y: still(), heading: track([0, 1], [initial, initial]), poses: [] };
    }
    // The collector reaches the ball; backup stays behind it, inside the rope.
    const end = index === collector ? target : {
      x: start.x + (target.x - start.x) * 0.45,
      y: start.y + (target.y - start.y) * 0.45,
    };
    const facing = shortestHeading(initial, headingTo(start, end));
    const throwing = shortestHeading(facing, headingTo(end, returnEnd));
    return {
      x: track([0, contact + 0.02, collectAt, 1], [0, 0, end.x - start.x, end.x - start.x]),
      y: track([0, contact + 0.02, collectAt, 1], [0, 0, end.y - start.y, end.y - start.y]),
      heading: track([0, contact, contact + 0.04, collectAt, throwAt, 1],
        [initial, initial, facing, facing, index === collector && !boundary ? throwing : facing,
          index === collector && !boundary ? throwing : facing]),
      poses: [
        ...runPoses(contact + 0.02, collectAt),
        ...(index === collector ? [
          { pose: catchBall ? 'catch' as const : 'gather' as const, from: collectAt, to: throwAt },
          { pose: catchBall ? 'appeal' as const : boundary ? 'ready' as const : 'throw' as const, from: throwAt, to: 1 },
        ] : []),
      ],
    };
  });

  // Scored boundaries and penalty extras must not fabricate completed runs.
  const runs = boundary || shot.outcome === 'WD' || shot.outcome === 'NB' ||
    (shot.tone === 'wicket' && !runOut) ? 0 : Math.max(0, Math.min(3, Math.floor(shot.runs ?? 0)));
  const legs = runs + (runOut ? 1 : 0);
  const times = [0, contact + 0.03];
  const fractions = [0, 0];
  const poses: PoseFrame[] = [];
  for (let leg = 0; leg < legs; leg += 1) {
    const startAt = contact + 0.03 + (0.91 - contact - 0.03) * leg / legs;
    const endAt = contact + 0.03 + (0.91 - contact - 0.03) * (leg + 1) / legs;
    const finalAttempt = runOut && leg === legs - 1;
    times.push(endAt - 0.018, endAt);
    const end = finalAttempt ? (leg % 2 ? 0.12 : 0.88) : (leg + 1) % 2;
    fractions.push(end, end); // Plant the bat, then turn—never glide straight through.
    poses.push(...runPoses(startAt, endAt - 0.018, 2));
  }
  times.push(1);
  fractions.push(fractions[fractions.length - 1]);
  const runner = (start: FieldPoint, end: FieldPoint, initial: number): ActorTrack => {
    // Separate lanes retain the existing crease anchors and never overlap.
    const dy = end.y - start.y;
    const headingValues = times.map((_, i) => {
      if (i < 2 || !legs) return initial;
      // Odd indices are the end of the planted-bat interval: turn there,
      // not throughout the next run. Keep the final heading after the last leg.
      const leg = Math.min(legs - 1, Math.floor((i - 1) / 2));
      return dy * (leg % 2 ? -1 : 1) > 0 ? 180 : 0;
    });
    return { x: still(), y: track(times, fractions.map(f => f * dy)),
      heading: track(times, headingValues), poses };
  };

  const stumpEnd = { x: cx, y: pitch.strikerStumpY };
  const bounce = deliveryBouncePoint(size, shot.delivery);
  const ballTimes = [0, release, release + flight * 0.3, contact];
  const ballPoints = [bowler, bowler, bounce, striker];
  let endpoint = shotPath.end;
  let impactAt = collectAt;
  if (stumped) {
    ballTimes.push(0.58, 0.68, receiveAt);
    ballPoints.push(keeper, keeper, stumpEnd);
    endpoint = stumpEnd;
    impactAt = receiveAt;
  } else if (bowled || lbw) {
    endpoint = bowled ? stumpEnd : striker;
    impactAt = contact + 0.04;
    ballTimes.push(impactAt);
    ballPoints.push(endpoint);
  } else if (missed) {
    endpoint = keeper;
    ballTimes.push(collectAt);
    ballPoints.push(keeper);
  } else if (boundary) {
    ballTimes.push(0.6, 0.86);
    ballPoints.push(shotPath.control, shotPath.end);
    impactAt = 0.86;
  } else {
    ballTimes.push(collectAt, throwAt);
    ballPoints.push(target, target);
    endpoint = target;
    if (!catchBall) {
      ballTimes.push(receiveAt);
      ballPoints.push(returnEnd);
      endpoint = returnEnd;
      impactAt = receiveAt;
    }
  }
  ballTimes.push(1);
  ballPoints.push(endpoint);
  return {
    contact, collectAt, impactAt, collector: fielded ? collector : -1, backup: fielded ? backup : -1,
    target, endpoint, fielders: fielderTracks,
    striker: runner(striker, nonStriker, 180), nonStriker: runner(nonStriker, striker, 0),
    ball: { x: track(ballTimes, ballPoints.map(p => p.x)), y: track(ballTimes, ballPoints.map(p => p.y)) },
    bowlerReceive: runOut ? {
      x: track([0, 0.48, 0.84, 1], [0, 0, returnEnd.x - bowler.x, returnEnd.x - bowler.x]),
      y: track([0, 0.48, 0.84, 1], [0, 0, returnEnd.y - bowler.y, returnEnd.y - bowler.y]),
    } : null,
    keeper: {
      x: still(),
      y: stumped ? track([0, 0.58, 0.68, receiveAt, 1], [0, 0, 0, stumpEnd.y - keeper.y, stumpEnd.y - keeper.y])
        : fielded && !boundary && !catchBall && !runOut
          ? track([0, contact, 0.84, 1], [0, 0, stumpEnd.y - keeper.y, stumpEnd.y - keeper.y]) : still(),
      heading: track([0, 1], [180, 180]),
      poses: stumped ? [
        { pose: 'gather' as const, from: 0.58, to: 0.68 },
        { pose: 'run-left' as const, from: 0.68, to: receiveAt },
        { pose: 'appeal' as const, from: receiveAt, to: 1 },
      ] : [{ pose: 'gather' as const, from: missed ? collectAt : receiveAt, to: 1 }],
    },
    dismissal: shot.dismissalType,
    bailsAt: bowled || runOut || stumped ? impactAt : null,
    bailsEnd: runOut ? returnEnd : stumpEnd,
    signal: umpireSignal(shot),
  };
}
