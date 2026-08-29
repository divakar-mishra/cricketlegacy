import { PlayerCalendarEvent, PlayerCalendarState, SaveGame } from '../domain/types';
import { clamp } from '../utils/math';
import {
  careerSelectionDecision,
  ensurePlayerCareerResources,
  prepareCareerFormat,
} from './career';
import { careerPlayingTeamId, generateYouthFixtures, isYouthFixture } from './youthFixtures';
import {
  annualInternationalPlans,
  generateInternationalAssignmentFixtures,
  isInternationalFixture,
} from './intlCalendar';
import { isU19WorldCupFixture, synchronizeU19WorldCupState } from './u19WorldCup';

export type PlayerCalendarChoice = 'SKILL' | 'FITNESS' | 'STUDY' | 'TRAIN' | 'ATTEND' | 'REST';

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function monthOrder(month?: number): number {
  if (!month) return 99;
  return month >= 9 ? month - 9 : month + 3;
}

function userFixtures(save: SaveGame, predicate: (fixtureId: string) => boolean): string[] {
  if (!save.userTeamId) return [];
  return Object.values(save.fixtures ?? {})
    .filter((fixture) => {
      if (!predicate(fixture.id)) return false;
      const controlledTeamId = careerPlayingTeamId(save, fixture.id);
      return fixture.homeTeamId === controlledTeamId || fixture.awayTeamId === controlledTeamId;
    })
    .sort(
      (a, b) =>
        monthOrder(a.calendarMonth) - monthOrder(b.calendarMonth) ||
        a.round - b.round ||
        a.id.localeCompare(b.id),
    )
    .map((fixture) => fixture.id);
}

function event(
  year: number,
  id: string,
  month: number,
  week: number,
  kind: PlayerCalendarEvent['kind'],
  title: string,
  detail: string,
  extra?: Pick<PlayerCalendarEvent, 'fixtureId' | 'format' | 'assignmentId'>,
): PlayerCalendarEvent {
  return {
    id: `player-calendar-${year}-${id}`,
    year,
    month,
    week,
    kind,
    title,
    detail,
    completed: false,
    ...extra,
  };
}

function domesticFixtureWeek(save: SaveGame, fixtureId: string): number {
  const fixture = save.fixtures[fixtureId];
  if (fixture.calendarWeek) return fixture.calendarWeek;
  const roundIndex = Math.max(0, fixture.round - 1);
  if (fixture.competitionId === 'list-a') {
    return [2, 3, 4][roundIndex % 3];
  }
  if (fixture.competitionId === 'first-class') {
    return [3, 1, 3, 1, 3, 1, 2][Math.min(roundIndex, 6)];
  }
  if (fixture.competitionId === 't20-league') {
    return [2, 3, 4, 4, 4][roundIndex % 5];
  }
  return (roundIndex % 4) + 1;
}

function matchEvents(
  save: SaveGame,
  year: number,
  fixtureIds: string[],
  idPrefix: string,
): PlayerCalendarEvent[] {
  return fixtureIds.map((fixtureId, index) => {
    const fixture = save.fixtures[fixtureId];
    fixture.calendarWeek ??= domesticFixtureWeek(save, fixtureId);
    return event(
      year,
      `${idPrefix}-match-${index + 1}`,
      fixture.calendarMonth ?? 3,
      fixture.calendarWeek,
      'MATCH',
      `${fixture.format} matchday`,
      `Selection is confirmed. Play ${save.teams[fixture.homeTeamId]?.shortName ?? 'Home XI'} v ${save.teams[fixture.awayTeamId]?.shortName ?? 'Away XI'}.`,
      { fixtureId, format: fixture.format },
    );
  });
}

function seniorCalendar(save: SaveGame, year: number): PlayerCalendarEvent[] {
  synchronizeU19WorldCupState(save);
  const listA = userFixtures(save, (id) => save.fixtures[id].competitionId === 'list-a');
  const firstClass = userFixtures(save, (id) => save.fixtures[id].competitionId === 'first-class');
  const t20 = userFixtures(
    save,
    (id) => save.fixtures[id].competitionId === 't20-league' && !save.fixtures[id].playoff,
  );
  const playoffs = userFixtures(
    save,
    (id) =>
      Boolean(save.fixtures[id].playoff) &&
      !isInternationalFixture(save.fixtures[id]) &&
      !isU19WorldCupFixture(save.fixtures[id]),
  );
  const u19WorldCup = userFixtures(
    save,
    (id) =>
      save.fixtures[id].seasonId === save.currentSeasonId &&
      isU19WorldCupFixture(save.fixtures[id]),
  );
  const international = Object.values(save.fixtures ?? {})
    .filter(
      (fixture) => fixture.seasonId === save.currentSeasonId && isInternationalFixture(fixture),
    )
    .sort(
      (a, b) =>
        monthOrder(a.calendarMonth) - monthOrder(b.calendarMonth) ||
        a.round - b.round ||
        a.id.localeCompare(b.id),
    )
    .map((fixture) => fixture.id);
  const internationalByAssignment = new Map<string, string[]>();
  for (const fixtureId of international) {
    const fixture = save.fixtures[fixtureId];
    const assignmentId = fixture.competitionId ?? `international-${fixture.format}`;
    internationalByAssignment.set(assignmentId, [
      ...(internationalByAssignment.get(assignmentId) ?? []),
      fixtureId,
    ]);
  }
  const assignmentPlans = save.capped ? annualInternationalPlans(year) : [];
  const planById = new Map(assignmentPlans.map((plan) => [plan.id, plan]));
  const assignmentIds = [
    ...new Set([...assignmentPlans.map((plan) => plan.id), ...internationalByAssignment.keys()]),
  ];
  const internationalEvents = assignmentIds.flatMap((assignmentId) => {
    const fixtureIds = internationalByAssignment.get(assignmentId) ?? [];
    const firstFixture = fixtureIds[0] ? save.fixtures[fixtureIds[0]] : undefined;
    const plan = planById.get(assignmentId);
    const firstSlot = plan?.slots?.[0];
    const displayEvent = save.internationalCalendar?.events.find(
      (item) => item.id === assignmentId,
    );
    return [
      event(
        year,
        `${assignmentId}-selection`,
        firstSlot?.month ?? firstFixture?.calendarMonth ?? plan?.months[0] ?? 6,
        Math.max(1, (firstSlot?.week ?? firstFixture?.calendarWeek ?? 2) - 1),
        'INTERNATIONAL',
        `${plan?.format ?? firstFixture?.format ?? 'T20'} national selection`,
        `Selectors will reassess current merit for ${displayEvent?.name ?? plan?.name ?? 'the upcoming international assignment'}.`,
        {
          format: plan?.format ?? firstFixture?.format,
          assignmentId,
        },
      ),
      ...matchEvents(save, year, fixtureIds, assignmentId),
    ];
  });

  const events = [
    event(
      year,
      'list-a-prep',
      9,
      1,
      'TRAINING',
      '50-over preparation',
      'Choose skill work or fitness before the List A block.',
      { format: 'ODI' },
    ),
    event(
      year,
      'list-a-selection',
      9,
      2,
      'SELECTION',
      'List A selection meeting',
      'Ability, form, condition, coach trust and 50-over readiness decide your place.',
      { format: 'ODI' },
    ),
    ...matchEvents(save, year, listA, 'list-a'),
    event(
      year,
      'winter-recovery',
      12,
      1,
      'RECOVERY',
      'Winter recovery week',
      'Recover condition before the four-day workload begins.',
      { format: 'TEST' },
    ),
    event(
      year,
      'first-class-selection',
      12,
      2,
      'SELECTION',
      'First-Class selection meeting',
      'Technique, temperament, stamina and recent form shape the red-ball XI.',
      { format: 'TEST' },
    ),
    ...matchEvents(save, year, firstClass, 'first-class'),
    event(
      year,
      't20-prep',
      3,
      1,
      'TRAINING',
      'T20 tempo week',
      'Tune power, running and recovery for the compressed summer schedule.',
      { format: 'T20' },
    ),
    event(
      year,
      't20-selection',
      3,
      2,
      'SELECTION',
      'T20 selection meeting',
      'White-ball tempo, form and condition decide the opening T20 squad.',
      { format: 'T20' },
    ),
    ...matchEvents(save, year, t20, 't20'),
    ...matchEvents(save, year, playoffs, 'playoff'),
    ...matchEvents(save, year, u19WorldCup, 'u19-world-cup'),
    ...internationalEvents,
    event(
      year,
      'transfer-window',
      8,
      3,
      'TRANSFER_WINDOW',
      'Contracts and transfer window',
      'Review offers, domestic-country moves and training plans before September.',
    ),
  ];
  return events.sort((left, right) => {
    const leftInternational =
      left.kind === 'MATCH' && left.fixtureId
        ? isInternationalFixture(save.fixtures[left.fixtureId])
        : false;
    const rightInternational =
      right.kind === 'MATCH' && right.fixtureId
        ? isInternationalFixture(save.fixtures[right.fixtureId])
        : false;
    const priority = (item: PlayerCalendarEvent, internationalMatch: boolean): number => {
      if (item.kind === 'INTERNATIONAL') return 0;
      if (internationalMatch) return 1;
      if (item.kind === 'MATCH') return 2;
      return 0;
    };
    return (
      monthOrder(left.month) - monthOrder(right.month) ||
      left.week - right.week ||
      priority(left, leftInternational) - priority(right, rightInternational) ||
      left.id.localeCompare(right.id)
    );
  });
}

function youthCalendar(save: SaveGame, year: number): PlayerCalendarEvent[] {
  const level = save.careerPathLevel === 'U19' ? 'U19' : 'SCHOOL';
  // Youth progression is match-led. Repair missing fixtures first, then expose
  // the next real game directly instead of making players clear study, nets,
  // camps or selection prompts before they are allowed onto the field.
  generateYouthFixtures(save);
  synchronizeU19WorldCupState(save);
  const youth = userFixtures(save, (id) => isYouthFixture(save.fixtures[id]));
  const worldCup = userFixtures(
    save,
    (id) =>
      save.fixtures[id].seasonId === save.currentSeasonId &&
      isU19WorldCupFixture(save.fixtures[id]),
  );
  const odi = youth.filter((id) => save.fixtures[id].format === 'ODI');
  const t20 = youth.filter((id) => save.fixtures[id].format === 'T20');

  if (level === 'SCHOOL') {
    return matchEvents(save, year, t20, 'school');
  }

  return [
    ...matchEvents(save, year, odi, 'u19-odi'),
    ...matchEvents(save, year, t20, 'u19-t20'),
    ...matchEvents(save, year, worldCup, 'u19-world-cup'),
  ].sort(
    (left, right) =>
      monthOrder(left.month) - monthOrder(right.month) ||
      left.week - right.week ||
      left.id.localeCompare(right.id),
  );
}

function synchronizeCursor(save: SaveGame): PlayerCalendarState | undefined {
  const state = save.playerCalendar;
  if (!state) return undefined;
  for (const item of state.events) {
    if (item.fixtureId && save.fixtures[item.fixtureId]?.played) item.completed = true;
  }
  while (state.cursor < state.events.length && state.events[state.cursor].completed) {
    state.cursor += 1;
  }
  return state;
}

/** Build or refresh the literal weekly calendar for the current player season. */
export function buildPlayerSeasonCalendar(save: SaveGame): PlayerCalendarState | undefined {
  if (save.mode !== 'career' || !save.userPlayerId) return undefined;
  const year = currentYear(save);
  const existing = save.playerCalendar?.year === year ? save.playerCalendar : undefined;
  const previous = new Map(existing?.events.map((item) => [item.id, item]) ?? []);
  const level = save.careerPathLevel ?? 'DOMESTIC';
  const events =
    level === 'SCHOOL' || level === 'U19' ? youthCalendar(save, year) : seniorCalendar(save, year);

  for (const item of events) {
    const old =
      previous.get(item.id) ??
      (item.kind === 'INTERNATIONAL'
        ? previous.get(item.id.replace(/-selection$/, '-camp'))
        : undefined);
    if (old) {
      item.completed = old.completed;
      item.outcome = old.outcome;
    }
    if (item.fixtureId && save.fixtures[item.fixtureId]?.played) item.completed = true;
  }

  if (existing) {
    const lastCompletedId = [...existing.events].reverse().find((item) => item.completed)?.id;
    const lastCompletedIndex = lastCompletedId
      ? events.findIndex((item) => item.id === lastCompletedId)
      : -1;
    if (lastCompletedIndex >= 0) {
      events.forEach((item, index) => {
        if (
          index < lastCompletedIndex &&
          item.kind === 'INTERNATIONAL' &&
          !previous.has(item.id)
        ) {
          item.completed = true;
          item.outcome = 'This assignment passed before the senior call-up.';
        }
      });
    }
  }

  if (!existing && events.some((item) => item.fixtureId && item.completed)) {
    const firstUnplayedMatch = events.findIndex(
      (item) => item.fixtureId && !save.fixtures[item.fixtureId]?.played,
    );
    if (firstUnplayedMatch >= 0) {
      for (let index = 0; index < firstUnplayedMatch; index += 1) {
        events[index].completed = true;
      }
    }
  }

  const calendarShapeUnchanged =
    existing?.events.length === events.length &&
    existing.events.every((item, index) => item.id === events[index]?.id);
  // A calendar-content update can remove events before the old cursor. Start
  // from the beginning in that case and let synchronizeCursor skip only events
  // that are genuinely complete, so an unplayed youth match is never skipped.
  save.playerCalendar = {
    year,
    events,
    cursor: calendarShapeUnchanged ? existing.cursor : 0,
  };
  return synchronizeCursor(save);
}

export function currentPlayerCalendarEvent(save: SaveGame): PlayerCalendarEvent | undefined {
  const state = buildPlayerSeasonCalendar(save);
  return state?.events[state.cursor];
}

export function resolvePlayerCalendarEvent(
  save: SaveGame,
  choice?: PlayerCalendarChoice,
): { ok: boolean; event?: PlayerCalendarEvent; reason?: string } {
  const item = currentPlayerCalendarEvent(save);
  const resources = ensurePlayerCareerResources(save);
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!item || !resources || !user) return { ok: false, reason: 'No calendar event is due.' };
  if (item.kind === 'MATCH') return { ok: false, reason: 'Play this fixture to advance.' };

  let outcome = 'Completed';
  if (item.kind === 'TRAINING') {
    if (item.id.includes('tactics-workshop') && choice !== 'FITNESS') {
      resources.adaptability = clamp(resources.adaptability + 3, 1, 100);
      resources.confidence = clamp(resources.confidence + 2, 0, 100);
      resources.playerCondition = clamp(resources.playerCondition - 2, 0, 100);
      outcome =
        'The tactics workshop improved adaptability and confidence at a small physical cost.';
    } else if (item.id.includes('team-strategy') && choice !== 'FITNESS') {
      resources.coachTrust = clamp(resources.coachTrust + 3, 0, 100);
      resources.confidence = clamp(resources.confidence + 1, 0, 100);
      outcome = 'Team strategy work improved coach trust and match confidence.';
    } else if (choice === 'FITNESS') {
      resources.playerCondition = clamp(resources.playerCondition + 10, 0, 100);
      resources.confidence = clamp(resources.confidence + 1, 0, 100);
      if (item.id.includes('team-strategy')) {
        user.meta.form = clamp(user.meta.form + 2, 0, 100);
        outcome = 'Team conditioning restored condition and sharpened form.';
      } else {
        outcome = 'Fitness work restored condition.';
      }
    } else {
      prepareCareerFormat(save, item.format ?? 'T20');
      resources.coachTrust = clamp(resources.coachTrust + 1, 0, 100);
      outcome = 'Skill work improved format readiness.';
    }
  } else if (item.kind === 'EXAM') {
    if (choice === 'TRAIN') {
      resources.adaptability = clamp(resources.adaptability + 2, 1, 100);
      resources.playerCondition = clamp(resources.playerCondition - 5, 0, 100);
      resources.coachTrust = clamp(resources.coachTrust - 1, 0, 100);
      outcome = 'Extra nets improved adaptability but cost condition and coach trust.';
    } else {
      resources.coachTrust = clamp(resources.coachTrust + 2, 0, 100);
      resources.confidence = clamp(resources.confidence + 2, 0, 100);
      outcome = 'Study time improved trust and confidence.';
    }
  } else if (item.kind === 'NCA_CAMP') {
    if (choice === 'REST') {
      resources.playerCondition = clamp(resources.playerCondition + 15, 0, 100);
      outcome = 'Recovery restored condition.';
    } else {
      resources.adaptability = clamp(resources.adaptability + 3, 1, 100);
      resources.coachTrust = clamp(resources.coachTrust + 2, 0, 100);
      resources.playerCondition = clamp(resources.playerCondition - 3, 0, 100);
      outcome = 'The NCA camp improved adaptability and selector trust.';
    }
  } else if (item.kind === 'SELECTION') {
    const decision = careerSelectionDecision(save, item.format ?? 'T20');
    outcome = decision.selected ? 'Selected for the next block.' : decision.reason;
  } else if (item.kind === 'RECOVERY') {
    resources.playerCondition = clamp(resources.playerCondition + 18, 0, 100);
    outcome = 'Recovery week restored condition.';
  } else if (item.kind === 'INTERNATIONAL') {
    const assignment = item.assignmentId
      ? generateInternationalAssignmentFixtures(save, item.assignmentId)
      : undefined;
    if (!assignment) {
      outcome = 'No international assignment is available.';
    } else if (!assignment.decision.selected) {
      outcome = assignment.decision.reason;
    } else if (assignment.fixtureIds.length === 0) {
      outcome = 'Selection review complete. No national fixture was scheduled.';
    } else {
      outcome = 'Selected for the national squad. National duty takes priority over clashes.';
    }
  } else if (item.kind === 'TRANSFER_WINDOW') {
    outcome = 'Transfer and contract window opened.';
  }

  resources.playerCondition = clamp(resources.playerCondition, 0, 100);
  user.condition = resources.playerCondition;
  item.completed = true;
  item.outcome = outcome;
  if (item.kind === 'INTERNATIONAL') buildPlayerSeasonCalendar(save);
  else synchronizeCursor(save);
  return { ok: true, event: item };
}

export function markPlayerCalendarMatchComplete(save: SaveGame, fixtureId: string): void {
  const state = buildPlayerSeasonCalendar(save);
  const item = state?.events.find((candidate) => candidate.fixtureId === fixtureId);
  if (item) {
    item.completed = true;
    item.outcome = 'Fixture completed.';
  }
  synchronizeCursor(save);
}

export function playerCalendarAllowsFixture(save: SaveGame, fixtureId: string): boolean {
  const item = currentPlayerCalendarEvent(save);
  return !item || (item.kind === 'MATCH' && item.fixtureId === fixtureId);
}
