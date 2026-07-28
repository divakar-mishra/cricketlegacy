import { COUNTRIES } from '../data/countries';
import { namePoolFor } from '../data/names';
import { BattingStyle, BowlingStyle, Player, Role } from '../domain/types';
import { computeOverall } from '../engine/rating';
import { chance, makeRng, pick, randInt, Rng } from '../engine/rng';
import { clamp } from '../utils/math';

const PACE_STYLES: BowlingStyle[] = ['PACE', 'MEDIUM', 'LEFT_ARM_PACE'];
const SPIN_STYLES: BowlingStyle[] = ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_SPIN'];

function jitter(center: number, spread: number, rng: Rng): number {
  return clamp(Math.round(center + (rng() * 2 - 1) * spread), 1, 99);
}

export interface GenPlayerOptions {
  id: string;
  nationality: string;
  role: Role;
  quality: number; // team strength center 0..100
  rng: Rng;
  age?: number;
  isUserPlayer?: boolean;
}

export function generatePlayer(opts: GenPlayerOptions): Player {
  const { id, nationality, role, quality, rng } = opts;
  const pool = namePoolFor(nationality);
  const name = `${pick(pool.first, rng)} ${pick(pool.last, rng)}`;
  const age = opts.age ?? randInt(19, 34, rng);

  const batCenter =
    role === 'BATTER'
      ? quality + 4
      : role === 'WK_BATTER'
        ? quality
        : role === 'ALLROUNDER'
          ? quality - 6
          : quality - 24;
  const bowlCenter =
    role === 'BOWLER' ? quality + 4 : role === 'ALLROUNDER' ? quality - 6 : quality - 26;

  const spread = 9;

  const batting = {
    technique: jitter(batCenter, spread, rng),
    timing: jitter(batCenter, spread, rng),
    power: jitter(batCenter, spread, rng),
    footwork: jitter(batCenter, spread, rng),
    temperament: jitter(batCenter, spread, rng),
    running: jitter(clamp(batCenter + 3, 1, 99), spread, rng),
  };

  const bowling = {
    paceOrSpin: jitter(bowlCenter, spread, rng),
    accuracy: jitter(bowlCenter, spread, rng),
    movement: jitter(bowlCenter, spread, rng),
    variations: jitter(bowlCenter, spread, rng),
    stamina: jitter(clamp(bowlCenter + 6, 20, 99), spread, rng),
  };

  const fielding = {
    catching: jitter(quality, 10, rng),
    throwing: jitter(quality, 10, rng),
    agility: jitter(quality, 10, rng),
    keeping: role === 'WK_BATTER' ? jitter(quality + 6, 7, rng) : jitter(quality - 30, 12, rng),
  };

  const meta = {
    fitness: jitter(quality + 6, 8, rng),
    form: randInt(45, 68, rng),
    confidence: jitter(quality, 10, rng),
    aggression: randInt(38, 72, rng),
    discipline: jitter(quality, 10, rng),
  };

  const battingStyle: BattingStyle = chance(0.26, rng) ? 'LHB' : 'RHB';

  let bowlingStyle: BowlingStyle | undefined;
  if (role === 'BOWLER' || role === 'ALLROUNDER') {
    bowlingStyle = chance(0.55, rng) ? pick(PACE_STYLES, rng) : pick(SPIN_STYLES, rng);
  } else if (chance(0.4, rng)) {
    bowlingStyle = chance(0.5, rng) ? pick(SPIN_STYLES, rng) : pick(PACE_STYLES, rng);
  }

  const traits: string[] = [];
  if (batting.power >= 78) traits.push('BIG_HITTER');
  if (bowling.variations >= 78 && (role === 'BOWLER' || role === 'ALLROUNDER')) {
    traits.push('DEATH_SPECIALIST');
  }
  if (bowling.paceOrSpin >= 80 && (role === 'BOWLER' || role === 'ALLROUNDER')) {
    traits.push('WICKET_TAKER');
  }
  if (batting.temperament <= 38 && (role === 'BATTER' || role === 'WK_BATTER')) {
    traits.push('FRAGILE');
  }

  const player: Player = {
    id,
    name,
    nationality,
    age,
    role,
    battingStyle,
    bowlingStyle,
    batting,
    bowling,
    fielding,
    meta,
    potential: clamp(quality + randInt(2, 22, rng), 1, 99),
    traits,
    overall: 0,
    isUserPlayer: opts.isUserPlayer,
  };
  player.overall = computeOverall(player);
  return player;
}

/** Balanced 11-man XI in batting order. */
const XI_TEMPLATE: Role[] = [
  'BATTER',
  'BATTER',
  'BATTER',
  'BATTER',
  'WK_BATTER',
  'ALLROUNDER',
  'ALLROUNDER',
  'BOWLER',
  'BOWLER',
  'BOWLER',
  'BOWLER',
];

export function generateSquad(params: {
  nationality: string;
  quality: number;
  idPrefix: string;
  rng: Rng;
}): Player[] {
  const { nationality, quality, idPrefix, rng } = params;
  return XI_TEMPLATE.map((role, i) =>
    generatePlayer({ id: `${idPrefix}-p${i + 1}`, nationality, role, quality, rng }),
  );
}

/** A full 15-man roster (XI + 4 bench) used for club squads. */
const ROSTER_TEMPLATE: Role[] = [...XI_TEMPLATE, 'BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'];
export const ROSTER_SIZE = ROSTER_TEMPLATE.length;
const MANAGER_ROSTER_TEMPLATE: Role[] = [
  ...ROSTER_TEMPLATE,
  'BATTER',
  'BATTER',
  'BOWLER',
  'BOWLER',
  'ALLROUNDER',
  'WK_BATTER',
  'ALLROUNDER',
];
export const MANAGER_ROSTER_SIZE = MANAGER_ROSTER_TEMPLATE.length;

export function generateRoster(params: {
  nationality: string;
  quality: number;
  idPrefix: string;
  rng: Rng;
}): Player[] {
  const { nationality, quality, idPrefix, rng } = params;
  return ROSTER_TEMPLATE.map((role, i) =>
    generatePlayer({ id: `${idPrefix}-p${i + 1}`, nationality, role, quality, rng }),
  );
}

/** A 22-player manager squad built for the three-format workload. */
export function generateManagerRoster(params: {
  nationality: string;
  quality: number;
  idPrefix: string;
  rng: Rng;
}): Player[] {
  const { nationality, quality, idPrefix, rng } = params;
  return MANAGER_ROSTER_TEMPLATE.map((role, i) => {
    const player = generatePlayer({
      id: `${idPrefix}-p${i + 1}`,
      nationality,
      role,
      quality,
      rng,
    });
    player.condition = 100;
    return player;
  });
}

/** A young prospect: low-to-mid current ability but a high hidden ceiling. */
export function generateYouth(params: {
  id: string;
  nationality: string;
  role: Role;
  quality: number;
  rng: Rng;
}): Player {
  const p = generatePlayer({ ...params, age: randInt(16, 19, params.rng) });
  p.potential = clamp(p.overall + randInt(15, 35, params.rng), p.overall, 99);
  return p;
}

/** A pool of unattached players for the transfer market. */
const FA_ROLES: Role[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'];
export function generateFreeAgents(seed: number, count = 24): Player[] {
  const rng = makeRng(seed);
  const nats = COUNTRIES.map((c) => c.id);
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const nationality = nats[Math.floor(rng() * nats.length)];
    const role = FA_ROLES[Math.floor(rng() * FA_ROLES.length)];
    const quality = 48 + Math.floor(rng() * 30);
    out.push(generatePlayer({ id: `fa-${i + 1}`, nationality, role, quality, rng }));
  }
  return out;
}
