import { BattingAttrs, BowlingAttrs, FieldingAttrs, MentalPhysical } from '../domain/types';

/** Attribute metadata used by the creation UI (form is dynamic, not allocated). */
export const ATTR_META = {
  batting: [
    ['technique', 'Technique'],
    ['timing', 'Timing'],
    ['power', 'Power'],
    ['footwork', 'Footwork'],
    ['temperament', 'Temperament'],
    ['running', 'Running'],
  ] as [keyof BattingAttrs, string][],
  bowling: [
    ['paceOrSpin', 'Pace / Spin'],
    ['accuracy', 'Accuracy'],
    ['movement', 'Movement'],
    ['variations', 'Variations'],
    ['stamina', 'Stamina'],
  ] as [keyof BowlingAttrs, string][],
  fielding: [
    ['catching', 'Catching'],
    ['throwing', 'Throwing'],
    ['agility', 'Agility'],
    ['keeping', 'Keeping'],
  ] as [keyof FieldingAttrs, string][],
  meta: [
    ['fitness', 'Fitness'],
    ['confidence', 'Confidence'],
    ['aggression', 'Aggression'],
    ['discipline', 'Discipline'],
  ] as [keyof Omit<MentalPhysical, 'form'>, string][],
};

export const CREATION = {
  base: 35,
  budget: 230,
  maxPerAttr: 90,
  startForm: 60,
};

/** Training (career mode): a coin sink that steadily improves a chosen discipline. */
export const TRAINING = {
  baseCost: 250, // coins for the first session of a season
  costGrowth: 150, // added per session already done this season
  maxSessionsPerSeason: 6,
  gainMin: 1,
  gainMax: 3,
  attrsPerSession: 2, // improves the 2 weakest attributes in the focus group
  attrCeiling: 99,
};

export const ATTR_GROUPS: { id: keyof typeof ATTR_META; label: string }[] = [
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'fielding', label: 'Fielding & Keeping' },
  { id: 'meta', label: 'Mental & Physical' },
];
