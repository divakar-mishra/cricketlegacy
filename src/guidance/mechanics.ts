export type HandbookCategoryId = 'career' | 'match' | 'club' | 'physicality';

export type GuidanceTopicId =
  | 'career-path'
  | 'selection-formula'
  | 'u19-readiness'
  | 'international-caps'
  | 'pitch-conditions'
  | 'tactical-modifiers'
  | 'format-adaptability'
  | 'scout-confidence'
  | 'first-class-over-rate'
  | 'board-grace'
  | 'ffp-wage-cap'
  | 'facilities'
  | 'first-class-stamina'
  | 'manager-training'
  | 'player-condition'
  | 'condition-and-morale'
  | 'injuries'
  | 'age-development';

export interface HandbookCategory {
  id: HandbookCategoryId;
  label: string;
  icon: 'trending-up' | 'analytics' | 'briefcase' | 'fitness';
}

export interface GuidanceTopic {
  id: GuidanceTopicId;
  category: HandbookCategoryId;
  title: string;
  summary: string;
  bullets: readonly string[];
  keywords: readonly string[];
}

export const HANDBOOK_CATEGORIES: readonly HandbookCategory[] = [
  { id: 'career', label: 'Career', icon: 'trending-up' },
  { id: 'match', label: 'Match', icon: 'analytics' },
  { id: 'club', label: 'Club', icon: 'briefcase' },
  { id: 'physicality', label: 'Physical', icon: 'fitness' },
] as const;

export const GUIDANCE_TOPICS: readonly GuidanceTopic[] = [
  {
    id: 'career-path',
    category: 'career',
    title: 'Career Progression',
    summary: 'Performance drives every step from Grade A cricket to senior caps.',
    bullets: [
      'You begin Grade A cricket at 16. Strong performances can earn Under-19 selection through age 18; from 19, Grade A form can earn a direct domestic contract.',
      'Youth promotion is performance-led. Senior progression moves from Tier 3 through Tier 2 to Tier 1.',
      'International selection is earned through domestic output and reputation, not a fixed number of seasons.',
    ],
    keywords: ['grade a', 'u19', 'domestic', 'tier', 'promotion', 'career'],
  },
  {
    id: 'selection-formula',
    category: 'career',
    title: 'Selection Formula',
    summary: 'Before each domestic fixture, selectors compare you with healthy same-role rivals.',
    bullets: [
      'Base score: Overall 40% + Form 35% + Coach Trust 25%, refined by format readiness and current condition.',
      'A 10.0 match rating adds 20 Form, 15 Confidence and 15 Coach Trust, then guarantees the next appearance.',
      'An injury, a planned rest or critically low condition can still make you unavailable.',
    ],
    keywords: ['selected', 'benched', 'form', 'overall', 'coach trust', 'rating'],
  },
  {
    id: 'u19-readiness',
    category: 'career',
    title: 'U19 Readiness',
    summary: 'Readiness rewards sustained output and strong all-round performances.',
    bullets: [
      'Readiness is 75% match output and 25% average match rating, with at least six U19 appearances normally required.',
      'Full output benchmarks are 320 runs for batters and 16 wickets for bowlers.',
      'All-rounders use 70% of their stronger discipline and 30% of their secondary discipline.',
    ],
    keywords: ['u19', 'readiness', '320 runs', '16 wickets', 'all-rounder'],
  },
  {
    id: 'international-caps',
    category: 'career',
    title: 'International Eligibility',
    summary: 'Eligibility can expand; your first senior cap permanently locks allegiance.',
    bullets: [
      'Birth nationality remains permanently eligible.',
      'Three domestic seasons in another country can add that country as an international option.',
      'You choose between eligible countries before selection; the first senior cap creates a permanent cap-lock.',
    ],
    keywords: ['country', 'nationality', 'international', 'cap lock', 'migration'],
  },
  {
    id: 'pitch-conditions',
    category: 'match',
    title: 'Pitch and Weather',
    summary: 'Conditions shift the balance between batting, pace and spin on every ball.',
    bullets: [
      'Green or overcast conditions support seam movement; dry, dusty and cracked surfaces increasingly reward spin.',
      'Powerplays, death overs and match format add separate scoring and wicket-pressure modifiers.',
      'Conditions affect both teams equally; player attributes and tactics decide who uses them better.',
    ],
    keywords: ['pitch', 'weather', 'green', 'dusty', 'spin', 'pace'],
  },
  {
    id: 'tactical-modifiers',
    category: 'match',
    title: 'Tactical Modifiers',
    summary: 'Plans and fields change ball-outcome probabilities.',
    bullets: [
      'CONTAIN raises dot-ball weight by 14%, cuts four and six weights by 18% and 22%, and lowers wicket weight by 5%.',
      'ATTACK raises wicket weight by 20%, but raises four and six weights by 8% and reduces dot-ball weight by 5%.',
      'Field settings apply another risk-reward layer, while powerplay fielding limits are enforced automatically.',
    ],
    keywords: ['contain', 'attack', 'tactics', 'field', 'dot ball', 'boundary'],
  },
  {
    id: 'format-adaptability',
    category: 'match',
    title: 'Format Adaptability',
    summary: 'Switching between white- and red-ball cricket can temporarily lower match readiness.',
    bullets: [
      'White-ball matches build tempo; First-Class and Test matches build red-ball memory.',
      'Low adaptability increases the temporary penalty when switching between red-ball and white-ball blocks.',
      'Format preparation training improves the relevant readiness before the next fixture.',
    ],
    keywords: ['format', 'adaptability', 'white ball', 'red ball', 'tempo'],
  },
  {
    id: 'scout-confidence',
    category: 'club',
    title: 'Scout Confidence',
    summary:
      'A scout report is an estimate until enough evidence or a full reveal removes uncertainty.',
    bullets: [
      'Confidence is the inverse of report uncertainty. A low-confidence Overall reading can be inaccurate.',
      'Scout the player again to narrow uncertainty; better scouting staff improve the first report and each follow-up.',
      'Full Scout Intelligence reveals exact Overall, fitness, form, injury status and valuation immediately.',
    ],
    keywords: ['scout', 'confidence', 'uncertainty', 'transfer', 'overall'],
  },
  {
    id: 'first-class-over-rate',
    category: 'club',
    title: 'First-Class Over-Rate',
    summary: 'An unbalanced, low-stamina pace attack can cost a league point.',
    bullets: [
      'Selecting four or more pace bowlers with average bowling stamina below 72 triggers a one-point deduction.',
      'Use fewer pacers, include spin, or rotate tired bowlers before a Four-Day Shield fixture.',
      'The deduction applies only to First-Class manager fixtures and appears in the calendar summary.',
    ],
    keywords: ['over rate', 'penalty', 'pace', 'stamina', 'first class', 'points'],
  },
  {
    id: 'board-grace',
    category: 'club',
    title: 'Board Grace Period',
    summary: 'A new appointment gives you time to settle before the board can dismiss you.',
    bullets: [
      'Every new manager appointment resets board confidence to 75.',
      'The first five matches are protected from firing checks, although results still affect the club.',
      'After grace expires, league position, objectives and board confidence determine job security.',
    ],
    keywords: ['board', 'grace', 'confidence', 'sacking', 'job'],
  },
  {
    id: 'ffp-wage-cap',
    category: 'club',
    title: 'Financial Fair Play',
    summary: 'Squad wages cannot grow beyond the club wage ceiling without consequences.',
    bullets: [
      'The FFP ceiling is 125% of the club season wage budget.',
      'Transfer fees and player wages are separate costs; a large transfer budget does not remove the wage limit.',
      'Every prospective signing runs the same wage-ceiling check, regardless of the available transfer budget.',
    ],
    keywords: ['ffp', 'wage', 'budget', 'finance', '125'],
  },
  {
    id: 'facilities',
    category: 'club',
    title: 'Club Facilities',
    summary: 'Facilities improve long-term development, recovery and academy quality.',
    bullets: [
      'Training facilities and coaching quality increase seasonal attribute growth.',
      'Medical facilities and physio quality improve recovery support.',
      'Academy facilities and scout quality raise youth-intake quality; every facility also adds upkeep costs.',
    ],
    keywords: ['facility', 'training', 'medical', 'academy', 'upkeep'],
  },
  {
    id: 'manager-training',
    category: 'club',
    title: 'Training Intensity',
    summary: 'Choose the balance between squad development and recovery.',
    bullets: [
      'Light prioritizes recovery and carries no base training-injury risk.',
      'Normal balances development with condition recovery.',
      'High accelerates development but provides less recovery and increases fatigue risk.',
    ],
    keywords: ['manager', 'training', 'intensity', 'light', 'normal', 'high', 'recovery'],
  },
  {
    id: 'first-class-stamina',
    category: 'physicality',
    title: 'First-Class Workload',
    summary: 'Four-day cricket is the heaviest physical block in the manager calendar.',
    bullets: [
      'Selected pace-bowling players lose about nine net condition per First-Class fixture; spin bowlers and spin all-rounders lose about seven.',
      'Batters lose about two net condition, making bowling depth the main rotation pressure.',
      'Condition below 45 introduces workload-injury risk, provided the club still has enough healthy players.',
    ],
    keywords: ['condition', 'stamina', 'first class', 'pace', 'rotation', 'workload'],
  },
  {
    id: 'player-condition',
    category: 'physicality',
    title: 'Player Match Condition',
    summary: 'Long formats and heavy workloads require planned recovery.',
    bullets: [
      'A First-Class or Test appearance has a 25-point base condition load, plus up to 10 points from balls faced and bowled.',
      'Age-based recovery offsets 6 points through age 22, 4 through age 29, 2 through age 32, and none after that.',
      'Below 65 condition, format readiness receives a growing temporary penalty; planning a rest restores condition without spending match energy.',
    ],
    keywords: ['player condition', 'rest', 'test', 'first class', 'workload', 'energy'],
  },
  {
    id: 'condition-and-morale',
    category: 'physicality',
    title: 'Condition and Morale',
    summary: 'Readiness changes gradually as condition and morale rise or fall.',
    bullets: [
      'Condition below the healthy range applies a growing temporary match penalty rather than a sudden cliff.',
      'Morale adds a smaller positive or negative adjustment across its full range.',
      'Condition is short-term match readiness; fitness is the underlying physical attribute.',
    ],
    keywords: ['condition', 'fitness', 'morale', 'penalty', 'recovery'],
  },
  {
    id: 'injuries',
    category: 'physicality',
    title: 'Injuries and Recovery',
    summary: 'Repeatedly selecting exhausted players increases injury risk.',
    bullets: [
      'First-Class workload can create a two-match strain; shorter-format fatigue strains normally cost one match.',
      'Risk begins below 45 condition and increases as condition falls.',
      'Recovery resources restore condition and fitness but do not instantly heal an existing injury.',
    ],
    keywords: ['injury', 'strain', 'recovery', 'condition', 'heal'],
  },
  {
    id: 'age-development',
    category: 'physicality',
    title: 'Age Development',
    summary: 'Growth slows with age before decline begins.',
    bullets: [
      'Players grow fastest through age 25, then improve more slowly through age 29.',
      'A gradual decline applies from ages 30-32; decline becomes stronger from age 33 onward.',
      'Development contains controlled variation, so individual attributes do not change by identical amounts.',
    ],
    keywords: ['age', 'growth', 'decline', 'development', 'veteran'],
  },
] as const;

const TOPIC_BY_ID = Object.fromEntries(GUIDANCE_TOPICS.map((topic) => [topic.id, topic])) as Record<
  GuidanceTopicId,
  GuidanceTopic
>;

export function getGuidanceTopic(id: GuidanceTopicId): GuidanceTopic {
  return TOPIC_BY_ID[id];
}

export function guidanceModalMessage(topic: GuidanceTopic): string {
  return [topic.summary, '', ...topic.bullets.slice(0, 3).map((item) => `- ${item}`)].join('\n');
}

export function searchGuidanceTopics(
  query: string,
  category?: HandbookCategoryId,
): GuidanceTopic[] {
  const normalized = query.trim().toLowerCase();
  return GUIDANCE_TOPICS.filter((topic) => {
    if (!normalized) return !category || topic.category === category;
    const haystack = [topic.title, topic.summary, ...topic.bullets, ...topic.keywords]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
