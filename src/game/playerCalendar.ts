import {
  PlayerCalendarEvent,
  PlayerCalendarState,
  SaveGame,
} from '../domain/types';
import { clamp } from '../utils/math';
import {
  careerSelectionDecision,
  ensurePlayerCareerResources,
  prepareCareerFormat,
} from './career';
import { isYouthFixture } from './youthFixtures';
import { isInternationalFixture } from './intlCalendar';

export type PlayerCalendarChoice = 'SKILL' | 'FITNESS' | 'STUDY' | 'TRAIN' | 'ATTEND' | 'REST';

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function monthOrder(month?: number): number {
  if (!month) return 99;
  return month >= 9 ? month - 9 : month + 3;
}

function userFixtures(save: SaveGame, predicate: (fixtureId: string) => boolean): string[] {
  const userTeamId = save.userTeamId;
  if (!userTeamId) return [];
  return Object.values(save.fixtures ?? {})
    .filter(
      (fixture) =>
        predicate(fixture.id) &&
        (fixture.homeTeamId === userTeamId || fixture.awayTeamId === userTeamId),
    )
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
  extra?: Pick<PlayerCalendarEvent, 'fixtureId' | 'format'>,
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

function matchEvents(
  save: SaveGame,
  year: number,
  fixtureIds: string[],
  idPrefix: string,
): PlayerCalendarEvent[] {
  return fixtureIds.map((fixtureId, index) => {
    const fixture = save.fixtures[fixtureId];
    return event(
      year,
      `${idPrefix}-match-${index + 1}`,
      fixture.calendarMonth ?? 3,
      ((fixture.round - 1) % 4) + 1,
      'MATCH',
      `${fixture.format} matchday`,
      `Selection is confirmed. Play ${save.teams[fixture.homeTeamId]?.shortName ?? fixture.homeTeamId} v ${save.teams[fixture.awayTeamId]?.shortName ?? fixture.awayTeamId}.`,
      { fixtureId, format: fixture.format },
    );
  });
}

function seniorCalendar(save: SaveGame, year: number): PlayerCalendarEvent[] {
  const listA = userFixtures(
    save,
    (id) => save.fixtures[id].competitionId === 'list-a',
  );
  const firstClass = userFixtures(
    save,
    (id) => save.fixtures[id].competitionId === 'first-class',
  );
  const t20 = userFixtures(
    save,
    (id) =>
      save.fixtures[id].competitionId === 't20-league' &&
      !save.fixtures[id].playoff,
  );
  const playoffs = userFixtures(
    save,
    (id) => Boolean(save.fixtures[id].playoff),
  );
  const international = Object.values(save.fixtures ?? {})
    .filter(
      (fixture) =>
        fixture.seasonId === save.currentSeasonId &&
        isInternationalFixture(fixture),
    )
    .sort(
      (a, b) =>
        monthOrder(a.calendarMonth) - monthOrder(b.calendarMonth) ||
        a.round - b.round ||
        a.id.localeCompare(b.id),
    )
    .map((fixture) => fixture.id);

  return [
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
    ...(international.length
      ? [
          event(
            year,
            'international-prep',
            6,
            1,
            'INTERNATIONAL',
            'National camp',
            'Join the national squad for the locked June-August international window.',
            { format: save.fixtures[international[0]]?.format },
          ),
          ...matchEvents(save, year, international, 'international'),
        ]
      : []),
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
}

function youthCalendar(save: SaveGame, year: number): PlayerCalendarEvent[] {
  const level = save.careerPathLevel === 'U19' ? 'U19' : 'SCHOOL';
  const youth = userFixtures(save, (id) => isYouthFixture(save.fixtures[id]));
  const odi = youth.filter((id) => save.fixtures[id].format === 'ODI');
  const t20 = youth.filter((id) => save.fixtures[id].format === 'T20');

  if (level === 'SCHOOL') {
    return [
      event(
        year,
        'school-training-1',
        9,
        1,
        'TRAINING',
        'School training week',
        'Balance skill work and fitness before the academic term.',
        { format: 'T20' },
      ),
      event(
        year,
        'school-exam-1',
        11,
        2,
        'EXAM',
        'Mid-year examinations',
        'Choose study time or extra nets. The decision affects trust, confidence and condition.',
      ),
      event(
        year,
        'school-training-2',
        1,
        2,
        'TRAINING',
        'District trial preparation',
        'Prepare for the district selection block.',
        { format: 'T20' },
      ),
      event(
        year,
        'school-exam-2',
        2,
        3,
        'EXAM',
        'Final examinations',
        'The final study-versus-training decision comes before selection.',
      ),
      event(
        year,
        'school-selection',
        3,
        1,
        'SELECTION',
        'District selection day',
        'Coaches assess form, discipline and readiness for the school circuit.',
        { format: 'T20' },
      ),
      ...matchEvents(save, year, t20, 'school'),
    ];
  }

  return [
    event(
      year,
      'u19-white-ball-prep',
      9,
      1,
      'TRAINING',
      'Under-19 50-over camp',
      'Prepare technique, running and bowling control for the autumn block.',
      { format: 'ODI' },
    ),
    event(
      year,
      'u19-odi-selection',
      9,
      2,
      'SELECTION',
      'Under-19 ODI selection',
      'Selectors compare output, role balance and readiness.',
      { format: 'ODI' },
    ),
    ...matchEvents(save, year, odi, 'u19-odi'),
    event(
      year,
      'nca-camp-1',
      12,
      2,
      'NCA_CAMP',
      'NCA foundation camp',
      'Attend elite coaching or take recovery after the 50-over block.',
    ),
    event(
      year,
      'nca-camp-2',
      1,
      3,
      'NCA_CAMP',
      'NCA development camp',
      'Work on adaptability and physical preparation.',
    ),
    event(
      year,
      'nca-camp-3',
      2,
      3,
      'NCA_CAMP',
      'NCA final assessment',
      'The final camp feeds into T20 selection and domestic scouting.',
    ),
    event(
      year,
      'u19-t20-selection',
      3,
      1,
      'SELECTION',
      'Under-19 T20 selection',
      'Tempo, condition and camp performance decide the summer squad.',
      { format: 'T20' },
    ),
    ...matchEvents(save, year, t20, 'u19-t20'),
  ];
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
    level === 'SCHOOL' || level === 'U19'
      ? youthCalendar(save, year)
      : seniorCalendar(save, year);

  for (const item of events) {
    const old = previous.get(item.id);
    if (old) {
      item.completed = old.completed;
      item.outcome = old.outcome;
    }
    if (item.fixtureId && save.fixtures[item.fixtureId]?.played) item.completed = true;
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

  save.playerCalendar = { year, events, cursor: existing?.cursor ?? 0 };
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
    if (choice === 'FITNESS') {
      resources.playerCondition = clamp(resources.playerCondition + 10, 0, 100);
      resources.confidence = clamp(resources.confidence + 1, 0, 100);
      outcome = 'Fitness work restored condition.';
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
      outcome = 'Extra nets improved adaptability but cost condition and school trust.';
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
    outcome = 'Joined the national squad for the international window.';
  } else if (item.kind === 'TRANSFER_WINDOW') {
    outcome = 'Transfer and contract window opened.';
  }

  resources.playerCondition = clamp(resources.playerCondition, 0, 100);
  user.condition = resources.playerCondition;
  item.completed = true;
  item.outcome = outcome;
  synchronizeCursor(save);
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
