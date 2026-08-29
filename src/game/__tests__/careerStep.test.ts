import { checkPathPromotion } from '../career';
import fs from 'node:fs';
import path from 'node:path';
import { CareerStepType, resolveNextCareerStep } from '../careerStep';
import { synchronizeCareerPromotion } from '../careerTransition';
import { buildPlayerSeasonCalendar } from '../playerCalendar';
import { generateYouthFixtures, YOUTH_COMP_U19 } from '../youthFixtures';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('career next-step resolver', () => {
  test('shows the exact age change on the season rollover action', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'careerStep.ts'), 'utf8');
    expect(source).toContain('title: `Season ${completedSeasonNumber} complete`');
    expect(source).toContain('`Age ${player.age} → ${player.age + 1}`');
    expect(source).not.toContain(
      "detail: 'Review the completed campaign, then start the next season.'",
    );
  });

  test('returns exactly one high-priority story action', () => {
    const save = makeCareerSave();
    save.story = {
      flags: {},
      seenEventIds: [],
      pendingEventIds: ['decision-1'],
    };
    generateYouthFixtures(save);

    const step = resolveNextCareerStep(save);

    expect(step.mode).toBe('career');
    expect(step.type).toBe(CareerStepType.STORY_EVENT_REQUIRED);
    expect(step.action).toBe('OPEN_STORY');
  });

  test('never makes paid training a progression gate between fixtures', () => {
    const save = makeCareerSave();
    save.careerPathLevel = 'DOMESTIC';
    if (save.story) save.story.pendingEventIds = [];
    const calendar = buildPlayerSeasonCalendar(save)!;
    for (const event of calendar.events) event.completed = true;
    for (const fixture of Object.values(save.fixtures)) {
      if (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId) {
        fixture.played = true;
      }
    }

    const step = resolveNextCareerStep(save);

    expect(step).toMatchObject({
      type: CareerStepType.CALENDAR_ADVANCE,
      action: 'ADVANCE_CAREER_CALENDAR',
      title: 'Continue season',
      detail: 'Training is optional.',
    });
  });

  test.each([
    ['SCHOOL', 14],
    ['U19', 18],
  ] as const)('%s matchday stays primary while an optional story is waiting', (level, age) => {
    const save = makeCareerSave();
    save.careerPathLevel = level;
    save.players[save.userPlayerId!].age = age;
    save.playerCalendar = undefined;
    const fixtureIds = generateYouthFixtures(save);
    save.story = {
      flags: {},
      seenEventIds: [],
      pendingEventIds: ['career_start'],
    };

    const step = resolveNextCareerStep(save);

    expect(fixtureIds.length).toBeGreaterThan(0);
    expect(step.type).toBe(CareerStepType.MATCHDAY_SELECTED);
    expect(step.action).toBe('PLAY_MATCH');
    expect(step.fixtureId).toBe(fixtureIds[0]);
    expect(save.story.pendingEventIds).toEqual(['career_start']);
  });

  test('U19 promotion replaces old fixtures and immediately builds the new calendar', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    save.careerPathLevel = 'SCHOOL';
    user.age = 16;
    save.careerPathMatches = 6;
    save.careerPathRuns = 220;
    save.careerPathRatingSum = 36;
    const oldIds = generateYouthFixtures(save);
    expect(oldIds.length).toBeGreaterThan(0);

    const promotion = checkPathPromotion(save);
    const newIds = synchronizeCareerPromotion(save, promotion);

    expect(promotion).toMatchObject({ promoted: true, from: 'SCHOOL', to: 'U19' });
    expect(newIds.length).toBeGreaterThan(0);
    expect(
      Object.values(save.fixtures).filter((fixture) => fixture.competitionId === YOUTH_COMP_U19),
    ).toHaveLength(36);
    expect(newIds).toHaveLength(8);
    expect(oldIds.every((id) => save.fixtures[id] == null)).toBe(true);
    expect(newIds.some((id) => oldIds.includes(id))).toBe(false);
    expect(save.playerCalendar?.events.some((event) => event.fixtureId === newIds[0])).toBe(true);
    expect(
      save.experience?.mediaScrapbook?.find(
        (story) => story.id === save.experience?.pendingNewspaperId,
      ),
    ).toMatchObject({ kind: 'PROMOTION', promotionFrom: 'SCHOOL', promotionTo: 'U19' });
  });

  test('National duty ignores retained club dismissal and job-offer state', () => {
    const save = makeManagerSave();
    const otherClub = Object.values(save.teams).find((team) => team.id !== save.userTeamId)!;
    save.managerCareerLevel = 'NATIONAL';
    save.flags = { ...(save.flags ?? {}), sacked: true };
    save.managerJobOffer = {
      teamId: otherClub.id,
      clubName: otherClub.name,
      reputation: otherClub.reputation,
      salaryPromise: 500_000,
      reason: 'Retained club state from before national duty.',
    };

    const step = resolveNextCareerStep(save);

    expect(step.action).not.toBe('OPEN_JOB_OFFER');
    expect(step.action).not.toBe('OPEN_JOB_SEARCH');
  });
});
