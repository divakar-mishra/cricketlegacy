/**
 * Deep management systems for Manager mode: coaching staff, upgradeable
 * facilities, scouting (noisy reports that sharpen with work), a youth academy
 * with an annual intake, player contracts (renewals + expiries), richer club
 * finances, and end-of-season settlement. Pure/mutating helpers, unit-tested.
 */
import { namePoolFor } from '../data/names';
import { Facilities, Player, SaveGame, ScoutReport, StaffMember, StaffRole } from '../domain/types';
import { generateYouth } from '../generation/players';
import { makeRng, Rng } from '../engine/rng';
import { clamp } from '../utils/math';
import { computeValue, maxSquadSize, WAGE_RATE } from './finance';
import { initialManagerLevel } from './managerCareer';
import { passStaffSigningMultiplier, passSuperstarInterestBonus } from './seasonPass';

/* ---------------- Constants ---------------- */

export const STAFF_ROLES: { role: StaffRole; label: string }[] = [
  { role: 'HEAD_COACH', label: 'Head Coach' },
  { role: 'BATTING_COACH', label: 'Batting Coach' },
  { role: 'BOWLING_COACH', label: 'Bowling Coach' },
  { role: 'FIELDING_COACH', label: 'Fielding Coach' },
  { role: 'FITNESS_COACH', label: 'Fitness Coach' },
  { role: 'PHYSIO', label: 'Physio' },
  { role: 'SCOUT', label: 'Chief Scout' },
  { role: 'MARKETING_DIRECTOR', label: 'Commercial Director' },
];

export const MAX_FACILITY = 5;
export const MAX_STAFF_QUALITY = 92;

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

export function staffWage(quality: number): number {
  return Math.round(8000 + quality * 1400);
}

function staffSpecialty(role: StaffRole): string {
  const labels: Record<StaffRole, string> = {
    HEAD_COACH: 'Standards, tactics and whole-squad development',
    BATTING_COACH: 'Batting growth and role clarity',
    BOWLING_COACH: 'Bowling growth and plans',
    FIELDING_COACH: 'Catching, throwing and movement',
    FITNESS_COACH: 'Fitness development and workload capacity',
    PHYSIO: 'Injury prevention and recovery',
    SCOUT: 'Player knowledge and youth identification',
    MARKETING_DIRECTOR: 'Club profile and elite-player attraction',
  };
  return labels[role];
}

function createStaffMember(
  role: StaffRole,
  quality: number,
  teamCountry: string,
  rng: Rng,
  id: string,
): StaffMember {
  const normalizedQuality = clamp(Math.round(quality), 25, MAX_STAFF_QUALITY);
  return {
    id,
    name: personName(teamCountry, rng),
    role,
    quality: normalizedQuality,
    wage: staffWage(normalizedQuality),
    specialty: staffSpecialty(role),
    contractYears: 2,
  };
}

function personName(countryId: string, rng: Rng): string {
  const pool = namePoolFor(countryId);
  return `${pool.first[Math.floor(rng() * pool.first.length)]} ${pool.last[Math.floor(rng() * pool.last.length)]}`;
}

/* ---------------- Initialisation ---------------- */

/** Lazily initialise all manager-depth state (idempotent; new + migrated saves). */
export function ensureManagerDepth(save: SaveGame): void {
  if (save.mode !== 'manager' || !save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  if (!team) return;
  const rng = makeRng((hashSeed(save.id) ^ 0x11a9) >>> 0);
  const rep = team.reputation;

  save.staff ??= [];
  for (const entry of STAFF_ROLES) {
    if (save.staff.some((member) => member.role === entry.role)) continue;
    save.staff.push(
      createStaffMember(
        entry.role,
        rep - 12 + rng() * 12,
        team.country,
        rng,
        `staff-${entry.role}`,
      ),
    );
  }
  if (!save.staffCandidates?.length) {
    save.staffCandidates = STAFF_ROLES.flatMap((entry, roleIndex) =>
      [0, 1].map((candidateIndex) =>
        createStaffMember(
          entry.role,
          rep - 4 + rng() * 28 + candidateIndex * 3,
          team.country,
          rng,
          `candidate-${entry.role}-${roleIndex}-${candidateIndex}`,
        ),
      ),
    );
  }
  if (!save.facilities) {
    const base = rep >= 68 ? 3 : rep >= 63 ? 2 : 1;
    save.facilities = { training: base, medical: base, academy: Math.max(1, base - 1) };
  }
  if (!save.academy) save.academy = { prospectIds: [], nextIntakeYear: currentYear(save) + 1 };
  if (!save.scoutReports) save.scoutReports = [];
  if (!save.finances) {
    save.finances = {
      transferBudget: team.budget,
      wageBudgetPerSeason: Math.round(sustainableWage(rep)),
    };
  }
  if (save.boardConfidence == null) save.boardConfidence = 60;
  if (!save.trainingFocus) save.trainingFocus = {};
  if (!save.managerStory)
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
  // Initialise manager career level. If the save was created via player→manager
  // transition, the level may already be set (set during save creation).
  if (!save.managerCareerLevel) {
    const legacyTransition = Boolean(save.flags?.transitionedToManager);
    save.managerCareerLevel = initialManagerLevel({ isLegendTransition: legacyTransition });
    save.managerCareerSeasons = 0;
    save.managerTitlesAtLevel = 0;
  }
  ensureContracts(save);
}

function sustainableWage(reputation: number): number {
  return 200_000 + reputation * 9_000;
}

/* ---------------- Contracts ---------------- */

/** Give every squad player a contract if they don't have one (idempotent). */
export function ensureContracts(save: SaveGame): void {
  if (!save.userTeamId) return;
  const team = save.teams[save.userTeamId];
  const rng = makeRng((hashSeed(save.id) ^ 0xc047) >>> 0);
  for (const id of team.playerIds) {
    const p = save.players[id];
    if (!p || p.contract) continue;
    p.contract = {
      wage: Math.round(computeValue(p) * WAGE_RATE),
      yearsLeft: 1 + Math.floor(rng() * 3),
    };
  }
}

export interface RenewOutcome {
  ok: boolean;
  cost: number;
  reason?: string;
}

/** Extend a squad player's deal. Costs a signing-on fee; bumps their wage. */
export function renewContract(save: SaveGame, playerId: string, years = 2): RenewOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p || !team.playerIds.includes(playerId))
    return { ok: false, cost: 0, reason: 'Not in your squad.' };
  const fee = Math.round(computeValue(p) * 0.1);
  if (team.budget < fee) return { ok: false, cost: fee, reason: 'Not enough budget.' };
  team.budget -= fee;
  if (save.finances) save.finances.transferBudget = team.budget;
  const newWage = Math.round(computeValue(p) * WAGE_RATE * 1.08);
  p.contract = { wage: newWage, yearsLeft: clamp((p.contract?.yearsLeft ?? 0) + years, years, 5) };
  return { ok: true, cost: fee };
}

/** Squad players whose deals are up (0 or 1 year left) — need attention. */
export function expiringContracts(save: SaveGame): Player[] {
  if (!save.userTeamId) return [];
  const team = save.teams[save.userTeamId];
  return team.playerIds
    .map((id) => save.players[id])
    .filter(
      (p): p is Player =>
        Boolean(p) && (p.contract?.yearsLeft ?? 2) <= 1 && p.id !== save.userPlayerId,
    );
}

/**
 * Tick contracts on rollover: expired (non-user) players leave to free agency.
 * Returns the ids that departed so the caller can report them.
 */
export function tickContracts(save: SaveGame): string[] {
  if (!save.userTeamId) return [];
  const team = save.teams[save.userTeamId];
  const departed: string[] = [];
  for (const id of [...team.playerIds]) {
    const p = save.players[id];
    if (!p || !p.contract || id === save.userPlayerId) continue;
    p.contract.yearsLeft -= 1;
    if (p.contract.yearsLeft <= 0) {
      // Higher-rated players are more likely to actually walk if not renewed.
      team.playerIds = team.playerIds.filter((x) => x !== id);
      if (team.xi?.includes(id)) team.xi = undefined;
      save.freeAgents = [...(save.freeAgents ?? []), id];
      p.contract = undefined;
      departed.push(id);
    }
  }
  return departed;
}

/* ---------------- Staff ---------------- */

export function staffByRole(save: SaveGame, role: StaffRole): StaffMember | undefined {
  return save.staff?.find((s) => s.role === role);
}

export function staffInvestCost(quality: number): number {
  return Math.round(40_000 + quality * quality * 60);
}

export interface StaffOutcome {
  ok: boolean;
  cost: number;
  quality?: number;
  reason?: string;
}

/** Invest in a staff member to raise their quality (a coaching upgrade). */
export function investInStaff(save: SaveGame, role: StaffRole): StaffOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const staff = staffByRole(save, role);
  if (!staff) return { ok: false, cost: 0, reason: 'No such role.' };
  if (staff.quality >= MAX_STAFF_QUALITY) return { ok: false, cost: 0, reason: 'Already elite.' };
  const cost = staffInvestCost(staff.quality);
  if (team.budget < cost) return { ok: false, cost, reason: 'Not enough budget.' };
  team.budget -= cost;
  if (save.finances) save.finances.transferBudget = team.budget;
  staff.quality = clamp(staff.quality + 4 + Math.floor(Math.random() * 3), 1, MAX_STAFF_QUALITY);
  staff.wage = staffWage(staff.quality);
  return { ok: true, cost, quality: staff.quality };
}

export function staffQuality(save: SaveGame, role: StaffRole): number {
  return staffByRole(save, role)?.quality ?? 40;
}

export function staffWageBill(save: SaveGame): number {
  return (save.staff ?? []).reduce((s, m) => s + m.wage, 0);
}

export function staffHireCost(candidate: StaffMember): number {
  return Math.round(candidate.wage * (1.5 + candidate.quality / 100));
}

export function hireStaff(save: SaveGame, candidateId: string): StaffOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const candidate = save.staffCandidates?.find((member) => member.id === candidateId);
  if (!candidate) return { ok: false, cost: 0, reason: 'Candidate is no longer available.' };
  const cost = Math.round(staffHireCost(candidate) * passStaffSigningMultiplier(save));
  if (team.budget < cost) return { ok: false, cost, reason: 'Not enough club budget.' };
  const previous = staffByRole(save, candidate.role);
  team.budget -= cost;
  save.staff = [
    ...(save.staff ?? []).filter((member) => member.role !== candidate.role),
    { ...candidate, id: `staff-${candidate.role}-${save.updatedAt}` },
  ];
  save.staffCandidates = (save.staffCandidates ?? []).filter((member) => member.id !== candidateId);
  if (previous) {
    save.staffCandidates.push({
      ...previous,
      id: `candidate-return-${previous.id}-${save.updatedAt}`,
    });
  }
  if (save.finances) save.finances.transferBudget = team.budget;
  return { ok: true, cost, quality: candidate.quality };
}

/**
 * Add three genuinely stronger but still budget-gated staff candidates.
 * The result is deterministic for a given search seed and does not replace the
 * ordinary shortlist, so spending gems creates options rather than a free hire.
 */
export function addEliteStaffCandidates(save: SaveGame, searchSeed: string): StaffMember[] {
  if (!save.userTeamId || save.mode !== 'manager') return [];
  ensureManagerDepth(save);
  const team = save.teams[save.userTeamId];
  if (!team) return [];
  const rng = makeRng((hashSeed(`${save.id}:${searchSeed}`) ^ 0xe117e) >>> 0);
  const start = Math.floor(rng() * STAFF_ROLES.length);
  const candidates: StaffMember[] = [];
  for (let index = 0; index < 3; index += 1) {
    const role = STAFF_ROLES[(start + index * 3) % STAFF_ROLES.length].role;
    const current = staffByRole(save, role)?.quality ?? 40;
    const quality = clamp(
      Math.round(Math.max(68, team.reputation + 7, current + 5) + rng() * 10),
      1,
      MAX_STAFF_QUALITY,
    );
    candidates.push(
      createStaffMember(role, quality, team.country, rng, `candidate-elite-${searchSeed}-${role}`),
    );
  }
  const ids = new Set(candidates.map((candidate) => candidate.id));
  save.staffCandidates = [
    ...(save.staffCandidates ?? []).filter((candidate) => !ids.has(candidate.id)),
    ...candidates,
  ];
  return candidates;
}

/** Canonical club quality: playing squad remains dominant, staff visibly matters. */
export function calculateClubRating(save: SaveGame): number {
  if (!save.userTeamId) return 0;
  const team = save.teams[save.userTeamId];
  const squad = team.playerIds
    .map((id) => save.players[id]?.overall)
    .filter((rating): rating is number => rating != null)
    .sort((a, b) => b - a)
    .slice(0, 11);
  const squadRating = squad.length
    ? squad.reduce((sum, rating) => sum + rating, 0) / squad.length
    : team.reputation;
  const staff = save.staff ?? [];
  const staffRating = staff.length
    ? staff.reduce((sum, member) => sum + member.quality, 0) / staff.length
    : 40;
  const facilities = save.facilities
    ? ((save.facilities.training + save.facilities.medical + save.facilities.academy) / 15) * 100
    : 20;
  const result =
    squadRating * 0.68 + staffRating * 0.18 + facilities * 0.07 + team.reputation * 0.07;
  return Math.round(clamp(result, 1, 99) * 10) / 10;
}

export function superstarAttractionChance(save: SaveGame, player?: Player): number {
  const clubRating = calculateClubRating(save);
  const marketing = staffQuality(save, 'MARKETING_DIRECTOR');
  const board = save.boardConfidence ?? 60;
  const starGap = player ? Math.max(0, player.overall - clubRating) : 10;
  return clamp(
    0.18 +
      clubRating / 180 +
      marketing / 500 +
      board / 1000 -
      starGap / 120 +
      passSuperstarInterestBonus(save),
    0.08,
    0.94,
  );
}

export function superstarPrefersClub(save: SaveGame, player: Player): boolean {
  let hash = 2166136261 >>> 0;
  const key = `${save.id}:${player.id}:${currentYear(save)}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff < superstarAttractionChance(save, player);
}

/* ---------------- Facilities ---------------- */

export function facilityUpgradeCost(level: number): number {
  return Math.round(150_000 * Math.pow(1.8, level - 1));
}

export function facilityMaintenance(save: SaveGame): number {
  const f = save.facilities;
  if (!f) return 0;
  return (f.training + f.medical + f.academy) * 18_000;
}

export interface FacilityOutcome {
  ok: boolean;
  cost: number;
  level?: number;
  reason?: string;
}

export function upgradeFacility(save: SaveGame, kind: keyof Facilities): FacilityOutcome {
  if (!save.userTeamId || !save.facilities) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const level = save.facilities[kind];
  if (level >= MAX_FACILITY) return { ok: false, cost: 0, reason: 'Max level.' };
  const cost = facilityUpgradeCost(level + 1);
  if (team.budget < cost) return { ok: false, cost, reason: 'Not enough budget.' };
  team.budget -= cost;
  if (save.finances) save.finances.transferBudget = team.budget;
  save.facilities[kind] = level + 1;
  return { ok: true, cost, level: level + 1 };
}

/* ---------------- Coaching / facility effects ---------------- */

/** Extra attribute growth per season from coaching + training facility (0..~3). */
export function trainingBonus(
  save: SaveGame,
  group: 'batting' | 'bowling' | 'fielding' | 'meta',
): number {
  const facility = save.facilities?.training ?? 1;
  const head = staffQuality(save, 'HEAD_COACH');
  const specialist =
    group === 'batting'
      ? staffQuality(save, 'BATTING_COACH')
      : group === 'bowling'
        ? staffQuality(save, 'BOWLING_COACH')
        : group === 'meta'
          ? staffQuality(save, 'FITNESS_COACH')
          : staffQuality(save, 'FIELDING_COACH');
  return clamp(((specialist * 0.6 + head * 0.4) / 100) * 1.6 + (facility - 1) * 0.35, 0, 3.2);
}

/** 0..~0.7 fraction reduction of injury duration/chance from medical + physio. */
export function medicalBonus(save: SaveGame): number {
  const facility = save.facilities?.medical ?? 1;
  const physio = staffQuality(save, 'PHYSIO');
  return clamp((physio / 100) * 0.5 + (facility - 1) * 0.1, 0, 0.75);
}

/** Youth-intake quality bonus from the academy facility + chief scout. */
export function youthQualityBonus(save: SaveGame): number {
  const facility = save.facilities?.academy ?? 1;
  const scout = staffQuality(save, 'SCOUT');
  return Math.round((facility - 1) * 4 + (scout - 40) * 0.15);
}

/* ---------------- Scouting ---------------- */

export const SCOUT_FEE = 25_000;

export interface ScoutOutcome {
  ok: boolean;
  cost: number;
  report?: ScoutReport;
  reason?: string;
}

/**
 * Scout a player (a free agent or a rival). The first look is noisy; repeat
 * looks sharpen it toward the true current rating. A better chief scout means
 * less noise and faster convergence. Hidden development ceilings are never
 * exposed or used as a player-facing recommendation.
 */
export function scoutPlayer(
  save: SaveGame,
  playerId: string,
  rng: Rng = makeRng((Date.now() ^ hashSeed(playerId)) >>> 0),
): ScoutOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p) return { ok: false, cost: 0, reason: 'Unknown player.' };
  if (team.budget < SCOUT_FEE) return { ok: false, cost: SCOUT_FEE, reason: 'Not enough budget.' };
  team.budget -= SCOUT_FEE;

  const scoutSkill = staffQuality(save, 'SCOUT'); // 40..92
  if (!save.scoutReports) save.scoutReports = [];
  const existing = save.scoutReports.find((r) => r.playerId === playerId);
  const step = 0.28 + (scoutSkill / 100) * 0.34; // uncertainty reduction per look

  if (!existing) {
    const uncertainty = clamp(0.85 - (scoutSkill / 100) * 0.4, 0.25, 0.85);
    const noise = Math.round((rng() * 2 - 1) * uncertainty * 14);
    const report: ScoutReport = {
      playerId,
      knownOverall: clamp(p.overall + noise, 1, 99),
      uncertainty,
      scoutedYear: currentYear(save),
      recommended: uncertainty < 0.4 && p.overall >= 68 && p.meta.form >= 42,
    };
    save.scoutReports.push(report);
    return { ok: true, cost: SCOUT_FEE, report };
  }

  existing.uncertainty = clamp(existing.uncertainty - step, 0.05, 1);
  // Converge the observed rating toward the truth as certainty grows.
  const pull = 1 - existing.uncertainty;
  existing.knownOverall = clamp(
    Math.round(existing.knownOverall * (1 - pull) + p.overall * pull),
    1,
    99,
  );
  existing.recommended = existing.uncertainty < 0.4 && p.overall >= 68 && p.meta.form >= 42;
  return { ok: true, cost: SCOUT_FEE, report: existing };
}

/* ---------------- Youth academy ---------------- */

const YOUTH_ROLES = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER', 'BATTER', 'BOWLER'] as const;

/** Generate this year's academy intake (once per year). Facility + scout drive quality. */
export function runYouthIntake(save: SaveGame, rng: Rng): string[] {
  if (!save.userTeamId || !save.academy) return [];
  const year = currentYear(save);
  if (save.academy.nextIntakeYear > year) return [];
  const team = save.teams[save.userTeamId];
  const size = 2 + (save.facilities?.academy ?? 1); // 3..7 prospects
  const baseQuality = clamp(team.reputation - 14 + youthQualityBonus(save), 35, 72);
  const created: string[] = [];
  for (let i = 0; i < size; i++) {
    const id = `acad-${year}-${team.id}-${i}`;
    if (save.players[id]) continue;
    const role = YOUTH_ROLES[i % YOUTH_ROLES.length];
    const p = generateYouth({
      id,
      nationality: team.country,
      role,
      quality: Math.round(baseQuality + (rng() * 10 - 5)),
      rng,
    });
    p.hidden = true;
    save.players[id] = p;
    save.academy.prospectIds.push(id);
    created.push(id);
  }
  save.academy.nextIntakeYear = year + 1;
  save.academy.intakeGraded = false;
  return created;
}

export interface PromoteOutcome {
  ok: boolean;
  reason?: string;
}

/** Promote an academy prospect into the senior squad (gives them a first deal). */
export function promoteProspect(save: SaveGame, playerId: string): PromoteOutcome {
  if (!save.userTeamId || !save.academy) return { ok: false, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  if (!save.academy.prospectIds.includes(playerId))
    return { ok: false, reason: 'Not in your academy.' };
  if (team.playerIds.length >= maxSquadSize(save))
    return { ok: false, reason: 'Senior squad is full.' };
  const p = save.players[playerId];
  if (!p) return { ok: false, reason: 'Unknown prospect.' };
  p.hidden = false;
  p.contract = { wage: Math.round(computeValue(p) * WAGE_RATE), yearsLeft: 3 };
  team.playerIds.push(playerId);
  save.academy.prospectIds = save.academy.prospectIds.filter((id) => id !== playerId);
  return { ok: true };
}

export function releaseProspect(save: SaveGame, playerId: string): PromoteOutcome {
  if (!save.academy) return { ok: false, reason: 'No academy.' };
  if (!save.academy.prospectIds.includes(playerId))
    return { ok: false, reason: 'Not in your academy.' };
  delete save.players[playerId];
  save.academy.prospectIds = save.academy.prospectIds.filter((id) => id !== playerId);
  return { ok: true };
}

/* ---------------- Loan system (Feature 1) ---------------- */

export interface LoanOutcome {
  ok: boolean;
  cost: number;
  reason?: string;
}

/** Reduced loan fee: 20% of the player's transfer value per season. */
function loanFee(player: Player, seasons: number): number {
  return Math.round(computeValue(player) * 0.2 * seasons);
}

/**
 * Take a player on loan from a rival club / free agency for `seasons` seasons.
 * Deducts a reduced loan fee from the club budget, marks the player as loaned,
 * and adds them to the user's squad.
 */
export function loanPlayer(save: SaveGame, playerId: string, seasons = 1): LoanOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p) return { ok: false, cost: 0, reason: 'Unknown player.' };
  if (team.playerIds.includes(playerId))
    return { ok: false, cost: 0, reason: 'Player is already in your squad.' };
  if (team.playerIds.length >= maxSquadSize(save))
    return { ok: false, cost: 0, reason: 'Squad is full.' };
  if (p.loanedFrom) return { ok: false, cost: 0, reason: 'Player is already on loan.' };

  const cost = loanFee(p, seasons);
  if (team.budget < cost) return { ok: false, cost, reason: 'Not enough budget.' };

  const currentYear =
    (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;

  // Find the source club (could be a rival or free agent).
  const sourceClub = Object.values(save.teams).find(
    (t) => t.id !== save.userTeamId && t.playerIds.includes(playerId),
  );

  team.budget -= cost;
  p.loanedFrom = sourceClub?.id ?? 'free_agent';
  p.loanEnd = currentYear + seasons;

  // Remove from source squad if they have one.
  if (sourceClub) {
    sourceClub.playerIds = sourceClub.playerIds.filter((id) => id !== playerId);
    if (sourceClub.xi?.includes(playerId)) sourceClub.xi = undefined;
  } else {
    // Was a free agent — remove from freeAgents list.
    save.freeAgents = (save.freeAgents ?? []).filter((id) => id !== playerId);
  }

  team.playerIds.push(playerId);
  p.contract = p.contract ?? {
    wage: Math.round(computeValue(p) * WAGE_RATE * 0.7),
    yearsLeft: seasons,
  };

  return { ok: true, cost };
}

/**
 * Return a loaned player to their parent club at season end.
 * Safe no-op if the player is not on loan or the loan hasn't expired.
 */
export function recallLoan(save: SaveGame, playerId: string): boolean {
  if (!save.userTeamId) return false;
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p || !p.loanedFrom) return false;

  // Remove from user squad.
  team.playerIds = team.playerIds.filter((id) => id !== playerId);
  if (team.xi?.includes(playerId)) team.xi = undefined;

  const parentId = p.loanedFrom;
  p.loanedFrom = undefined;
  p.loanEnd = undefined;

  // Return to parent club if still in the game world, or free agency.
  if (parentId !== 'free_agent' && save.teams[parentId]) {
    const parent = save.teams[parentId];
    if (!parent.playerIds.includes(playerId)) parent.playerIds.push(playerId);
  } else {
    save.freeAgents = [...(save.freeAgents ?? []), playerId];
    p.contract = undefined;
  }

  return true;
}

/* ---------------- Free agent contracts (Feature 1) ---------------- */

export interface FreeAgentContractOutcome {
  ok: boolean;
  cost: number;
  reason?: string;
}

/**
 * Sign an uncontracted free agent on a negotiated wage deal (no transfer fee).
 * The player moves from freeAgents into the user's squad.
 */
export function offerFreeAgentContract(
  save: SaveGame,
  playerId: string,
  years = 2,
): FreeAgentContractOutcome {
  if (!save.userTeamId) return { ok: false, cost: 0, reason: 'No club.' };
  const team = save.teams[save.userTeamId];
  const p = save.players[playerId];
  if (!p) return { ok: false, cost: 0, reason: 'Unknown player.' };
  if (!(save.freeAgents ?? []).includes(playerId)) {
    return { ok: false, cost: 0, reason: 'Player is not a free agent.' };
  }
  if (team.playerIds.length >= maxSquadSize(save))
    return { ok: false, cost: 0, reason: 'Squad is full.' };

  // Negotiated wage: 85% of value-based rate (below market — free agent discount).
  const wage = Math.round(computeValue(p) * WAGE_RATE * 0.85);
  const seasonalCost = wage * years;

  // Check sustainable wage budget if available.
  if (save.finances && team.budget < wage) {
    return { ok: false, cost: wage, reason: "Not enough budget for the first season's wage." };
  }

  save.freeAgents = (save.freeAgents ?? []).filter((id) => id !== playerId);
  team.playerIds.push(playerId);
  p.contract = { wage, yearsLeft: years };
  if (save.finances) save.finances.transferBudget = team.budget;

  return { ok: true, cost: seasonalCost };
}

export function academyProspects(save: SaveGame): Player[] {
  return (save.academy?.prospectIds ?? [])
    .map((id) => save.players[id])
    .filter((p): p is Player => Boolean(p));
}

/* ---------------- Training plans ---------------- */

export function setTrainingFocus(
  save: SaveGame,
  playerId: string,
  group: 'batting' | 'bowling' | 'fielding' | 'meta',
): void {
  if (!save.trainingFocus) save.trainingFocus = {};
  save.trainingFocus[playerId] = group;
}

/**
 * Apply season training plans on rollover: focused players get an extra nudge
 * in their focus group scaled by coaching quality + the training facility.
 */
export function applyTrainingPlans(save: SaveGame): void {
  if (!save.userTeamId || !save.trainingFocus) return;
  const team = save.teams[save.userTeamId];
  for (const id of team.playerIds) {
    const group = save.trainingFocus[id];
    const p = save.players[id];
    if (!group || !p) continue;
    const bonus = trainingBonus(save, group);
    if (bonus <= 0) continue;
    const obj = p[group] as unknown as Record<string, number>;
    for (const key of Object.keys(obj)) {
      if (key === 'form') continue;
      obj[key] = clamp(Math.round(obj[key] + bonus * 0.5), 1, 99);
    }
  }
}

/* ---------------- Finances (season settlement) ---------------- */

/** Match-day gate receipts, scaling with club reputation. */
export function gateReceipts(reputation: number): number {
  return Math.round(60_000 + reputation * 3_500);
}

/**
 * Manager-mode extras applied on season rollover, on TOP of the base
 * sponsor-minus-player-wages settlement already done by startNewSeason:
 * deduct staff wages + facility upkeep, add a season of gate receipts, then run
 * the youth intake, contract expiries and training plans.
 */
export function settleManagerSeason(
  save: SaveGame,
  rng: Rng,
): { departed: string[]; intake: string[] } {
  if (save.mode !== 'manager' || !save.userTeamId) return { departed: [], intake: [] };
  ensureManagerDepth(save);
  const team = save.teams[save.userTeamId];

  const gate = gateReceipts(team.reputation) * 7; // a home season of gates
  const staffWages = staffWageBill(save);
  const upkeep = facilityMaintenance(save);
  team.budget += gate - staffWages - upkeep;

  if (save.finances) {
    save.finances.lastGateReceipts = gate;
    save.finances.lastWageBill = staffWages;
    save.finances.transferBudget = team.budget;
    save.finances.wageBudgetPerSeason = Math.round(sustainableWage(team.reputation));
  }

  applyTrainingPlans(save);
  const departed = tickContracts(save);
  const intake = runYouthIntake(save, rng);
  ensureContracts(save);
  return { departed, intake };
}
