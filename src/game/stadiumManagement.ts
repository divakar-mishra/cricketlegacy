import { STADIUMS } from '../data/stadiums';
import {
  ClubStadiumState,
  Fixture,
  Format,
  SaveGame,
  StadiumAttendanceEntry,
  TicketPreset,
} from '../domain/types';
import { clamp } from '../utils/math';
import { optionalClubSpendBlockReason } from './finance';
import { activeManagerClub, persistActiveManagerClub } from './managerClubState';

export const MAX_STADIUM_LEVEL = 5;

export const STADIUM_CAPACITY: Record<number, number> = {
  1: 8_000,
  2: 12_000,
  3: 18_000,
  4: 28_000,
  5: 42_000,
};

export const STADIUM_CAPACITY_UPGRADE_COST: Record<number, number> = {
  2: 600_000,
  3: 1_200_000,
  4: 2_400_000,
  5: 4_500_000,
};

export const STADIUM_CAPACITY_UPKEEP: Record<number, number> = {
  1: 60_000,
  2: 90_000,
  3: 135_000,
  4: 210_000,
  5: 320_000,
};

export const MATCHDAY_EXPERIENCE: Record<
  number,
  {
    label: string;
    demandBonus: number;
    ancillarySpend: number;
    upgradeCost: number;
    upkeep: number;
  }
> = {
  1: { label: 'Essentials', demandBonus: 0, ancillarySpend: 0, upgradeCost: 0, upkeep: 0 },
  2: {
    label: 'Fan Zone',
    demandBonus: 0.04,
    ancillarySpend: 2,
    upgradeCost: 250_000,
    upkeep: 15_000,
  },
  3: {
    label: 'Hospitality',
    demandBonus: 0.08,
    ancillarySpend: 4,
    upgradeCost: 500_000,
    upkeep: 30_000,
  },
  4: {
    label: 'Premium Stands',
    demandBonus: 0.12,
    ancillarySpend: 7,
    upgradeCost: 1_000_000,
    upkeep: 55_000,
  },
  5: {
    label: 'Landmark Experience',
    demandBonus: 0.16,
    ancillarySpend: 10,
    upgradeCost: 1_800_000,
    upkeep: 90_000,
  },
};

export const TICKET_PRICE: Record<Format, Record<TicketPreset, number>> = {
  T10: { LOW: 14, STANDARD: 20, PREMIUM: 28 },
  T20: { LOW: 14, STANDARD: 20, PREMIUM: 28 },
  HUNDRED: { LOW: 14, STANDARD: 20, PREMIUM: 28 },
  ODI: { LOW: 11, STANDARD: 16, PREMIUM: 22 },
  TEST: { LOW: 8, STANDARD: 12, PREMIUM: 17 },
};

const TICKET_DEMAND: Record<TicketPreset, number> = {
  LOW: 1.15,
  STANDARD: 1,
  PREMIUM: 0.7,
};

/** Regular fixtures stay meaningfully below a sell-out and preserve price choice. */
export const REGULAR_OCCUPANCY_RANGE: Record<
  TicketPreset,
  { minimum: number; maximum: number }
> = {
  LOW: { minimum: 0.7, maximum: 0.8 },
  STANDARD: { minimum: 0.65, maximum: 0.75 },
  PREMIUM: { minimum: 0.6, maximum: 0.68 },
};

const FORMAT_DEMAND: Record<Format, number> = {
  T10: 1.15,
  T20: 1.15,
  HUNDRED: 1.15,
  ODI: 0.92,
  TEST: 0.7,
};

const OPERATING_MARGIN = 0.78;

export interface StadiumUpgradeOutcome {
  ok: boolean;
  cost: number;
  level?: number;
  reason?: string;
}

export interface AttendanceProjection {
  attendance: number;
  capacity: number;
  occupancy: number;
  ticketPreset: TicketPreset;
  ticketPrice: number;
  grossReceipts: number;
  netReceipts: number;
  isNeutralFinal: boolean;
}

function boundedLevel(value: number): number {
  return clamp(Math.round(value || 1), 1, MAX_STADIUM_LEVEL);
}

export function stadiumCapacity(stadium: Pick<ClubStadiumState, 'capacityLevel'>): number {
  return STADIUM_CAPACITY[boundedLevel(stadium.capacityLevel)];
}

export function stadiumSeasonUpkeep(stadium: ClubStadiumState): number {
  const capacity = STADIUM_CAPACITY_UPKEEP[boundedLevel(stadium.capacityLevel)];
  const experience = MATCHDAY_EXPERIENCE[boundedLevel(stadium.experienceLevel)].upkeep;
  return capacity + experience;
}

export function ticketPrice(format: Format, preset: TicketPreset): number {
  return TICKET_PRICE[format][preset];
}

export function upgradeStadiumCapacity(save: SaveGame): StadiumUpgradeOutcome {
  if (save.mode !== 'manager' || !save.userTeamId || save.managerCareerLevel === 'NATIONAL') {
    return { ok: false, cost: 0, reason: 'Club stadium management is unavailable.' };
  }
  const club = activeManagerClub(save);
  const team = save.teams[save.userTeamId];
  if (!club || !team) return { ok: false, cost: 0, reason: 'No active club.' };
  const level = boundedLevel(club.stadium.capacityLevel);
  if (level >= MAX_STADIUM_LEVEL)
    return { ok: false, cost: 0, reason: 'Maximum capacity reached.' };
  const next = level + 1;
  const cost = STADIUM_CAPACITY_UPGRADE_COST[next];
  const budgetBlock = optionalClubSpendBlockReason(
    save,
    cost,
    STADIUM_CAPACITY_UPKEEP[next] - STADIUM_CAPACITY_UPKEEP[level],
  );
  if (budgetBlock) return { ok: false, cost, reason: budgetBlock };
  team.budget -= cost;
  club.stadium.capacityLevel = next;
  club.finances.transferBudget = team.budget;
  if (save.finances) save.finances.transferBudget = team.budget;
  persistActiveManagerClub(save);
  return { ok: true, cost, level: next };
}

export function upgradeMatchdayExperience(save: SaveGame): StadiumUpgradeOutcome {
  if (save.mode !== 'manager' || !save.userTeamId || save.managerCareerLevel === 'NATIONAL') {
    return { ok: false, cost: 0, reason: 'Club stadium management is unavailable.' };
  }
  const club = activeManagerClub(save);
  const team = save.teams[save.userTeamId];
  if (!club || !team) return { ok: false, cost: 0, reason: 'No active club.' };
  const level = boundedLevel(club.stadium.experienceLevel);
  if (level >= MAX_STADIUM_LEVEL) {
    return { ok: false, cost: 0, reason: 'Maximum matchday experience reached.' };
  }
  const next = level + 1;
  const cost = MATCHDAY_EXPERIENCE[next].upgradeCost;
  const budgetBlock = optionalClubSpendBlockReason(
    save,
    cost,
    MATCHDAY_EXPERIENCE[next].upkeep - MATCHDAY_EXPERIENCE[level].upkeep,
  );
  if (budgetBlock) return { ok: false, cost, reason: budgetBlock };
  team.budget -= cost;
  club.stadium.experienceLevel = next;
  club.finances.transferBudget = team.budget;
  if (save.finances) save.finances.transferBudget = team.budget;
  persistActiveManagerClub(save);
  return { ok: true, cost, level: next };
}

export function setClubTicketPreset(save: SaveGame, format: Format, preset: TicketPreset): boolean {
  if (save.mode !== 'manager' || save.managerCareerLevel === 'NATIONAL') return false;
  const club = activeManagerClub(save);
  if (!club) return false;
  club.stadium.ticketPresets[format] = preset;
  persistActiveManagerClub(save);
  return true;
}

function isSemiFinal(fixture: Fixture): boolean {
  const label = `${fixture.cupRound ?? ''} ${fixture.venue} ${fixture.id}`;
  return /semi.?final|qualifier|eliminator/i.test(label);
}

function isFinal(fixture: Fixture): boolean {
  if (isSemiFinal(fixture)) return false;
  const round = (fixture.cupRound ?? '').trim();
  if (/^(?:.+\s)?final$/i.test(round)) return true;
  return /(?:^|[-:])final$/i.test(fixture.id);
}

function isKnockout(fixture: Fixture): boolean {
  const label = `${fixture.cupRound ?? ''} ${fixture.id}`;
  return fixture.playoff || /quarter.?final|semi.?final|qualifier|eliminator/i.test(label);
}

/** Club knockout finals use a neutral venue and shared gate, not either club's ground. */
export function isNeutralClubFinal(fixture: Fixture): boolean {
  return isFinal(fixture);
}

function isDerby(save: SaveGame, fixture: Fixture): boolean {
  const home = save.teams[fixture.homeTeamId];
  const away = save.teams[fixture.awayTeamId];
  if (!home || !away || home.country !== away.country) return false;
  const homeCity = home.name.trim().split(/\s+/)[0]?.toLowerCase();
  const awayCity = away.name.trim().split(/\s+/)[0]?.toLowerCase();
  return Boolean(homeCity && homeCity === awayCity);
}

function recentFormMultiplier(save: SaveGame, teamId: string, excludeFixtureId: string): number {
  const recent = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.id !== excludeFixtureId &&
        fixture.played &&
        (fixture.homeTeamId === teamId || fixture.awayTeamId === teamId),
    )
    .sort(
      (left, right) =>
        (right.calendarMonth ?? 0) - (left.calendarMonth ?? 0) ||
        right.round - left.round ||
        right.id.localeCompare(left.id),
    )
    .slice(0, 5);
  if (!recent.length) return 1;
  const points = recent.reduce(
    (total, fixture) =>
      total +
      (fixture.winnerTeamId === teamId
        ? 1
        : fixture.resultKind === 'TIE' || fixture.resultKind === 'NO_RESULT'
          ? 0.5
          : 0),
    0,
  );
  return 0.9 + (points / recent.length) * 0.2;
}

function neutralFinalProjection(fixture: Fixture): AttendanceProjection {
  const neutral = STADIUMS.find((stadium) => stadium.id === fixture.stadiumId);
  const capacity = neutral?.capacity ?? 18_000;
  const attendance = Math.round(capacity * 0.92);
  const preset: TicketPreset = 'STANDARD';
  const price = ticketPrice(fixture.format, preset);
  const gross = attendance * price;
  const distributable = Math.round(gross * OPERATING_MARGIN);
  return {
    attendance,
    capacity,
    occupancy: attendance / capacity,
    ticketPreset: preset,
    ticketPrice: price,
    grossReceipts: gross,
    netReceipts: Math.round(distributable * 0.25),
    isNeutralFinal: true,
  };
}

export function projectFixtureAttendance(
  save: SaveGame,
  fixture: Fixture,
  presetOverride?: TicketPreset,
): AttendanceProjection | undefined {
  if (save.mode !== 'manager' || !save.userTeamId || save.managerCareerLevel === 'NATIONAL') {
    return undefined;
  }
  const club = activeManagerClub(save);
  if (!club) return undefined;
  const userInFixture =
    fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId;
  if (isFinal(fixture) && userInFixture) return neutralFinalProjection(fixture);
  if (fixture.homeTeamId !== save.userTeamId) return undefined;

  const stadium = club.stadium;
  const capacity = stadiumCapacity(stadium);
  const preset = presetOverride ?? stadium.ticketPresets[fixture.format] ?? 'STANDARD';
  const homeRep = save.teams[fixture.homeTeamId]?.reputation ?? 60;
  const awayRep = save.teams[fixture.awayTeamId]?.reputation ?? 60;
  const opponentAppeal = clamp(1 + (awayRep - homeRep) / 100, 0.9, 1.15);
  const experience = MATCHDAY_EXPERIENCE[boundedLevel(stadium.experienceLevel)];
  let baseDemand =
    stadium.fanBase *
    FORMAT_DEMAND[fixture.format] *
    opponentAppeal *
    recentFormMultiplier(save, save.userTeamId, fixture.id) *
    (1 + experience.demandBonus) *
    (isDerby(save, fixture) ? 1.1 : 1);

  const pricedDemand = baseDemand * TICKET_DEMAND[preset];
  const attendance = isKnockout(fixture)
    ? Math.round(clamp(Math.max(pricedDemand * 1.35, capacity * 0.9), 0, capacity))
    : Math.round(
        clamp(
          pricedDemand,
          capacity * REGULAR_OCCUPANCY_RANGE[preset].minimum,
          capacity * REGULAR_OCCUPANCY_RANGE[preset].maximum,
        ),
      );
  const price = ticketPrice(fixture.format, preset);
  const gross = attendance * (price + experience.ancillarySpend);
  const net = Math.round(gross * OPERATING_MARGIN);
  return {
    attendance,
    capacity,
    occupancy: capacity > 0 ? attendance / capacity : 0,
    ticketPreset: preset,
    ticketPrice: price,
    grossReceipts: gross,
    netReceipts: net,
    isNeutralFinal: false,
  };
}

function currentYear(save: SaveGame): number {
  return (
    save.managerCalendar?.year ??
    (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ??
    2026
  );
}

function updateFanBase(
  save: SaveGame,
  fixture: Fixture,
  stadium: ClubStadiumState,
  preset: TicketPreset,
): void {
  if (!save.userTeamId) return;
  const final = isFinal(fixture);
  const home = fixture.homeTeamId === save.userTeamId;
  if (!home && !final) return;
  let change = home ? 0.0015 : 0;
  if (fixture.winnerTeamId === save.userTeamId) change += home ? 0.0045 : 0;
  else if (fixture.resultKind === 'TIE' || fixture.resultKind === 'NO_RESULT')
    change += home ? 0.0015 : 0;
  else change += home ? -0.001 : 0;
  if (home && preset === 'LOW') change += 0.0025;
  if (home && preset === 'PREMIUM') change -= 0.0025;
  if (isSemiFinal(fixture)) change += 0.005;
  if (final) change += 0.01;
  if (final && fixture.winnerTeamId === save.userTeamId) change += 0.02;

  const year = currentYear(save);
  if (stadium.fanSeasonYear !== year || stadium.fanSeasonStart == null) {
    stadium.fanSeasonYear = year;
    stadium.fanSeasonStart = stadium.fanBase;
  }
  const seasonStart = Math.max(500, stadium.fanSeasonStart);
  const existingDelta = stadium.fanBase - seasonStart;
  const desired = existingDelta + Math.round(seasonStart * change);
  const bounded = clamp(desired, Math.round(-seasonStart * 0.08), Math.round(seasonStart * 0.12));
  stadium.fanBase = Math.max(500, seasonStart + bounded);
}

/** Settle one completed Manager fixture exactly once. */
export function settleFixtureGate(
  save: SaveGame,
  fixture: Fixture,
): StadiumAttendanceEntry | undefined {
  if (!fixture.played || save.mode !== 'manager' || save.managerCareerLevel === 'NATIONAL') {
    return undefined;
  }
  const club = activeManagerClub(save);
  if (!club || !save.userTeamId || club.stadium.settledFixtureIds.includes(fixture.id)) {
    return undefined;
  }
  const projection = projectFixtureAttendance(save, fixture);
  if (!projection) return undefined;
  const team = save.teams[save.userTeamId];
  if (!team) return undefined;

  const entry: StadiumAttendanceEntry = {
    fixtureId: fixture.id,
    attendance: projection.attendance,
    capacity: projection.capacity,
    ticketPreset: projection.ticketPreset,
    ticketPrice: projection.ticketPrice,
    grossReceipts: projection.grossReceipts,
    netReceipts: projection.netReceipts,
    settledAt: Date.now(),
  };
  team.budget += entry.netReceipts;
  club.finances.transferBudget = team.budget;
  club.stadium.attendanceHistory = [...club.stadium.attendanceHistory, entry].slice(-80);
  club.stadium.settledFixtureIds = [...club.stadium.settledFixtureIds, fixture.id].slice(-240);
  updateFanBase(save, fixture, club.stadium, projection.ticketPreset);
  if (save.finances) save.finances.transferBudget = team.budget;
  persistActiveManagerClub(save);
  return entry;
}

export function gateReceiptsForFixtureIds(save: SaveGame, fixtureIds: readonly string[]): number {
  const club = activeManagerClub(save);
  if (!club) return 0;
  const ids = new Set(fixtureIds);
  return club.stadium.attendanceHistory.reduce(
    (total, entry) => total + (ids.has(entry.fixtureId) ? entry.netReceipts : 0),
    0,
  );
}

export function currentSeasonGateReceipts(save: SaveGame): number {
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  return gateReceiptsForFixtureIds(save, season?.fixtureIds ?? []);
}

export function stadiumSummary(save: SaveGame):
  | {
      capacity: number;
      fanBase: number;
      averageAttendance: number;
      averageOccupancy: number;
      currentSeasonReceipts: number;
    }
  | undefined {
  const club = activeManagerClub(save);
  if (!club) return undefined;
  const history = club.stadium.attendanceHistory.slice(-15);
  const averageAttendance = history.length
    ? Math.round(history.reduce((total, entry) => total + entry.attendance, 0) / history.length)
    : 0;
  const averageOccupancy = history.length
    ? history.reduce(
        (total, entry) => total + (entry.capacity > 0 ? entry.attendance / entry.capacity : 0),
        0,
      ) / history.length
    : 0;
  return {
    capacity: stadiumCapacity(club.stadium),
    fanBase: club.stadium.fanBase,
    averageAttendance,
    averageOccupancy,
    currentSeasonReceipts: currentSeasonGateReceipts(save),
  };
}
