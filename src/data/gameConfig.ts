import { Conditions, Format } from '../domain/types';

/* =========================================================================
 * MATCH ENGINE CONFIG (PART 3) — all balance lives here, never in the engine.
 * ========================================================================= */

export interface FormatConfig {
  label: string;
  /** Overs per innings (soft cap for TEST). */
  overs: number;
  ballsPerOver: number;
  inningsPerSide: number;
  maxOversPerBowler: number;
  /** Number of powerplay overs where the new ball swings / field is up. */
  powerplayOvers: number;
}

export const FORMATS: Record<Format, FormatConfig> = {
  T20: {
    label: 'T20',
    overs: 20,
    ballsPerOver: 6,
    inningsPerSide: 1,
    maxOversPerBowler: 4,
    powerplayOvers: 6,
  },
  ODI: {
    label: 'ODI',
    overs: 50,
    ballsPerOver: 6,
    inningsPerSide: 1,
    maxOversPerBowler: 10,
    powerplayOvers: 10,
  },
  TEST: {
    label: 'Test',
    overs: 450,
    ballsPerOver: 6,
    inningsPerSide: 2,
    maxOversPerBowler: 999,
    powerplayOvers: 0,
  },
  HUNDRED: {
    label: 'The Hundred',
    overs: 20,
    ballsPerOver: 5,
    inningsPerSide: 1,
    maxOversPerBowler: 4,
    powerplayOvers: 5,
  },
  T10: {
    label: 'T10',
    overs: 10,
    ballsPerOver: 6,
    inningsPerSide: 1,
    maxOversPerBowler: 2,
    powerplayOvers: 3,
  },
};

/** Relative base weights for a legal-ball outcome (extras handled separately). */
export interface BallWeights {
  DOT: number;
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '6': number;
  W: number;
}

export const BALL_WEIGHTS: Record<Format, BallWeights> = {
  // NOTE: the base W weight is tuned *below* the observed wicket rate because the
  // delivery-type model (engine/deliveries.ts) adds a net wicket lift from
  // variations, and run-outs (engine/resolveBall.ts) add ~0.5–1.0 more per
  // innings on top. These weights keep every format in its Monte-Carlo band.
  T20: { DOT: 35, '1': 33, '2': 6.5, '3': 0.5, '4': 13.5, '6': 6.2, W: 4.2 },
  // ODI/TEST carry a much lower per-ball wicket weight: across 300+ (ODI) and
  // 540 (Test day) balls even a modest rate compounds to "all out every game",
  // so these are tuned so ~6-7 wickets fall in an ODI and sides are not
  // routinely bowled out inside a Test's over budget (→ realistic draw rate).
  ODI: { DOT: 46.5, '1': 33.5, '2': 7.5, '3': 0.7, '4': 9.6, '6': 3.3, W: 1.95 },
  TEST: { DOT: 66, '1': 21, '2': 5.5, '3': 0.4, '4': 8.5, '6': 1.1, W: 1.35 },
  HUNDRED: { DOT: 33, '1': 33, '2': 6.5, '3': 0.5, '4': 14.5, '6': 6.8, W: 4.4 },
  T10: { DOT: 29, '1': 31, '2': 6.5, '3': 0.4, '4': 17, '6': 9.5, W: 5.4 },
};

/** Chance a delivery is an extra (adds a run + is re-bowled, no legal ball counted). */
export const EXTRAS = {
  wideRate: 0.028,
  noBallRate: 0.011,
  /** Chance a legal ball becomes byes/leg-byes (counts as a ball, runs are extras). */
  byeRate: 0.006,
  legByeRate: 0.012,
};

export interface WeightModifier {
  boundary: number; // multiplies 4/6 weights
  dot: number; // multiplies DOT weight
  wicket: number; // multiplies W weight
}

export const PITCH_MODIFIERS: Record<Conditions['pitch'], WeightModifier> = {
  GREEN: { boundary: 0.9, dot: 1.1, wicket: 1.28 },
  DRY: { boundary: 1.0, dot: 1.0, wicket: 1.0 },
  DUSTY: { boundary: 0.92, dot: 1.08, wicket: 1.2 },
  FLAT: { boundary: 1.13, dot: 0.88, wicket: 0.82 },
  CRACKED: { boundary: 0.95, dot: 1.05, wicket: 1.32 },
};

export const WEATHER_MODIFIERS: Record<Conditions['weather'], WeightModifier> = {
  CLEAR: { boundary: 1.0, dot: 1.0, wicket: 1.0 },
  OVERCAST: { boundary: 0.93, dot: 1.08, wicket: 1.22 },
  HUMID: { boundary: 0.97, dot: 1.03, wicket: 1.09 },
};

/* =========================================================================
 * ECONOMY (PART 4) — starting values & faucet/sink constants.
 * ========================================================================= */
export const ECONOMY = {
  startingCoins: 750,
  startingGems: 0,
  energyMax: 36,
  energyRegenMinutes: 5,
  energyPerMatch: 4,
  /**
   * Base coins awarded for a match by result. Single source of truth consumed
   * by {@link matchReward} in game/economy.ts (previously these values were
   * hardcoded there and drifted from config — keep them here only).
   */
  matchCoins: { win: 240, tie: 140, loss: 90 },
  /**
   * Manager Wallet Coins fund personal services, not club operations. These
   * are half the former faucet so a no-spend 25-season career does not build a
   * largely unusable 290k balance; rewarded ads can still double a fixture.
   */
  managerMatchCoins: { win: 160, tie: 90, loss: 60 },
  /** Match-coin multiplier for VIP (permanent removeAds) holders — the
   *  advertised "+20% coins every match" perk. */
  vipCoinMultiplier: 1.2,
  /** Energy cap for VIP holders (vs {@link energyMax} for everyone else). */
  vipEnergyMax: 60,
};
