import { CareerArchetype, Player, SaveGame } from '../domain/types';
import { clamp } from '../utils/math';
import type { TrainGroup } from './progression';

export interface ArchetypeProfile {
  label: string;
  promise: string;
  pressure: string;
  ending: string;
}

export const ARCHETYPE_PROFILES: Record<CareerArchetype, ArchetypeProfile> = {
  PRODIGY: {
    label: 'Prodigy',
    promise: 'Faster early growth and a shorter route through youth selection.',
    pressure: 'Poor form is judged more harshly and heavy early workloads raise injury risk.',
    ending: 'Did the wonderkid carry expectation all the way to greatness?',
  },
  LATE_BLOOMER: {
    label: 'Late Bloomer',
    promise: 'Slower initial recognition, then stronger development and reputation gains after 23.',
    pressure: 'Selectors need a larger body of evidence before changing their first impression.',
    ending: 'How much did persistence recover from the years others overlooked?',
  },
  SPECIALIST: {
    label: 'Specialist',
    promise: 'Faster development in the role-defining skill and clearer signature performances.',
    pressure: 'Selection is less forgiving when the specialist skill is not deciding matches.',
    ending: 'Did one exceptional craft become the career signature?',
  },
  COMEBACK: {
    label: 'Comeback Story',
    promise: 'Stronger recovery, resilience and reputation protection after setbacks.',
    pressure: 'The opening chapter carries elevated fitness and availability risk.',
    ending: 'How far did the player travel after the career threatened to stop?',
  },
};

function archetype(save: SaveGame): CareerArchetype {
  return save.experience?.playerArchetype ?? 'SPECIALIST';
}

function relationshipLevel(save: SaveGame, id: string): number {
  return save.relationships?.[id]?.level ?? 15;
}

export function ensureArchetypeJourney(save: SaveGame) {
  const experience = (save.experience ??= {});
  return (experience.archetypeJourney ??= {
    highPressureMatches: 0,
    selectionSetbacks: 0,
    injuryReturns: 0,
    signaturePerformances: 0,
  });
}

export function archetypeTrainingMultiplier(
  save: SaveGame,
  player: Player,
  group: TrainGroup,
): number {
  switch (archetype(save)) {
    case 'PRODIGY':
      return player.age <= 20 ? 1.2 : player.age >= 27 ? 0.92 : 1.05;
    case 'LATE_BLOOMER':
      return player.age < 23 ? 0.88 : 1.24;
    case 'COMEBACK':
      return player.meta.fitness < 60 ? 0.92 : 1.15;
    case 'SPECIALIST':
    default: {
      const signature =
        player.role === 'BOWLER' ? 'bowling' : player.role === 'ALLROUNDER' ? undefined : 'batting';
      return signature == null || group === signature ? 1.18 : 0.96;
    }
  }
}

/** Multiplier applied to injury probability, not recovery duration. */
export function archetypeInjuryRisk(save: SaveGame, player: Player): number {
  switch (archetype(save)) {
    case 'PRODIGY':
      return player.age <= 20 ? 1.12 : 1;
    case 'LATE_BLOOMER':
      return 0.9;
    case 'COMEBACK':
      return (save.experience?.archetypeJourney?.injuryReturns ?? 0) > 0 ? 0.82 : 1.2;
    default:
      return 1;
  }
}

/** Form threshold for the selector to leave an established player out. */
export function archetypeDropThreshold(save: SaveGame): number {
  const relationshipAdjustment = Math.round(
    clamp((30 - relationshipLevel(save, 'selector')) / 12, -4, 4),
  );
  const base =
    archetype(save) === 'PRODIGY'
      ? 34
      : archetype(save) === 'LATE_BLOOMER'
        ? 25
        : archetype(save) === 'COMEBACK' &&
            (save.experience?.archetypeJourney?.injuryReturns ?? 0) > 0
          ? 22
          : 28;
  return clamp(base + relationshipAdjustment, 18, 40);
}

export function archetypePathPolicy(save: SaveGame): {
  readiness: number;
  matchAdjustment: number;
  fastTrackAdjustment: number;
} {
  switch (archetype(save)) {
    case 'PRODIGY':
      return { readiness: 0.68, matchAdjustment: -1, fastTrackAdjustment: -3 };
    case 'LATE_BLOOMER':
      return { readiness: 0.8, matchAdjustment: 1, fastTrackAdjustment: 5 };
    case 'COMEBACK':
      return { readiness: 0.74, matchAdjustment: 0, fastTrackAdjustment: 1 };
    default:
      return { readiness: 0.75, matchAdjustment: 0, fastTrackAdjustment: 0 };
  }
}

export function nationalRepDeltaMultiplier(save: SaveGame, player: Player, delta: number): number {
  const selector = relationshipLevel(save, 'selector');
  const relationshipMultiplier = clamp(1 + (selector - 15) / 160, 0.8, 1.25);
  let identityMultiplier = 1;
  switch (archetype(save)) {
    case 'PRODIGY':
      identityMultiplier = delta >= 0 ? 1.22 : 1.15;
      break;
    case 'LATE_BLOOMER':
      identityMultiplier = player.age >= 23 ? 1.22 : 0.82;
      break;
    case 'COMEBACK':
      identityMultiplier = delta >= 0 ? 1.12 : 0.7;
      break;
    default:
      identityMultiplier = 1;
  }
  return identityMultiplier * relationshipMultiplier;
}

export function relationshipContractMultiplier(save: SaveGame): number {
  const agent = relationshipLevel(save, 'agent');
  const coach = relationshipLevel(save, 'coach');
  return clamp(1 + (agent - 15) / 300 + (coach - 15) / 500, 0.88, 1.18);
}

export function recordArchetypeMatch(
  save: SaveGame,
  input: { selected: boolean; rating: number; runs: number; wickets: number; wasInjured: boolean },
): void {
  const journey = ensureArchetypeJourney(save);
  if (!input.selected) journey.selectionSetbacks += 1;
  if (input.rating >= 8) journey.highPressureMatches += 1;
  if (input.runs >= 75 || input.wickets >= 4) journey.signaturePerformances += 1;
  if (input.wasInjured) save.flags['archetype:hadInjury'] = true;
  if (
    save.flags['archetype:hadInjury'] &&
    !input.wasInjured &&
    input.selected &&
    input.rating >= 7 &&
    !save.flags['archetype:recordedReturn']
  ) {
    journey.injuryReturns += 1;
    save.flags['archetype:recordedReturn'] = true;
  }
}

export function archetypeLegacyEnding(save: SaveGame, player: Player): string {
  const journey = ensureArchetypeJourney(save);
  const seasons = save.careerSeasons ?? 0;
  const stats = player.careerStats;
  const headline =
    archetype(save) === 'PRODIGY'
      ? save.capped && seasons >= 8
        ? 'Expectation fulfilled'
        : 'A talent still measured against its promise'
      : archetype(save) === 'LATE_BLOOMER'
        ? save.capped || (stats?.runs ?? 0) >= 4000
          ? 'The career that refused the early verdict'
          : 'Persistence without the final breakthrough'
        : archetype(save) === 'COMEBACK'
          ? journey.injuryReturns > 0
            ? 'The return became greater than the setback'
            : 'A fight that never became an ending'
          : journey.signaturePerformances >= 5
            ? 'A career defined by one exceptional craft'
            : 'A specialist still searching for a signature';
  journey.legacyEnding = headline;
  return headline;
}
