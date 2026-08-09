/**
 * Achievement catalog and unlock logic.
 *
 * 60 achievements spanning batting, bowling, career milestones, team success,
 * life events, streaks, and meta. Definitions are pure data; the unlock check
 * helpers consume a SaveGame snapshot and are called from careerStore at key
 * moments (post-match, season rollover, training, retirement).
 *
 * `checkAchievements` returns every newly-unlocked achievement id so the store
 * can surface a toast immediately.
 */
import { PlayerStats, SaveGame } from '../domain/types';
import { unlockAchievement } from './narrative';

// ── Tiers ───────────────────────────────────────────────────────────────────
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Gems are deliberately scarce and are earned almost entirely by achievements,
 * so they feel prestigious rather than handed out for routine tasks. The reward
 * scales with the achievement tier.
 */
export function achievementGemReward(tier: AchievementTier): number {
  switch (tier) {
    case 'bronze':
      return 2;
    case 'silver':
      return 5;
    case 'gold':
      return 12;
    case 'platinum':
      return 30;
    default:
      return 0;
  }
}

// ── Definition ───────────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  category: 'batting' | 'bowling' | 'allround' | 'career' | 'team' | 'life' | 'meta';
  /** Hidden until unlocked (shown as "???" in the UI). */
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── BATTING ──────────────────────────────────────────────────────────────
  {
    id: 'bat_first_run',
    title: 'Off the Mark',
    description: 'Score your first run in a career match.',
    icon: '🏏',
    tier: 'bronze',
    category: 'batting',
  },
  {
    id: 'bat_first_fifty',
    title: 'Half Century',
    description: 'Score 50+ runs in a match.',
    icon: '5️⃣0️⃣',
    tier: 'bronze',
    category: 'batting',
  },
  {
    id: 'bat_first_hundred',
    title: 'Century Club',
    description: 'Score a century (100+) in a match.',
    icon: '💯',
    tier: 'silver',
    category: 'batting',
  },
  {
    id: 'bat_double_ton',
    title: 'Double Glory',
    description: 'Score 200+ in a single Test innings.',
    icon: '2️⃣0️⃣0️⃣',
    tier: 'gold',
    category: 'batting',
    hidden: true,
  },
  {
    id: 'bat_1000_runs',
    title: 'Run Machine',
    description: 'Accumulate 1 000 career runs.',
    icon: '📊',
    tier: 'silver',
    category: 'batting',
  },
  {
    id: 'bat_5000_runs',
    title: 'Elite Batter',
    description: 'Accumulate 5 000 career runs.',
    icon: '📈',
    tier: 'gold',
    category: 'batting',
  },
  {
    id: 'bat_10000_runs',
    title: 'Immortal',
    description: '10 000 career runs — a truly legendary feat.',
    icon: '🏆',
    tier: 'platinum',
    category: 'batting',
    hidden: true,
  },
  {
    id: 'bat_50_fours',
    title: 'Boundary King',
    description: 'Hit 50 career fours.',
    icon: '4️⃣',
    tier: 'bronze',
    category: 'batting',
  },
  {
    id: 'bat_100_fours',
    title: 'Fence Finder',
    description: 'Hit 100 career fours.',
    icon: '🚀',
    tier: 'silver',
    category: 'batting',
  },
  {
    id: 'bat_30_sixes',
    title: 'Big Hitter',
    description: 'Hit 30 career sixes.',
    icon: '💥',
    tier: 'silver',
    category: 'batting',
  },
  {
    id: 'bat_100_sixes',
    title: 'Maximum Machine',
    description: 'Hit 100 career sixes.',
    icon: '🎆',
    tier: 'gold',
    category: 'batting',
    hidden: true,
  },
  {
    id: 'bat_5_hundreds',
    title: 'Centurion',
    description: 'Score 5 career centuries.',
    icon: '⭐',
    tier: 'gold',
    category: 'batting',
  },

  // ── BOWLING ──────────────────────────────────────────────────────────────
  {
    id: 'bowl_first_wicket',
    title: 'First Blood',
    description: 'Take your first wicket.',
    icon: '🎯',
    tier: 'bronze',
    category: 'bowling',
  },
  {
    id: 'bowl_five_fer',
    title: 'Five-fer',
    description: 'Take 5+ wickets in an innings.',
    icon: '🔥',
    tier: 'silver',
    category: 'bowling',
  },
  {
    id: 'bowl_ten_fer',
    title: 'Ten Wicket Match',
    description: 'Take 10+ wickets in a Test match.',
    icon: '💣',
    tier: 'gold',
    category: 'bowling',
    hidden: true,
  },
  {
    id: 'bowl_100_wickets',
    title: 'Wicket Machine',
    description: 'Take 100 career wickets.',
    icon: '🎳',
    tier: 'silver',
    category: 'bowling',
  },
  {
    id: 'bowl_300_wickets',
    title: 'Strike Force',
    description: 'Take 300 career wickets.',
    icon: '⚡',
    tier: 'gold',
    category: 'bowling',
  },
  {
    id: 'bowl_500_wickets',
    title: 'All-Time Great',
    description: '500 career wickets. A bowling legend.',
    icon: '👑',
    tier: 'platinum',
    category: 'bowling',
    hidden: true,
  },
  {
    id: 'bowl_10_fivers',
    title: 'Firestarter',
    description: 'Take 10 career five-wicket hauls.',
    icon: '🔥',
    tier: 'gold',
    category: 'bowling',
    hidden: true,
  },

  // ── ALL-ROUND ─────────────────────────────────────────────────────────────
  {
    id: 'ar_match_double',
    title: 'Match Double',
    description: 'Score 50+ runs AND take 3+ wickets in one match.',
    icon: '🌟',
    tier: 'silver',
    category: 'allround',
  },
  {
    id: 'ar_1000_100',
    title: 'The Complete Cricketer',
    description: 'Reach 1 000 runs and 100 wickets in a career.',
    icon: '🏅',
    tier: 'gold',
    category: 'allround',
  },
  {
    id: 'ar_potm',
    title: 'Player of the Match',
    description: 'Win a Player of the Match award.',
    icon: '🥇',
    tier: 'bronze',
    category: 'allround',
  },
  {
    id: 'ar_5_potm',
    title: 'Match Winner',
    description: 'Win 5 Player of the Match awards.',
    icon: '🏆',
    tier: 'silver',
    category: 'allround',
  },

  // ── CAREER PROGRESSION ───────────────────────────────────────────────────
  {
    id: 'career_domestic',
    title: 'Domestic Pro',
    description: 'Reach the Domestic tier.',
    icon: '📋',
    tier: 'bronze',
    category: 'career',
  },
  {
    id: 'career_franchise',
    title: 'Franchise Star',
    description: 'Reach the Franchise tier.',
    icon: '💼',
    tier: 'silver',
    category: 'career',
  },
  {
    id: 'career_intl_debut',
    title: 'Cap Number',
    description: 'Earn your first national cap.',
    icon: '🧢',
    tier: 'silver',
    category: 'career',
  },
  {
    id: 'career_50_caps',
    title: 'International Icon',
    description: 'Earn 50 national caps.',
    icon: '🌍',
    tier: 'gold',
    category: 'career',
  },
  {
    id: 'career_100_caps',
    title: 'Centurion of Caps',
    description: 'Earn 100 national caps — a true great.',
    icon: '👑',
    tier: 'platinum',
    category: 'career',
    hidden: true,
  },
  {
    id: 'career_legend',
    title: 'Legend',
    description: 'Reach the Legend tier.',
    icon: '🌟',
    tier: 'platinum',
    category: 'career',
    hidden: true,
  },
  {
    id: 'career_captain',
    title: 'Skipper',
    description: 'Be named club captain.',
    icon: '⭐',
    tier: 'silver',
    category: 'career',
  },
  {
    id: 'career_nat_captain',
    title: 'National Captain',
    description: 'Lead your country.',
    icon: '🏆',
    tier: 'gold',
    category: 'career',
    hidden: true,
  },
  {
    id: 'career_comeback',
    title: 'Comeback Kid',
    description: 'Return from an injury and score 50+ in next match.',
    icon: '💪',
    tier: 'silver',
    category: 'career',
    hidden: true,
  },
  {
    id: 'career_long',
    title: 'Evergreen',
    description: 'Play a career spanning 15+ seasons.',
    icon: '🌳',
    tier: 'gold',
    category: 'career',
    hidden: true,
  },
  {
    id: 'career_ngp',
    title: 'Legacy Continues',
    description: 'Retire and begin a New Game+ (protégé).',
    icon: '🌱',
    tier: 'gold',
    category: 'career',
  },

  // ── TEAM SUCCESS ─────────────────────────────────────────────────────────
  {
    id: 'team_league_win',
    title: 'Champions',
    description: 'Win a league title.',
    icon: '🏆',
    tier: 'silver',
    category: 'team',
  },
  {
    id: 'team_cup_win',
    title: 'Cup Hero',
    description: 'Win the domestic cup.',
    icon: '🥇',
    tier: 'silver',
    category: 'team',
  },
  {
    id: 'team_continental',
    title: 'Continental Kings',
    description: 'Win the Continental Cup.',
    icon: '🌍',
    tier: 'gold',
    category: 'team',
  },
  {
    id: 'team_double',
    title: 'The Double',
    description: 'Win the league AND cup in the same season.',
    icon: '🌟',
    tier: 'gold',
    category: 'team',
    hidden: true,
  },
  {
    id: 'team_3_titles',
    title: 'Dynasty',
    description: 'Win 3 or more league titles.',
    icon: '👑',
    tier: 'gold',
    category: 'team',
    hidden: true,
  },
  {
    id: 'team_unbeaten',
    title: 'Invincibles',
    description: 'Go through a full season without losing.',
    icon: '💎',
    tier: 'platinum',
    category: 'team',
    hidden: true,
  },

  // ── LIFE & NARRATIVE ──────────────────────────────────────────────────────
  {
    id: 'life_first_sponsor',
    title: 'Brand Ambassador',
    description: 'Sign your first sponsorship deal.',
    icon: '💰',
    tier: 'bronze',
    category: 'life',
  },
  {
    id: 'life_global_deal',
    title: 'Global Icon',
    description: 'Sign a Global-tier sponsorship.',
    icon: '🌐',
    tier: 'gold',
    category: 'life',
    hidden: true,
  },
  {
    id: 'life_integrity',
    title: 'Man of Honour',
    description: 'Maintain 90+ integrity for 5 seasons.',
    icon: '🤝',
    tier: 'silver',
    category: 'life',
    hidden: true,
  },
  {
    id: 'life_brand_80',
    title: 'Fan Favourite',
    description: 'Reach a brand value of 80.',
    icon: '❤️',
    tier: 'silver',
    category: 'life',
  },
  {
    id: 'life_auction',
    title: 'Going Once…',
    description: 'Accept a franchise auction offer.',
    icon: '🔨',
    tier: 'silver',
    category: 'life',
  },
  {
    id: 'life_rivalry',
    title: 'Fierce Rivals',
    description: 'Build an intense rivalry over 3+ seasons.',
    icon: '⚔️',
    tier: 'silver',
    category: 'life',
    hidden: true,
  },

  // ── META / GRIND ─────────────────────────────────────────────────────────
  {
    id: 'meta_100_matches',
    title: 'Veteran',
    description: 'Play 100 career matches.',
    icon: '🎖️',
    tier: 'silver',
    category: 'meta',
  },
  {
    id: 'meta_500_matches',
    title: 'Iron Man',
    description: 'Play 500 career matches.',
    icon: '🦾',
    tier: 'gold',
    category: 'meta',
    hidden: true,
  },
  {
    id: 'meta_10_wins',
    title: 'Winner',
    description: 'Win 10 career matches.',
    icon: '✅',
    tier: 'bronze',
    category: 'meta',
  },
  {
    id: 'meta_50_wins',
    title: 'On a Roll',
    description: 'Win 50 career matches.',
    icon: '🔥',
    tier: 'silver',
    category: 'meta',
  },
  {
    id: 'meta_streak_5',
    title: 'Five in a Row',
    description: 'Win 5 consecutive matches.',
    icon: '5️⃣',
    tier: 'silver',
    category: 'meta',
    hidden: true,
  },
  {
    id: 'meta_streak_10',
    title: 'Unstoppable',
    description: 'Win 10 consecutive matches.',
    icon: '💫',
    tier: 'gold',
    category: 'meta',
    hidden: true,
  },
  {
    id: 'meta_login_7',
    title: 'Dedicated',
    description: 'Log in 7 days in a row.',
    icon: '📅',
    tier: 'bronze',
    category: 'meta',
  },
  {
    id: 'meta_login_30',
    title: 'Devoted',
    description: 'Log in 30 days in a row.',
    icon: '🗓️',
    tier: 'silver',
    category: 'meta',
    hidden: true,
  },
  {
    id: 'meta_train_10',
    title: 'Gym Rat',
    description: 'Complete 10 training sessions in a season.',
    icon: '🏋️',
    tier: 'bronze',
    category: 'meta',
  },
  {
    id: 'meta_world_record',
    title: 'World Beater',
    description: 'Hold the all-time highest score record in your world.',
    icon: '📜',
    tier: 'platinum',
    category: 'meta',
    hidden: true,
  },
];

// ── Achievement point values ────────────────────────────────────────────────
/** Points awarded per tier — the "Gamerscore" system. */
export const TIER_POINTS: Record<AchievementTier, number> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
};

export function getTierPoints(tier: AchievementTier): number {
  return TIER_POINTS[tier];
}

/** Total Gamerscore possible across all 60 achievements. */
export const MAX_GAMERSCORE: number = ACHIEVEMENTS.reduce((sum, a) => sum + TIER_POINTS[a.tier], 0);

const MANAGER_META_ACHIEVEMENTS = new Set([
  'meta_100_matches',
  'meta_500_matches',
  'meta_10_wins',
  'meta_50_wins',
  'meta_streak_5',
  'meta_streak_10',
  'meta_login_7',
  'meta_login_30',
]);

export function achievementsForMode(save: Pick<SaveGame, 'mode'>): AchievementDef[] {
  if (save.mode === 'career') return ACHIEVEMENTS;
  return ACHIEVEMENTS.filter(
    (achievement) =>
      achievement.category === 'team' || MANAGER_META_ACHIEVEMENTS.has(achievement.id),
  );
}

export function maxGamerscore(save: Pick<SaveGame, 'mode'>): number {
  return achievementsForMode(save).reduce((sum, a) => sum + TIER_POINTS[a.tier], 0);
}

/** Gamerscore earned so far in this save. */
export function totalGamerscore(save: SaveGame): number {
  const earned = new Set(save.achievements ?? []);
  return achievementsForMode(save).reduce(
    (sum, a) => (earned.has(a.id) ? sum + TIER_POINTS[a.tier] : sum),
    0,
  );
}

// ── Lookup helpers ────────────────────────────────────────────────────────────
const BY_ID = new Map<string, AchievementDef>(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): AchievementDef | undefined {
  return BY_ID.get(id);
}

/** All achievements the player already has in this save. */
export function earnedAchievements(save: SaveGame): AchievementDef[] {
  const earned = new Set(save.achievements ?? []);
  return achievementsForMode(save).filter((achievement) => earned.has(achievement.id));
}

/** All achievements NOT yet earned. */
export function pendingAchievements(save: SaveGame): AchievementDef[] {
  const earned = new Set(save.achievements ?? []);
  return achievementsForMode(save).filter((a) => !earned.has(a.id));
}

// ── Partial progress helpers ──────────────────────────────────────────────────
/** 0..1 progress toward an achievement that has a numeric gate. Returns null for binary ones. */
export function achievementProgress(save: SaveGame, id: string): number | null {
  const cs: PlayerStats | undefined = save.userPlayerId
    ? save.players[save.userPlayerId]?.careerStats
    : undefined;
  switch (id) {
    case 'bat_1000_runs':
      return cs ? Math.min(1, cs.runs / 1000) : null;
    case 'bat_5000_runs':
      return cs ? Math.min(1, cs.runs / 5000) : null;
    case 'bat_10000_runs':
      return cs ? Math.min(1, cs.runs / 10000) : null;
    case 'bat_50_fours':
      return cs ? Math.min(1, cs.fours / 50) : null;
    case 'bat_100_fours':
      return cs ? Math.min(1, cs.fours / 100) : null;
    case 'bat_30_sixes':
      return cs ? Math.min(1, cs.sixes / 30) : null;
    case 'bat_100_sixes':
      return cs ? Math.min(1, cs.sixes / 100) : null;
    case 'bat_5_hundreds':
      return cs ? Math.min(1, cs.hundreds / 5) : null;
    case 'bowl_100_wickets':
      return cs ? Math.min(1, cs.wickets / 100) : null;
    case 'bowl_300_wickets':
      return cs ? Math.min(1, cs.wickets / 300) : null;
    case 'bowl_500_wickets':
      return cs ? Math.min(1, cs.wickets / 500) : null;
    case 'meta_100_matches': {
      const matches =
        save.mode === 'manager'
          ? (save.careerWins ?? 0) + (save.careerLosses ?? 0) + (save.careerDraws ?? 0)
          : cs?.matches;
      return matches != null ? Math.min(1, matches / 100) : null;
    }
    case 'meta_500_matches': {
      const matches =
        save.mode === 'manager'
          ? (save.careerWins ?? 0) + (save.careerLosses ?? 0) + (save.careerDraws ?? 0)
          : cs?.matches;
      return matches != null ? Math.min(1, matches / 500) : null;
    }
    case 'meta_10_wins':
      return save.careerWins != null ? Math.min(1, save.careerWins / 10) : null;
    case 'meta_50_wins':
      return save.careerWins != null ? Math.min(1, save.careerWins / 50) : null;
    case 'career_50_caps':
      return save.userCaps != null ? Math.min(1, save.userCaps / 50) : null;
    case 'career_100_caps':
      return save.userCaps != null ? Math.min(1, save.userCaps / 100) : null;
    default:
      return null;
  }
}

// ── Automated check after a match ────────────────────────────────────────────
/**
 * Run all automatable achievement checks for a career save after a match event.
 * Returns the list of NEWLY unlocked achievement ids so the store can toast them.
 */
export function checkMatchAchievements(
  save: SaveGame,
  opts: {
    userRuns: number;
    userWickets: number;
    userFours: number;
    userSixes: number;
    userBalls: number;
    userBallsBowled: number;
    won: boolean;
    potm: boolean;
    userBatted: boolean;
    userBowled: boolean;
  },
): string[] {
  const unlocked: string[] = [];
  const try_ = (id: string) => {
    if (unlockAchievement(save, id)) unlocked.push(id);
  };
  const has = (id: string) => save.achievements?.includes(id) ?? false;
  const cs = save.userPlayerId ? save.players[save.userPlayerId]?.careerStats : undefined;
  if (!cs) return [];

  // ── Batting ──
  if (cs.runs >= 1 && !has('bat_first_run')) try_('bat_first_run');
  if (cs.runs >= 1000) try_('bat_1000_runs');
  if (cs.runs >= 5000) try_('bat_5000_runs');
  if (cs.runs >= 10000) try_('bat_10000_runs');
  if (cs.fours >= 50) try_('bat_50_fours');
  if (cs.fours >= 100) try_('bat_100_fours');
  if (cs.sixes >= 30) try_('bat_30_sixes');
  if (cs.sixes >= 100) try_('bat_100_sixes');
  if (cs.hundreds >= 1 && !has('bat_first_hundred')) try_('bat_first_hundred');
  if (cs.hundreds >= 5) try_('bat_5_hundreds');
  if (cs.fifties >= 1 && !has('bat_first_fifty')) try_('bat_first_fifty');
  if (opts.userRuns >= 200) try_('bat_double_ton');

  // ── Bowling ──
  if (cs.wickets >= 1 && !has('bowl_first_wicket')) try_('bowl_first_wicket');
  if (cs.wickets >= 100) try_('bowl_100_wickets');
  if (cs.wickets >= 300) try_('bowl_300_wickets');
  if (cs.wickets >= 500) try_('bowl_500_wickets');
  if (opts.userWickets >= 5 && !has('bowl_five_fer')) try_('bowl_five_fer');

  // ── All-round ──
  if (opts.userRuns >= 50 && opts.userWickets >= 3) try_('ar_match_double');
  if (opts.potm && !has('ar_potm')) try_('ar_potm');
  const potmCount = (save.timeline ?? []).filter(
    (t) => t.kind === 'AWARD' && t.text.includes('Player of the Match'),
  ).length;
  if (potmCount >= 5) try_('ar_5_potm');

  // ── Career wins / streaks ──
  const careerWins = save.careerWins ?? 0;
  const winStreak = save.winStreak ?? 0;
  if (careerWins >= 10) try_('meta_10_wins');
  if (careerWins >= 50) try_('meta_50_wins');
  if (winStreak >= 5) try_('meta_streak_5');
  if (winStreak >= 10) try_('meta_streak_10');

  // ── Match count ──
  if (cs.matches >= 100) try_('meta_100_matches');
  if (cs.matches >= 500) try_('meta_500_matches');

  // ── 1000/100 double ──
  if (cs.runs >= 1000 && cs.wickets >= 100) try_('ar_1000_100');

  return unlocked;
}

/** Manager-only match milestones. Player-stat achievements never enter manager saves. */
export function checkManagerMatchAchievements(save: SaveGame): string[] {
  if (save.mode !== 'manager') return [];
  const unlocked: string[] = [];
  const try_ = (id: string) => {
    if (unlockAchievement(save, id)) unlocked.push(id);
  };
  const wins = save.careerWins ?? 0;
  const matches = wins + (save.careerLosses ?? 0) + (save.careerDraws ?? 0);
  const streak = save.winStreak ?? 0;

  if (wins >= 10) try_('meta_10_wins');
  if (wins >= 50) try_('meta_50_wins');
  if (streak >= 5) try_('meta_streak_5');
  if (streak >= 10) try_('meta_streak_10');
  if (matches >= 100) try_('meta_100_matches');
  if (matches >= 500) try_('meta_500_matches');
  return unlocked;
}

/** Check season/career-wide achievements (call after season rollover). */
export function checkSeasonAchievements(
  save: SaveGame,
  opts: {
    leagueWon: boolean;
    cupWon: boolean;
    continentalWon: boolean;
    allMatchesWon?: boolean;
  },
): string[] {
  const unlocked: string[] = [];
  const try_ = (id: string) => {
    if (unlockAchievement(save, id)) unlocked.push(id);
  };

  if (opts.leagueWon) {
    try_('team_league_win');
    const titlesCount = (save.records?.titles ?? []).filter((t) => t.detail === 'Champions').length;
    if (titlesCount >= 3) try_('team_3_titles');
    if (opts.cupWon) try_('team_double');
  }
  if (opts.cupWon) try_('team_cup_win');
  if (opts.continentalWon) try_('team_continental');
  if (opts.allMatchesWon) try_('team_unbeaten');

  // training sessions
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (user && (user.trainingSessionsThisSeason ?? 0) >= 10) try_('meta_train_10');

  return unlocked;
}

/** Check career-state achievements (call whenever relevant state changes). */
export function checkCareerStateAchievements(save: SaveGame): string[] {
  const unlocked: string[] = [];
  const try_ = (id: string) => {
    if (unlockAchievement(save, id)) unlocked.push(id);
  };

  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!user) return [];

  // Sponsors
  if ((save.sponsors ?? []).length >= 1) try_('life_first_sponsor');
  if ((save.sponsors ?? []).some((s) => s.tier === 'GLOBAL')) try_('life_global_deal');

  // Brand
  if ((save.brand ?? 0) >= 80) try_('life_brand_80');

  // Captaincy
  if (save.captainClub) try_('career_captain');
  if (save.captainCountry) try_('career_nat_captain');

  // National caps
  const caps = save.userCaps ?? 0;
  if (caps >= 1) try_('career_intl_debut');
  if (caps >= 50) try_('career_50_caps');
  if (caps >= 100) try_('career_100_caps');

  // World record (highest score in this world)
  if (save.records?.highestScore && save.userPlayerId) {
    const user2 = save.players[save.userPlayerId];
    if (user2 && save.records.highestScore.name === user2.name) try_('meta_world_record');
  }

  return unlocked;
}

/** Check streak achievements against the daily login streak. */
export function checkStreakAchievements(save: SaveGame, streak: number): string[] {
  const unlocked: string[] = [];
  const try_ = (id: string) => {
    if (unlockAchievement(save, id)) unlocked.push(id);
  };
  if (streak >= 7) try_('meta_login_7');
  if (streak >= 30) try_('meta_login_30');
  return unlocked;
}
