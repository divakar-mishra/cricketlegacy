import { activateSeasonPass } from '../seasonPass';
import { queueStoryForTrigger, resolveStoryChoice } from '../careerEvents';
import { queueManagerEvent, resolveManagerChoice } from '../managerEvents';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('monthly Season Pass story chains', () => {
  it('queues one Player opening per cycle and follows the selected branch', () => {
    const save = makeCareerSave();
    activateSeasonPass(save, { now: Date.now(), provider: 'LOCAL_MOCK' });
    save.story = { flags: {}, strings: {}, seenEventIds: ['career_start'], pendingEventIds: [] };

    expect(queueStoryForTrigger(save, 'POST_MATCH', () => 0)).toBe(true);
    const openingId = save.story?.pendingEventIds[0] ?? '';
    expect(openingId).toMatch(/^pass_monthly_player_.*_opening$/);
    expect(save.seasonPassExperience?.playerStoryCycleId).toBe(save.pass?.seasonId);

    const result = resolveStoryChoice(save, openingId, 'lead', () => 0.5);
    expect(result.ok).toBe(true);
    expect(save.story?.pendingEventIds[0]).toMatch(/^pass_monthly_player_.*_followup$/);
    expect(queueStoryForTrigger(save, 'POST_MATCH', () => 0)).toBe(true);
    expect(save.story?.pendingEventIds.filter((id) => id.endsWith('_opening'))).toHaveLength(0);
  });

  it('queues one Manager opening per cycle and persists a follow-up event', () => {
    const save = makeManagerSave();
    activateSeasonPass(save, { now: Date.now(), provider: 'LOCAL_MOCK' });

    expect(queueManagerEvent(save, 'MEDIA', () => 0)).toBe(true);
    const openingId = save.managerStory?.pendingEventIds[0] ?? '';
    expect(openingId).toMatch(/^pass_monthly_manager_.*_opening$/);
    expect(save.seasonPassExperience?.managerStoryCycleId).toBe(save.pass?.seasonId);

    const result = resolveManagerChoice(save, openingId, 'decisive');
    expect(result.ok).toBe(true);
    expect(save.managerStory?.pendingEventIds[0]).toMatch(/^pass_monthly_manager_.*_followup$/);
  });
});
