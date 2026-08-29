import {
  Fixture,
  ManagerClubState,
  ManagerTrainingFocus,
  ManagerTrainingIntensity,
  MatchState,
  Player,
  SaveGame,
  StaffRole,
} from '../domain/types';
import { computeOverall } from '../engine/rating';
import { makeRng } from '../engine/rng';
import { clamp } from '../utils/math';
import { rollMatchInjury, workloadFactor } from './injuries';
import {
  activeManagerClub,
  createManagerClubState,
  persistActiveManagerClub,
} from './managerClubState';
import { resolveXI } from './squad';

export const MANAGER_DEVELOPMENT_BLOCK_CAP = 28;

export const MANAGER_TRAINING_BASE_DP: Record<ManagerTrainingIntensity, number> = {
  LIGHT: 0.16,
  NORMAL: 0.25,
  HIGH: 0.36,
};

export const MANAGER_TRAINING_RECOVERY: Record<ManagerTrainingIntensity, number> = {
  LIGHT: 7,
  NORMAL: 5,
  HIGH: 2,
};

export const MANAGER_TRAINING_INJURY_BASE: Record<ManagerTrainingIntensity, number> = {
  LIGHT: 0,
  NORMAL: 0.0008,
  HIGH: 0.003,
};

type AttributeGroup = 'batting' | 'bowling' | 'fielding' | 'meta';

interface DevelopmentBucket {
  group: AttributeGroup;
  attributes: string[];
  weight: number;
  coachRole: StaffRole;
}

export interface ManagerTrainingFixtureResult {
  fixtureId: string;
  processedTeamIds: string[];
  developedPlayers: string[];
  injuries: {
    playerId: string;
    playerName: string;
    matchesOut: number;
    source: 'MATCH' | 'TRAINING';
  }[];
}

function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fixtureYear(save: SaveGame, fixture: Fixture): number {
  return save.seasons[fixture.seasonId]?.year ?? save.managerCalendar?.year ?? 2026;
}

function stateForTeam(save: SaveGame, teamId: string): ManagerClubState | undefined {
  const team = save.teams[teamId];
  if (save.mode !== 'manager' || !team || team.isNationalTeam) return undefined;
  // A national appointment leaves the former club intact: AI background
  // fixtures must not advance its plan, condition, injuries or development.
  if (save.managerCareerLevel === 'NATIONAL' && teamId === save.userTeamId) return undefined;
  if (teamId === save.userTeamId) {
    persistActiveManagerClub(save);
    return activeManagerClub(save);
  }
  save.managerClubs ??= {};
  save.managerClubs[teamId] ??= createManagerClubState(save, teamId);
  return save.managerClubs[teamId];
}

function refreshPlanYear(state: ManagerClubState, year: number): void {
  const plan = state.trainingPlan;
  if (plan.seasonYear === year) return;
  plan.seasonYear = year;
  plan.developmentBlocks = 0;
  plan.processedFixtureIds = [];
}

export function setManagerTeamTraining(
  save: SaveGame,
  update: { focus?: ManagerTrainingFocus; intensity?: ManagerTrainingIntensity },
): boolean {
  if (!save.userTeamId || save.managerCareerLevel === 'NATIONAL') return false;
  const state = stateForTeam(save, save.userTeamId);
  if (!state) return false;
  if (update.focus) state.trainingPlan.teamFocus = update.focus;
  if (update.intensity) state.trainingPlan.intensity = update.intensity;
  return true;
}

export function setManagerPlayerTrainingOverride(
  save: SaveGame,
  playerId: string,
  focus?: ManagerTrainingFocus,
): boolean {
  if (
    !save.userTeamId ||
    save.managerCareerLevel === 'NATIONAL' ||
    !save.teams[save.userTeamId]?.playerIds.includes(playerId)
  )
    return false;
  const state = stateForTeam(save, save.userTeamId);
  if (!state) return false;
  if (focus) state.trainingPlan.playerOverrides[playerId] = focus;
  else delete state.trainingPlan.playerOverrides[playerId];
  return true;
}

function ageFactor(age: number): number {
  if (age <= 20) return 1.25;
  if (age <= 24) return 1.1;
  if (age <= 28) return 0.85;
  if (age <= 31) return 0.5;
  if (age <= 35) return 0.2;
  return 0;
}

function headroomFactor(player: Player): number {
  const gap = player.potential - computeOverall(player);
  if (gap >= 15) return 1.15;
  if (gap >= 8) return 1;
  if (gap >= 3) return 0.65;
  if (gap >= 0) return 0.25;
  if (gap >= -2) return 0.25;
  return 0;
}

export function trainingGroundFactor(level: number): number {
  return [0.85, 0.925, 1, 1.075, 1.15][clamp(Math.round(level), 1, 5) - 1];
}

function staffQuality(state: ManagerClubState, role: StaffRole): number {
  return state.staff.find((member) => member.role === role)?.quality ?? 40;
}

function coachFactor(state: ManagerClubState, role: StaffRole): number {
  const weighted = staffQuality(state, role) * 0.6 + staffQuality(state, 'HEAD_COACH') * 0.4;
  return clamp(0.85 + weighted / 400, 0.9, 1.08);
}

function medicalReduction(state: ManagerClubState): number {
  const facility = state.facilities.medical ?? 1;
  const physio = staffQuality(state, 'PHYSIO');
  return clamp((physio / 100) * 0.5 + (facility - 1) * 0.1, 0, 0.75);
}

function fieldingBucket(weight: number): DevelopmentBucket {
  return {
    group: 'fielding',
    attributes: ['catching', 'throwing', 'agility'],
    weight,
    coachRole: 'FIELDING_COACH',
  };
}

function fitnessBucket(weight: number): DevelopmentBucket {
  return { group: 'meta', attributes: ['fitness'], weight, coachRole: 'FITNESS_COACH' };
}

function mentalBucket(weight: number): DevelopmentBucket {
  return {
    group: 'meta',
    attributes: ['confidence', 'discipline'],
    weight,
    coachRole: 'HEAD_COACH',
  };
}

function battingBucket(weight: number): DevelopmentBucket {
  return {
    group: 'batting',
    attributes: ['technique', 'timing', 'power', 'footwork', 'temperament', 'running'],
    weight,
    coachRole: 'BATTING_COACH',
  };
}

function bowlingBucket(weight: number): DevelopmentBucket {
  return {
    group: 'bowling',
    attributes: ['paceOrSpin', 'accuracy', 'movement', 'variations', 'stamina'],
    weight,
    coachRole: 'BOWLING_COACH',
  };
}

function rolePrimary(player: Player, weight: number): DevelopmentBucket[] {
  if (player.role === 'BOWLER') return [bowlingBucket(weight)];
  if (player.role === 'ALLROUNDER')
    return [battingBucket(weight * 0.5), bowlingBucket(weight * 0.5)];
  if (player.role === 'WK_BATTER') {
    return [
      battingBucket(weight * 0.7),
      {
        group: 'fielding',
        attributes: ['keeping'],
        weight: weight * 0.3,
        coachRole: 'FIELDING_COACH',
      },
    ];
  }
  return [battingBucket(weight)];
}

function bucketsForFocus(player: Player, focus: ManagerTrainingFocus): DevelopmentBucket[] {
  if (focus === 'BALANCED') {
    return [
      ...rolePrimary(player, 0.5),
      fieldingBucket(0.2),
      fitnessBucket(0.15),
      mentalBucket(0.15),
    ];
  }
  if (focus === 'BATTING') return [battingBucket(0.7), fieldingBucket(0.15), fitnessBucket(0.15)];
  if (focus === 'BOWLING') return [bowlingBucket(0.7), fieldingBucket(0.15), fitnessBucket(0.15)];
  if (focus === 'FIELDING')
    return [fieldingBucket(0.7), ...rolePrimary(player, 0.15), fitnessBucket(0.15)];
  if (focus === 'FITNESS') {
    const secondary =
      player.role === 'BOWLER' || player.role === 'ALLROUNDER' ? 'stamina' : 'agility';
    return [
      fitnessBucket(0.6),
      {
        group: secondary === 'stamina' ? 'bowling' : 'fielding',
        attributes: [secondary],
        weight: 0.2,
        coachRole: 'FITNESS_COACH',
      },
      { group: 'meta', attributes: ['discipline'], weight: 0.2, coachRole: 'HEAD_COACH' },
    ];
  }
  return [];
}

function addDevelopmentPoint(
  state: ManagerClubState,
  player: Player,
  group: AttributeGroup,
  attribute: string,
  points: number,
): boolean {
  if (points <= 0) return false;
  const playerProgress = (state.trainingPlan.developmentProgress[player.id] ??= {});
  const key = `${group}.${attribute}`;
  playerProgress[key] = (playerProgress[key] ?? 0) + points;
  const values = player[group] as unknown as Record<string, number>;
  let changed = false;
  while (playerProgress[key] >= 1 && values[attribute] < 99) {
    const previous = values[attribute];
    values[attribute] = previous + 1;
    const nextOverall = computeOverall(player);
    const ceiling = Math.min(99, player.potential + 3);
    if (nextOverall > ceiling) {
      values[attribute] = previous;
      playerProgress[key] = Math.min(playerProgress[key], 0.999);
      break;
    }
    playerProgress[key] -= 1;
    player.overall = nextOverall;
    changed = true;
  }
  return changed;
}

function developPlayerForBlock(
  state: ManagerClubState,
  player: Player,
  focus: ManagerTrainingFocus,
  intensity: ManagerTrainingIntensity,
  conditionBeforeRecovery: number,
): boolean {
  if (focus === 'RECOVERY' || conditionBeforeRecovery < 45 || player.age >= 36) return false;
  const currentOverall = computeOverall(player);
  player.overall = currentOverall;
  const base =
    MANAGER_TRAINING_BASE_DP[intensity] *
    ageFactor(player.age) *
    headroomFactor(player) *
    trainingGroundFactor(state.facilities.training);
  const readiness = conditionBeforeRecovery < 55 ? 0.5 : 1;
  if (base <= 0 || readiness <= 0) return false;

  let changed = false;
  for (const bucket of bucketsForFocus(player, focus)) {
    const obj = player[bucket.group] as unknown as Record<string, number>;
    const weakest = bucket.attributes
      .filter((attribute) => Number.isFinite(obj[attribute]))
      .sort((left, right) => obj[left] - obj[right] || left.localeCompare(right))
      .slice(0, 2);
    if (!weakest.length) continue;
    const bucketPoints = base * readiness * bucket.weight * coachFactor(state, bucket.coachRole);
    if (weakest.length === 1) {
      changed =
        addDevelopmentPoint(state, player, bucket.group, weakest[0], bucketPoints) || changed;
    } else {
      changed =
        addDevelopmentPoint(state, player, bucket.group, weakest[0], bucketPoints * 0.6) || changed;
      changed =
        addDevelopmentPoint(state, player, bucket.group, weakest[1], bucketPoints * 0.4) || changed;
    }
  }
  player.overall = computeOverall(player);
  return changed;
}

function matchParticipants(save: SaveGame, match: MatchState, teamId: string): Player[] {
  const resolvedIds =
    teamId === match.homeTeamId
      ? match.homePlayerIds
      : teamId === match.awayTeamId
        ? match.awayPlayerIds
        : undefined;
  if (resolvedIds?.length) {
    return resolvedIds
      .map((id) => save.players[id])
      .filter((player): player is Player => Boolean(player));
  }
  const ids = new Set<string>();
  for (const innings of match.innings) {
    if (innings.battingTeamId === teamId) {
      for (const batter of innings.batting) ids.add(batter.playerId);
    }
    if (innings.bowlingTeamId === teamId) {
      for (const bowler of innings.bowling) ids.add(bowler.playerId);
    }
  }
  if (!ids.size) {
    const squad = (save.teams[teamId]?.playerIds ?? [])
      .map((id) => save.players[id])
      .filter(Boolean);
    for (const player of resolveXI(squad, save.teams[teamId]?.xi)) ids.add(player.id);
  }
  return [...ids]
    .map((id) => save.players[id])
    .filter((player): player is Player => Boolean(player));
}

function playerWorkload(
  match: MatchState,
  playerId: string,
): { ballsFaced: number; ballsBowled: number } {
  let ballsFaced = 0;
  let ballsBowled = 0;
  for (const innings of match.innings) {
    ballsFaced += innings.batting.find((entry) => entry.playerId === playerId)?.balls ?? 0;
    ballsBowled += innings.bowling.find((entry) => entry.playerId === playerId)?.balls ?? 0;
  }
  return { ballsFaced, ballsBowled };
}

function matchConditionLoad(fixture: Fixture, player: Player): number {
  if (fixture.managerPhase === 'FIRST_CLASS') {
    const bowlingRole = player.role === 'BOWLER' || player.role === 'ALLROUNDER';
    return (bowlingRole ? 7 : 2) + (bowlingRole && player.bowlingStyle?.includes('PACE') ? 2 : 0);
  }
  return fixture.managerPhase === 'LIST_A' ? 5 : 6;
}

function applyTeamBlock(
  save: SaveGame,
  state: ManagerClubState,
  fixture: Fixture,
  match: MatchState,
  result: ManagerTrainingFixtureResult,
): void {
  const team = save.teams[state.teamId];
  if (!team || state.trainingPlan.processedFixtureIds.includes(fixture.id)) return;
  const year = fixtureYear(save, fixture);
  refreshPlanYear(state, year);
  if (state.trainingPlan.processedFixtureIds.includes(fixture.id)) return;

  const squad = team.playerIds
    .map((playerId) => save.players[playerId])
    .filter((p): p is Player => Boolean(p));
  const participants = matchParticipants(save, match, state.teamId);
  const injuredAtStart = new Set(
    squad.filter((player) => Boolean(player.injury)).map((player) => player.id),
  );

  for (const player of participants) {
    if (player.injury) continue;
    player.condition = clamp(
      Math.round((player.condition ?? 100) - matchConditionLoad(fixture, player)),
      0,
      100,
    );
  }

  // Existing injuries recover exactly once on this player's club fixture.
  for (const player of squad) {
    if (!player.injury) continue;
    player.injury.matchesOut -= 1;
    if (player.injury.matchesOut <= 0) player.injury = undefined;
  }

  // Preserve the current one-candidate match injury incidence, now in the shared result path.
  const matchCandidates = participants.filter(
    (player) => !injuredAtStart.has(player.id) && !player.injury,
  );
  if (matchCandidates.length) {
    const rng = makeRng(hashSeed(`${save.id}:${fixture.id}:${state.teamId}:match-injury`));
    const candidate = matchCandidates[Math.floor(rng() * matchCandidates.length)];
    const load = playerWorkload(match, candidate.id);
    const injury = rollMatchInjury(
      candidate,
      medicalReduction(state),
      rng,
      workloadFactor(load.ballsBowled, load.ballsFaced),
    );
    if (injury) {
      candidate.injury = injury;
      result.injuries.push({
        playerId: candidate.id,
        playerName: candidate.name,
        matchesOut: injury.matchesOut,
        source: 'MATCH',
      });
    }
  }

  const plan = state.trainingPlan;
  const canDevelop = !fixture.playoff && plan.developmentBlocks < MANAGER_DEVELOPMENT_BLOCK_CAP;
  if (!fixture.playoff)
    plan.developmentBlocks = Math.min(MANAGER_DEVELOPMENT_BLOCK_CAP, plan.developmentBlocks + 1);
  const med = medicalReduction(state);
  const medicalRecovery = Math.floor(med * 3);
  const rng = makeRng(hashSeed(`${save.id}:${fixture.id}:${state.teamId}:training`));

  for (const player of squad) {
    if (injuredAtStart.has(player.id) || player.injury || player.retired) continue;
    const conditionBeforeRecovery = clamp(player.condition ?? 100, 0, 100);
    const requestedFocus = plan.playerOverrides[player.id] ?? plan.teamFocus;
    const effectiveFocus = conditionBeforeRecovery < 45 ? 'RECOVERY' : requestedFocus;
    const recovery =
      (effectiveFocus === 'RECOVERY' ? 10 : MANAGER_TRAINING_RECOVERY[plan.intensity]) +
      medicalRecovery;
    player.condition = clamp(Math.round(conditionBeforeRecovery + recovery), 0, 100);

    if (
      canDevelop &&
      developPlayerForBlock(state, player, effectiveFocus, plan.intensity, conditionBeforeRecovery)
    ) {
      result.developedPlayers.push(player.id);
    }

    if (effectiveFocus === 'RECOVERY') continue;
    const baseInjury = MANAGER_TRAINING_INJURY_BASE[plan.intensity];
    const chance = Math.min(
      0.0125,
      baseInjury *
        (1 + Math.max(0, 60 - (player.condition ?? 100)) / 30) *
        (1 + Math.max(0, 65 - player.meta.fitness) / 100) *
        (1 - med),
    );
    if (rng() < chance) {
      const matchesOut = Math.max(
        1,
        Math.round((plan.intensity === 'HIGH' ? 2 : 1) * (1 - Math.min(med, 0.6))),
      );
      player.injury = { type: 'Training strain', matchesOut, severity: 'STRAIN' };
      result.injuries.push({
        playerId: player.id,
        playerName: player.name,
        matchesOut,
        source: 'TRAINING',
      });
    }
  }

  plan.processedFixtureIds = [...plan.processedFixtureIds, fixture.id].slice(-160);
  result.processedTeamIds.push(state.teamId);
}

/** Canonical post-result entry point used by watched, instant and background fixtures. */
export function processManagerFixtureTraining(
  save: SaveGame,
  fixture: Fixture,
  match: MatchState,
): ManagerTrainingFixtureResult {
  const result: ManagerTrainingFixtureResult = {
    fixtureId: fixture.id,
    processedTeamIds: [],
    developedPlayers: [],
    injuries: [],
  };
  if (save.mode !== 'manager' || !fixture.managerPhase || fixture.managerPhase === 'OFF_SEASON') {
    return result;
  }
  for (const teamId of [fixture.homeTeamId, fixture.awayTeamId]) {
    const state = stateForTeam(save, teamId);
    if (state) applyTeamBlock(save, state, fixture, match, result);
  }
  if (save.userTeamId && result.processedTeamIds.includes(save.userTeamId)) {
    persistActiveManagerClub(save);
  }
  return result;
}

export function managerTrainingRecoveryPreview(state: ManagerClubState): number {
  return (
    (state.trainingPlan.teamFocus === 'RECOVERY'
      ? 10
      : MANAGER_TRAINING_RECOVERY[state.trainingPlan.intensity]) +
    Math.floor(medicalReduction(state) * 3)
  );
}
