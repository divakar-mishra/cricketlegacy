/**
 * Batting intent — the player's per-delivery decision in the advanced text match.
 * Maps a human choice to the engine's 0..1 aggression scalar (consumed by resolveBall).
 */
import { FORMATS } from '../data/gameConfig';
import { Format } from '../domain/types';

export type Intent = 'BLOCK' | 'ROTATE' | 'ATTACK' | 'BIG';

export interface IntentOption {
  value: Intent;
  label: string;
  desc: string;
  emoji: string;
  aggression: number;
}

export const INTENT_OPTIONS: IntentOption[] = [
  { value: 'BLOCK', label: 'Defend', desc: 'Protect your wicket', emoji: '🛡️', aggression: 0.1 },
  { value: 'ROTATE', label: 'Rotate', desc: 'Work the gaps', emoji: '🔁', aggression: 0.42 },
  { value: 'ATTACK', label: 'Attack', desc: 'Hunt boundaries', emoji: '⚡', aggression: 0.72 },
  { value: 'BIG', label: 'Go Big', desc: 'Swing hard — high risk', emoji: '💥', aggression: 0.95 },
];

const BY_VALUE: Record<Intent, IntentOption> = INTENT_OPTIONS.reduce(
  (acc, o) => {
    acc[o.value] = o;
    return acc;
  },
  {} as Record<Intent, IntentOption>,
);

export function intentToAggression(intent: Intent): number {
  return BY_VALUE[intent]?.aggression ?? 0.42;
}

/** Bowling plan — the player's per-over decision when they have the ball. */
export type BowlerPlan = 'ATTACK' | 'CONTAIN' | 'VARY';

export interface BowlerPlanOption {
  value: BowlerPlan;
  label: string;
  desc: string;
  emoji: string;
}

export const BOWLER_PLAN_OPTIONS: BowlerPlanOption[] = [
  { value: 'ATTACK', label: 'Attack', desc: 'Hunt wickets — leaks runs', emoji: '🎯' },
  { value: 'CONTAIN', label: 'Contain', desc: 'Dry up the runs', emoji: '🧱' },
  { value: 'VARY', label: 'Mix it up', desc: 'Variations to deceive', emoji: '🌀' },
];

/** Field setting (manager tactic). Attacking fields take more wickets but leak boundaries. */
export type FieldSetting = 'CATCHING' | 'ATTACKING' | 'BALANCED' | 'DEFENSIVE' | 'SWEEPER';

export interface FieldOption {
  value: FieldSetting;
  label: string;
  desc: string;
  emoji: string;
  fieldersOutside: number;
}

export const FIELD_OPTIONS: FieldOption[] = [
  {
    value: 'CATCHING',
    label: 'All-Out Attack',
    desc: '0 outside · slips and close catchers',
    emoji: '🔥',
    fieldersOutside: 0,
  },
  {
    value: 'ATTACKING',
    label: 'Attacking',
    desc: '2 outside · legal in every phase',
    emoji: '🎯',
    fieldersOutside: 2,
  },
  {
    value: 'BALANCED',
    label: 'Balanced',
    desc: '3 outside · middle/death overs',
    emoji: '⚖️',
    fieldersOutside: 3,
  },
  {
    value: 'DEFENSIVE',
    label: 'Defensive',
    desc: '5 outside · protect the rope',
    emoji: '🛡️',
    fieldersOutside: 5,
  },
  {
    value: 'SWEEPER',
    label: 'Boundary Protection',
    desc: '5 outside · trade singles for fewer boundaries',
    emoji: '🧱',
    fieldersOutside: 5,
  },
];

export interface FieldRestriction {
  phase: 'POWERPLAY' | 'MIDDLE' | 'DEATH' | 'UNRESTRICTED';
  maxOutside: number;
  label: string;
}

export function fieldRestriction(format: Format, over: number): FieldRestriction {
  if (format === 'TEST') {
    return { phase: 'UNRESTRICTED', maxOutside: 9, label: 'No circle restriction' };
  }
  const powerplayOvers = FORMATS[format].powerplayOvers;
  if (over < powerplayOvers) {
    return { phase: 'POWERPLAY', maxOutside: 2, label: `Powerplay · max 2 outside` };
  }
  if (format === 'ODI' && over < 40) {
    return { phase: 'MIDDLE', maxOutside: 4, label: 'Middle overs · max 4 outside' };
  }
  return {
    phase: over >= FORMATS[format].overs * 0.8 ? 'DEATH' : 'MIDDLE',
    maxOutside: 5,
    label: `${over >= FORMATS[format].overs * 0.8 ? 'Death' : 'Middle'} overs · max 5 outside`,
  };
}

export function isFieldSettingLegal(setting: FieldSetting, format: Format, over: number): boolean {
  const option = FIELD_OPTIONS.find((item) => item.value === setting);
  return Boolean(option && option.fieldersOutside <= fieldRestriction(format, over).maxOutside);
}

export function legalFieldSetting(
  setting: FieldSetting | undefined,
  format: Format,
  over: number,
): FieldSetting | undefined {
  if (!setting || isFieldSettingLegal(setting, format, over)) return setting;
  return 'ATTACKING';
}

/** Outcome-weight multipliers for a field setting (BALANCED = no-op). */
export interface FieldEffect {
  four: number;
  six: number;
  dot: number;
  wicket: number;
  one: number;
}

export const FIELD_EFFECTS: Record<FieldSetting, FieldEffect> = {
  CATCHING: { four: 1.12, six: 1.06, dot: 0.9, wicket: 1.22, one: 0.98 },
  ATTACKING: { four: 1.06, six: 1.04, dot: 0.96, wicket: 1.1, one: 1.0 },
  BALANCED: { four: 1, six: 1, dot: 1, wicket: 1, one: 1 },
  DEFENSIVE: { four: 0.9, six: 0.88, dot: 1.08, wicket: 0.96, one: 1.04 },
  SWEEPER: { four: 0.8, six: 0.82, dot: 1.02, wicket: 0.94, one: 1.16 },
};

/** Team-level batting approach (manager tactic). Biases every batter's aggression. */
export type TeamApproach = 'DEFENSIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface TeamApproachOption {
  value: TeamApproach;
  label: string;
  desc: string;
  bias: number;
}

export const TEAM_APPROACH_OPTIONS: TeamApproachOption[] = [
  { value: 'DEFENSIVE', label: 'Defensive', desc: 'Preserve wickets, build slowly', bias: -0.12 },
  { value: 'BALANCED', label: 'Balanced', desc: 'Play the situation', bias: 0 },
  { value: 'AGGRESSIVE', label: 'Aggressive', desc: 'Attack from the off', bias: 0.12 },
];

export function approachBias(a: TeamApproach): number {
  return TEAM_APPROACH_OPTIONS.find((o) => o.value === a)?.bias ?? 0;
}
