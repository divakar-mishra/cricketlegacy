import {
  GUIDANCE_TOPICS,
  HANDBOOK_CATEGORIES,
  getGuidanceTopic,
  guidanceModalMessage,
  searchGuidanceTopics,
} from '../mechanics';

describe('Cricket Academy guidance', () => {
  it('has unique topics in each of the four handbook categories', () => {
    expect(new Set(GUIDANCE_TOPICS.map((topic) => topic.id)).size).toBe(GUIDANCE_TOPICS.length);
    expect(HANDBOOK_CATEGORIES).toHaveLength(4);
    for (const category of HANDBOOK_CATEGORIES) {
      expect(GUIDANCE_TOPICS.some((topic) => topic.category === category.id)).toBe(true);
    }
  });

  it('documents the engine selection weights and exceptional-rating reward', () => {
    const topic = getGuidanceTopic('selection-formula');
    expect(topic.bullets.join(' ')).toContain('Overall 40% + Form 35% + Coach Trust 25%');
    expect(topic.bullets.join(' ')).toContain('10.0 match rating');
    expect(topic.bullets.join(' ')).toContain('guarantees the next appearance');
  });

  it('documents the exact manager over-rate threshold', () => {
    const copy = getGuidanceTopic('first-class-over-rate').bullets.join(' ');
    expect(copy).toContain('four or more pace bowlers');
    expect(copy).toContain('below 72');
    expect(copy).toContain('one-point deduction');
  });

  it('searches all categories when a query is present', () => {
    const results = searchGuidanceTopics('condition');
    expect(results.map((topic) => topic.id)).toEqual(
      expect.arrayContaining(['first-class-stamina', 'player-condition']),
    );
  });

  it('formats concise on-demand modal copy', () => {
    const message = guidanceModalMessage(getGuidanceTopic('board-grace'));
    expect(message).toContain('five matches');
    expect(message.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(3);
  });
});
