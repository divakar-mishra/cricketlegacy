import { namePoolFor } from '../data/names';
import {
  Format,
  ManagerClubState,
  ManagerTrainingPlan,
  SaveGame,
  StaffMember,
  StaffRole,
} from '../domain/types';
import { makeRng } from '../engine/rng';
import { clamp } from '../utils/math';

const STAFF_ROLES: StaffRole[] = [
  'HEAD_COACH',
  'BATTING_COACH',
  'BOWLING_COACH',
  'FIELDING_COACH',
  'FITNESS_COACH',
  'PHYSIO',
  'SCOUT',
  'MARKETING_DIRECTOR',
];

const SPECIALTY: Record<StaffRole, string> = {
  HEAD_COACH: 'Standards, tactics and whole-squad development',
  BATTING_COACH: 'Batting growth and role clarity',
  BOWLING_COACH: 'Bowling growth and plans',
  FIELDING_COACH: 'Catching, throwing and movement',
  FITNESS_COACH: 'Fitness development and workload capacity',
  PHYSIO: 'Injury prevention and recovery',
  SCOUT: 'Player knowledge and youth identification',
  MARKETING_DIRECTOR: 'Club profile and elite-player attraction',
};

/** Club-owned systems are frozen while this career is assigned to a national side. */
export function managerClubOperationsPaused(save: SaveGame): boolean {
  return save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL';
}

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seasonYear(save: SaveGame): number {
  return (
    save.managerCalendar?.year ??
    (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ??
    2026
  );
}

function tierForTeam(save: SaveGame, teamId: string): 1 | 2 | 3 {
  if (save.divisions?.tier1.includes(teamId)) return 1;
  if (save.divisions?.tier2.includes(teamId)) return 2;
  return 3;
}

function defaultTrainingPlan(save: SaveGame): ManagerTrainingPlan {
  return {
    teamFocus: 'BALANCED',
    intensity: 'NORMAL',
    playerOverrides: {},
    processedFixtureIds: [],
    developmentProgress: {},
    developmentBlocks: 0,
    seasonYear: seasonYear(save),
  };
}

function seedStaff(save: SaveGame, teamId: string): StaffMember[] {
  const team = save.teams[teamId];
  if (!team) return [];
  const rng = makeRng(hashSeed(`${save.id}:${teamId}:club-staff`));
  const names = namePoolFor(team.country);
  return STAFF_ROLES.map((role, index) => {
    const quality = clamp(Math.round(team.reputation - 12 + rng() * 12), 25, 92);
    return {
      id: `staff-${teamId}-${role.toLowerCase()}`,
      name: `${names.first[(index + Math.floor(rng() * names.first.length)) % names.first.length]} ${
        names.last[(index * 3 + Math.floor(rng() * names.last.length)) % names.last.length]
      }`,
      role,
      quality,
      wage: Math.round(8000 + quality * 1400),
      specialty: SPECIALTY[role],
      contractYears: 2,
    };
  });
}

function standardTickets(): Record<Format, 'STANDARD'> {
  return {
    T10: 'STANDARD',
    T20: 'STANDARD',
    HUNDRED: 'STANDARD',
    ODI: 'STANDARD',
    TEST: 'STANDARD',
  };
}

/** Deterministic first-visit state for a club that has never been managed. */
export function createManagerClubState(save: SaveGame, teamId: string): ManagerClubState {
  const team = save.teams[teamId];
  if (!team) throw new Error(`Unknown manager club: ${teamId}`);
  const tier = tierForTeam(save, teamId);
  const facilityBase = team.reputation >= 68 ? 3 : team.reputation >= 63 ? 2 : 1;
  const capacityLevel = tier === 1 ? 3 : tier === 2 ? 2 : 1;
  const capacity = capacityLevel === 3 ? 18_000 : capacityLevel === 2 ? 12_000 : 8_000;
  const fanRatio = tier === 1 ? 0.74 : tier === 2 ? 0.68 : 0.62;
  return {
    teamId,
    staff: seedStaff(save, teamId),
    staffCandidates: [],
    facilities: {
      training: facilityBase,
      medical: facilityBase,
      academy: Math.max(1, facilityBase - 1),
    },
    academy: { prospectIds: [], nextIntakeYear: seasonYear(save) + 1 },
    scoutReports: [],
    finances: {
      transferBudget: team.budget,
      wageBudgetPerSeason: Math.round(200_000 + team.reputation * 9_000),
    },
    trainingPlan: defaultTrainingPlan(save),
    stadium: {
      name: `${team.name} Ground`,
      capacityLevel,
      experienceLevel: 1,
      fanBase: Math.round(capacity * fanRatio),
      ticketPresets: standardTickets(),
      attendanceHistory: [],
      settledFixtureIds: [],
    },
    sponsorship: {
      offers: [],
      history: [],
      acceptedOfferSeasonIds: [],
      earnedThisSeason: 0,
      premiumThisSeason: 0,
      earnedSeasonId: save.currentSeasonId ?? `season:${save.currentMonth ?? 0}`,
    },
  };
}

function cloneClubState(state: ManagerClubState): ManagerClubState {
  return {
    ...state,
    staff: state.staff.map((member) => ({ ...member })),
    staffCandidates: state.staffCandidates.map((member) => ({ ...member })),
    facilities: { ...state.facilities },
    academy: { ...state.academy, prospectIds: [...state.academy.prospectIds] },
    scoutReports: state.scoutReports.map((report) => ({ ...report })),
    finances: { ...state.finances },
    trainingPlan: {
      ...state.trainingPlan,
      playerOverrides: { ...state.trainingPlan.playerOverrides },
      processedFixtureIds: [...state.trainingPlan.processedFixtureIds],
      developmentProgress: Object.fromEntries(
        Object.entries(state.trainingPlan.developmentProgress).map(([id, values]) => [
          id,
          { ...values },
        ]),
      ),
    },
    stadium: {
      ...state.stadium,
      ticketPresets: { ...state.stadium.ticketPresets },
      attendanceHistory: state.stadium.attendanceHistory.map((entry) => ({ ...entry })),
      settledFixtureIds: [...state.stadium.settledFixtureIds],
    },
    sponsorship: {
      ...(state.sponsorship ?? {
        offers: [],
        history: [],
        acceptedOfferSeasonIds: [],
        earnedThisSeason: 0,
        premiumThisSeason: 0,
      }),
      offers: (state.sponsorship?.offers ?? []).map((offer) => ({ ...offer })),
      activeEarned: state.sponsorship?.activeEarned
        ? {
            ...state.sponsorship.activeEarned,
            paidFixtureIds: [...state.sponsorship.activeEarned.paidFixtureIds],
          }
        : undefined,
      history: (state.sponsorship?.history ?? []).map((contract) => ({
        ...contract,
        paidFixtureIds: [...contract.paidFixtureIds],
      })),
      acceptedOfferSeasonIds: [...(state.sponsorship?.acceptedOfferSeasonIds ?? [])],
      earnedThisSeason: Math.max(0, Math.round(state.sponsorship?.earnedThisSeason ?? 0)),
      premiumThisSeason: Math.max(0, Math.round(state.sponsorship?.premiumThisSeason ?? 0)),
    },
  };
}

/** Copy legacy active-club compatibility fields into the canonical club record. */
export function persistActiveManagerClub(save: SaveGame): ManagerClubState | undefined {
  if (save.mode !== 'manager' || !save.userTeamId || !save.teams[save.userTeamId]) return undefined;
  const existing =
    save.managerClubs?.[save.userTeamId] ?? createManagerClubState(save, save.userTeamId);
  const next: ManagerClubState = {
    ...existing,
    teamId: save.userTeamId,
    staff: (save.staff ?? existing.staff).map((member) => ({ ...member })),
    staffCandidates: (save.staffCandidates ?? existing.staffCandidates).map((member) => ({
      ...member,
    })),
    facilities: { ...(save.facilities ?? existing.facilities) },
    academy: {
      ...(save.academy ?? existing.academy),
      prospectIds: [...(save.academy?.prospectIds ?? existing.academy.prospectIds)],
    },
    scoutReports: (save.scoutReports ?? existing.scoutReports).map((report) => ({ ...report })),
    finances: { ...(save.finances ?? existing.finances) },
  };
  save.managerClubs = { ...(save.managerClubs ?? {}), [save.userTeamId]: cloneClubState(next) };
  return save.managerClubs[save.userTeamId];
}

/** Load one club's canonical assets into compatibility fields used by existing screens. */
export function activateManagerClub(save: SaveGame, teamId: string): ManagerClubState | undefined {
  if (save.mode !== 'manager' || !save.teams[teamId]) return undefined;
  const state = cloneClubState(save.managerClubs?.[teamId] ?? createManagerClubState(save, teamId));
  save.managerClubs = { ...(save.managerClubs ?? {}), [teamId]: state };
  save.staff = state.staff.map((member) => ({ ...member }));
  save.staffCandidates = state.staffCandidates.map((member) => ({ ...member }));
  save.facilities = { ...state.facilities };
  save.academy = { ...state.academy, prospectIds: [...state.academy.prospectIds] };
  save.scoutReports = state.scoutReports.map((report) => ({ ...report }));
  save.finances = { ...state.finances };
  return state;
}

export function activeManagerClub(save: SaveGame): ManagerClubState | undefined {
  if (save.mode !== 'manager' || !save.userTeamId) return undefined;
  return save.managerClubs?.[save.userTeamId] ?? persistActiveManagerClub(save);
}

/** Initializes v35 club ownership while preserving every active-club value exactly. */
export function synchronizeManagerClubState(save: SaveGame): void {
  if (save.mode !== 'manager' || !save.userTeamId || !save.teams[save.userTeamId]) return;
  persistActiveManagerClub(save);
  for (const teamId of Object.keys(save.teams)) {
    const team = save.teams[teamId];
    if (team.isNationalTeam || teamId === save.userTeamId) continue;
    save.managerClubs ??= {};
    save.managerClubs[teamId] ??= createManagerClubState(save, teamId);
  }
  activateManagerClub(save, save.userTeamId);
}
