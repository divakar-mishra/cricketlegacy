/**
 * Legacy Fund — a late-game COIN SINK.
 *
 * Cricket careers mint coins faster than the training/stock/academy sinks can
 * absorb them, so wealthy veterans end up sitting on idle piles (which also
 * kills demand for coin IAPs). The Legacy Fund gives those coins a purpose:
 * players spend them on prestige contributions that build a permanent "Legacy"
 * rank. It is deliberately PURE VANITY — legacy points grant no gameplay or
 * income benefit, so this can never turn into a coin faucet loop, and it does
 * not compete with the gem-based cosmetic sinks (gems still own the exclusive
 * look tier). Contributions are one-time (tracked in `save.inventory`).
 */
export interface LegacyTier {
  id: string;
  label: string;
  description: string;
  /** One-time coin cost. Escalates steeply to soak large late-game balances. */
  coinCost: number;
  /** Prestige points added to `save.legacyPoints` on funding. */
  points: number;
  icon: string;
}

export const LEGACY_TIERS: readonly LegacyTier[] = [
  {
    id: 'legacy_academy_wing',
    label: 'Academy Wing',
    description: 'Fund a youth academy wing in your name.',
    coinCost: 25_000,
    points: 10,
    icon: '🏫',
  },
  {
    id: 'legacy_scholarship',
    label: 'Scholarship Fund',
    description: 'Endow scholarships for promising young cricketers.',
    coinCost: 75_000,
    points: 30,
    icon: '🎓',
  },
  {
    id: 'legacy_stand',
    label: 'Stadium Stand',
    description: 'Have a stand at the home ground named after you.',
    coinCost: 200_000,
    points: 75,
    icon: '🏟️',
  },
  {
    id: 'legacy_foundation',
    label: 'Charitable Foundation',
    description: 'Launch a foundation that grows the game grassroots-up.',
    coinCost: 500_000,
    points: 175,
    icon: '🤝',
  },
  {
    id: 'legacy_statue',
    label: 'Bronze Statue',
    description: 'A statue of you unveiled outside the stadium gates.',
    coinCost: 1_000_000,
    points: 400,
    icon: '🗿',
  },
  {
    id: 'legacy_museum',
    label: 'National Cricket Museum',
    description: 'Bankroll a national museum of the game.',
    coinCost: 2_500_000,
    points: 1_000,
    icon: '🏛️',
  },
];

/** Legacy rank ladder — the highest title whose threshold the player has passed. */
export const LEGACY_RANKS: readonly { min: number; title: string }[] = [
  { min: 0, title: 'Rising Name' },
  { min: 10, title: 'Community Patron' },
  { min: 50, title: 'Regional Benefactor' },
  { min: 150, title: 'National Icon' },
  { min: 500, title: 'Cricketing Statesman' },
  { min: 1_500, title: 'Immortal Legend' },
];

/** The player's current Legacy rank title for a given points total. */
export function legacyRank(points: number): string {
  let title = LEGACY_RANKS[0].title;
  for (const r of LEGACY_RANKS) {
    if (points >= r.min) title = r.title;
  }
  return title;
}
