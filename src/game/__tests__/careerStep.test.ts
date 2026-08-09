import { checkPathPromotion } from '../career';
import { CareerStepType, resolveNextCareerStep } from '../careerStep';
import { synchronizeCareerPromotion } from '../careerTransition';
import { generateYouthFixtures, YOUTH_COMP_U19 } from '../youthFixtures';
import { makeCareerSave } from './_depthHelpers';

describe('career next-step resolver', () => {
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

  test('U19 promotion replaces old fixtures and immediately builds the new calendar', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    save.careerPathLevel = 'SCHOOL';
    user.age = 16;
    const oldIds = generateYouthFixtures(save);
    expect(oldIds.length).toBeGreaterThan(0);

    const promotion = checkPathPromotion(save);
    const newIds = synchronizeCareerPromotion(save, promotion);

    expect(promotion).toMatchObject({ promoted: true, from: 'SCHOOL', to: 'U19' });
    expect(newIds.length).toBeGreaterThan(0);
    expect(
      Object.values(save.fixtures).filter((fixture) => fixture.competitionId === YOUTH_COMP_U19),
    ).toHaveLength(newIds.length);
    expect(oldIds.some((id) => save.fixtures[id]?.competitionId !== YOUTH_COMP_U19)).toBe(false);
    expect(save.playerCalendar?.events.some((event) => event.fixtureId === newIds[0])).toBe(true);
  });
});
