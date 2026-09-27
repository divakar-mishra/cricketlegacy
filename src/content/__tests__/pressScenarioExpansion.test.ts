import { PLAYER_PRESS_SCENARIOS } from '../playerPressScenarios';
import { MANAGER_PRESS_SCENARIOS } from '../../game/managerPressScenarios';
import { STORY_EVENTS } from '../storyEvents';
import { MANAGER_EVENTS } from '../../game/managerEvents';

describe('expanded career press banks', () => {
  it('includes 50 distinct new Player press situations across strong and difficult outings', () => {
    expect(PLAYER_PRESS_SCENARIOS).toHaveLength(50);
    expect(new Set(PLAYER_PRESS_SCENARIOS.map((event) => event.id)).size).toBe(50);
    expect(new Set(PLAYER_PRESS_SCENARIOS.map((event) => event.body)).size).toBe(50);
    expect(PLAYER_PRESS_SCENARIOS.filter((event) => event.trigger === 'GOOD_MATCH')).toHaveLength(25);
    expect(PLAYER_PRESS_SCENARIOS.filter((event) => event.trigger === 'BAD_MATCH')).toHaveLength(25);
    for (const event of PLAYER_PRESS_SCENARIOS) {
      expect(event.speaker).toBe('Press Room');
      expect(event.choices).toHaveLength(3);
      expect(STORY_EVENTS).toContain(event);
    }
  });

  it('includes 50 distinct new Manager press situations after wins and losses', () => {
    expect(MANAGER_PRESS_SCENARIOS).toHaveLength(50);
    expect(new Set(MANAGER_PRESS_SCENARIOS.map((event) => event.id)).size).toBe(50);
    expect(new Set(MANAGER_PRESS_SCENARIOS.map((event) => event.body)).size).toBe(50);
    expect(MANAGER_PRESS_SCENARIOS.filter((event) => event.trigger === 'POST_WIN')).toHaveLength(25);
    expect(MANAGER_PRESS_SCENARIOS.filter((event) => event.trigger === 'POST_LOSS')).toHaveLength(25);
    for (const event of MANAGER_PRESS_SCENARIOS) {
      expect(event.speaker).toBe('Press Room');
      expect(event.choices).toHaveLength(2);
      expect(MANAGER_EVENTS).toContain(event);
    }
  });
});
