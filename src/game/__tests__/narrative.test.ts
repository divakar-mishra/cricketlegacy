import { makeRng } from '../../engine/rng';
import {
  canRetire,
  maybeQueueMatchStory,
  nextPendingEvent,
  normalizePendingStoryQueue,
  queueStoryForTrigger,
  releaseDeferredStoryAfterMatch,
  resolveStoryChoice,
  rolloverSponsors,
  shouldPromptRetirement,
} from '../careerEvents';
import {
  applyEffects,
  ensureCareerDepth,
  pickEvent,
  renderText,
  StoryContext,
  StoryEvent,
} from '../narrative';
import { makeCareerSave } from './_depthHelpers';

describe('ensureCareerDepth', () => {
  it('seeds life state and the opening beat, and is idempotent', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    expect(user.morale).toBeGreaterThan(0);
    expect(save.brand).toBeGreaterThanOrEqual(0);
    expect(save.integrity).toBeGreaterThan(0);
    expect(Object.keys(save.relationships ?? {})).toContain('coach');
    expect(save.story?.pendingEventIds).toContain('career_start');

    const brand = save.brand;
    ensureCareerDepth(save);
    ensureCareerDepth(save);
    expect(save.brand).toBe(brand);
    expect(save.story?.pendingEventIds.filter((id) => id === 'career_start').length).toBe(1);
  });
});

describe('applyEffects', () => {
  it('applies clamped stat/relationship/flag/sponsor changes', () => {
    const save = makeCareerSave();
    const rng = makeRng(1);
    const startCoins = save.wallet.coins;
    const out = applyEffects(
      save,
      {
        morale: 10,
        brand: 5,
        integrity: -100, // clamps to 0
        coins: 200,
        relationship: [{ id: 'coach', delta: 20 }],
        flags: { testFlag: 2 },
        addSponsor: {
          brand: 'Acme',
          tier: 'LOCAL',
          perMatchCoins: 30,
          signingBonus: 100,
          seasonsLeft: 2,
        },
      },
      2026,
      rng,
    );
    expect(save.integrity).toBe(0);
    expect(save.wallet.coins).toBe(startCoins + 200 + 100); // effect coins + sponsor signing bonus
    expect(save.relationships?.coach.level).toBeGreaterThan(15);
    expect(save.story?.flags.testFlag).toBe(2);
    expect(save.sponsors?.some((s) => s.brand === 'Acme')).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('recomputes overall after attribute changes', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    const before = user.overall;
    applyEffects(save, { attrs: [{ group: 'batting', key: 'power', delta: 5 }] }, 2026, makeRng(2));
    expect(user.batting.power).toBeGreaterThan(60);
    expect(user.overall).toBeGreaterThanOrEqual(before);
  });

  it('renders timeline effect tokens before storing the career journey entry', () => {
    const save = makeCareerSave();
    applyEffects(
      save,
      { timeline: { kind: 'STORY', text: 'Stayed loyal to {team} with {coach} watching.' } },
      2026,
      makeRng(3),
    );

    expect(save.timeline?.[0].text).toContain(save.teams[save.userTeamId!].name);
    expect(save.timeline?.[0].text).not.toContain('{team}');
    expect(save.timeline?.[0].text).not.toContain('{coach}');
  });
});

describe('renderText', () => {
  it('replaces tokens with live save values', () => {
    const save = makeCareerSave();
    const text = renderText('{name} plays for {team}; coach is {coach}.', save);
    expect(text).toContain('Test Star');
    expect(text).not.toContain('{team}');
    expect(text).not.toContain('{coach}');
  });

  it('uses safe fallback text instead of leaking unknown placeholders', () => {
    const save = makeCareerSave();
    const text = renderText('The reporter mentions {unknown_token}.', save);
    expect(text).toContain('the moment');
    expect(text).not.toContain('{unknown_token}');
  });

  it('never exposes undefined values in story copy', () => {
    const save = makeCareerSave();
    expect(renderText('undefined meets {unknown_token}.', save)).toBe('meets the moment.');
  });
});

describe('pickEvent', () => {
  const events: StoryEvent[] = [
    {
      id: 'a',
      trigger: 'POST_MATCH',
      title: 'A',
      body: 'b',
      once: true,
      choices: [{ id: 'x', label: 'x', effects: {}, resultText: 'r' }],
    },
    {
      id: 'b',
      trigger: 'GOOD_MATCH',
      title: 'B',
      body: 'b',
      condition: (c) => (c.rating ?? 0) >= 8,
      choices: [{ id: 'y', label: 'y', effects: {}, resultText: 'r' }],
    },
  ];
  const ctx = (over: Partial<StoryContext>): StoryContext => {
    const save = makeCareerSave();
    return {
      trigger: 'POST_MATCH',
      save,
      user: save.players[save.userPlayerId!],
      year: 2026,
      tier: 'X',
      ...over,
    };
  };

  it('filters by trigger', () => {
    expect(pickEvent(events, ctx({ trigger: 'POST_MATCH' }), makeRng(1))?.id).toBe('a');
    expect(pickEvent(events, ctx({ trigger: 'IDLE' }), makeRng(1))).toBeUndefined();
  });

  it('respects once (seen) and conditions', () => {
    const seenCtx = ctx({ trigger: 'POST_MATCH' });
    seenCtx.save.story!.seenEventIds.push('a');
    expect(pickEvent(events, seenCtx, makeRng(1))).toBeUndefined();

    expect(
      pickEvent(events, ctx({ trigger: 'GOOD_MATCH', rating: 5 }), makeRng(1)),
    ).toBeUndefined();
    expect(pickEvent(events, ctx({ trigger: 'GOOD_MATCH', rating: 9 }), makeRng(1))?.id).toBe('b');
  });
});

describe('match story queueing + resolution', () => {
  it('keeps one pending beat instead of stacking stories across youth matches', () => {
    const save = makeCareerSave();
    save.story = {
      flags: {},
      strings: {},
      seenEventIds: [],
      pendingEventIds: ['career_start'],
    };

    for (let index = 0; index < 4; index += 1) {
      expect(queueStoryForTrigger(save, 'GOOD_MATCH', makeRng(index + 1), { rating: 9 })).toBe(
        true,
      );
    }

    expect(save.story.pendingEventIds).toEqual(['career_start']);
  });

  it('preserves an old backlog but releases only one story after each later match', () => {
    const save = makeCareerSave();
    save.story!.pendingEventIds = ['one', 'two', 'three', 'four'];

    normalizePendingStoryQueue(save);
    expect(save.story!.pendingEventIds).toEqual(['one']);

    save.story!.pendingEventIds = [];
    save.story!.seenEventIds.push('one');
    save.timeline!.push({ year: 2026, kind: 'STORY', text: 'Resolved one.' });
    expect(releaseDeferredStoryAfterMatch(save)).toBe(true);
    expect(save.story!.pendingEventIds).toEqual(['two']);
    expect(releaseDeferredStoryAfterMatch(save)).toBe(false);
    expect(save.story!.pendingEventIds).toEqual(['two']);
  });

  it('renders queued titles and choice labels without leaking template placeholders', () => {
    const save = makeCareerSave();
    save.story!.pendingEventIds = ['x_injury_dark_days'];

    const rendered = nextPendingEvent(save);

    expect(rendered).not.toBeNull();
    expect(rendered?.title).not.toMatch(/[{}]/);
    expect(rendered?.speaker ?? '').not.toMatch(/[{}]/);
    expect(rendered?.body).not.toMatch(/[{}]/);
    expect(
      rendered?.choices.map((choice) => `${choice.label} ${choice.desc ?? ''}`).join(' '),
    ).not.toMatch(/[{}]/);
    expect(rendered?.choices[0].label).toContain(save.relationships!.mentor.name);
  });

  it('always queues a beat when the user is dropped, and resolving applies + advances', () => {
    const save = makeCareerSave();
    save.story!.pendingEventIds = []; // clear the opening beat
    maybeQueueMatchStory(
      save,
      { rating: 3, runs: 0, wickets: 0, won: false, selected: false },
      makeRng(5),
    );
    const rendered = nextPendingEvent(save);
    expect(rendered).not.toBeNull();

    const before = save.story!.seenEventIds.length;
    const res = resolveStoryChoice(save, rendered!.event.id, rendered!.choices[0].id, makeRng(6));
    expect(res.ok).toBe(true);
    expect(save.story!.seenEventIds.length).toBe(before + 1);
    expect((save.timeline ?? []).length).toBeGreaterThan(0);
  });
});

describe('sponsor economy', () => {
  it('expires or loses legacy story deals on rollover without a parallel payout path', () => {
    const save = makeCareerSave();
    save.sponsors = [
      {
        id: 's1',
        brand: 'PayDeal',
        tier: 'LOCAL',
        perMatchCoins: 50,
        signingBonus: 0,
        seasonsLeft: 1,
      },
      {
        id: 's2',
        brand: 'CleanCo',
        tier: 'GLOBAL',
        perMatchCoins: 80,
        signingBonus: 0,
        seasonsLeft: 3,
        requiresIntegrity: true,
      },
    ];
    save.integrity = 20; // breaks the integrity clause
    const { expired, lost } = rolloverSponsors(save);
    expect(expired).toContain('PayDeal'); // seasonsLeft hit 0
    expect(lost).toContain('CleanCo'); // integrity too low
    expect(save.sponsors.length).toBe(0);
  });
});

describe('retirement prompt eligibility', () => {
  it('does not allow retirement before age 33', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    user.overall = 60;

    user.age = 32;
    expect(canRetire(user)).toBe(false);
    expect(shouldPromptRetirement(user)).toBe(false);
  });

  it('allows retirement from age 33 and shows the nudge for low-rated players', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    user.overall = 60;

    user.age = 33;
    expect(canRetire(user)).toBe(true);
    expect(shouldPromptRetirement(user)).toBe(true);
  });

  it('allows retirement from age 33 without showing the low-rating nudge', () => {
    const save = makeCareerSave();
    const user = save.players[save.userPlayerId!];
    user.age = 33;
    user.overall = 80;

    expect(canRetire(user)).toBe(true);
    expect(shouldPromptRetirement(user)).toBe(false);
  });
});
