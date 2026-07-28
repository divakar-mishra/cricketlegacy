/**
 * Validates the whole story-event bank (core + extended) against the engine
 * schema — a safety net so authored content can never ship malformed effects.
 */
import { ATTR_META } from '../../data/attributes';
import { buildUserPlayer, createCareerSave } from '../../game/createGame';
import { ensureCareerDepth, renderText, StoryContext, StoryTrigger } from '../../game/narrative';
import { SaveGame } from '../../domain/types';
import { STORY_EVENTS } from '../storyEvents';

const TRIGGERS: StoryTrigger[] = [
  'CAREER_START',
  'POST_MATCH',
  'GOOD_MATCH',
  'BAD_MATCH',
  'MILESTONE',
  'SEASON_END',
  'CALLUP',
  'CAPTAINCY',
  'DROPPED',
  'INJURY',
  'IDLE',
];
const REL_IDS = new Set(['coach', 'captain', 'mentor', 'agent', 'rival', 'selector']);
const TIMELINE_KINDS = new Set(['DEBUT', 'MILESTONE', 'AWARD', 'TRANSFER', 'STORY', 'INJURY', 'CAPTAINCY', 'CALLUP', 'RETIREMENT']);
// Valid `attrs` keys per group. `meta` deliberately excludes `form` — form has
// its own top-level effect (effects.form), not an attrs entry.
const ATTR_KEYS: Record<string, Set<string>> = {
  batting: new Set(ATTR_META.batting.map(([k]) => k)),
  bowling: new Set(ATTR_META.bowling.map(([k]) => k)),
  fielding: new Set(ATTR_META.fielding.map(([k]) => k)),
  meta: new Set(ATTR_META.meta.map(([k]) => k)),
};

function makeSave(): SaveGame {
  const player = buildUserPlayer({
    name: 'Test Player',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 60, timing: 60, power: 60, footwork: 60, temperament: 60, running: 60 },
    bowling: { paceOrSpin: 60, accuracy: 60, movement: 60, variations: 60, stamina: 60 },
    fielding: { catching: 60, throwing: 60, agility: 60, keeping: 40 },
    meta: { fitness: 60, confidence: 60, aggression: 55, discipline: 60 },
  });
  const save = createCareerSave({ player, teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed: 42, format: 'T20' });
  ensureCareerDepth(save);
  return save;
}

describe('story event bank', () => {
  const ids = STORY_EVENTS.map((e) => e.id);

  it('has a healthy number of events', () => {
    expect(STORY_EVENTS.length).toBeGreaterThanOrEqual(40);
  });

  it('has unique event ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event has valid triggers, choices and effect keys', () => {
    for (const ev of STORY_EVENTS) {
      const triggers = Array.isArray(ev.trigger) ? ev.trigger : [ev.trigger];
      for (const t of triggers) expect(TRIGGERS).toContain(t);
      expect(ev.title.length).toBeGreaterThan(0);
      expect(ev.body.length).toBeGreaterThan(0);
      expect(ev.choices.length).toBeGreaterThanOrEqual(1);

      for (const c of ev.choices) {
        expect(c.id.length).toBeGreaterThan(0);
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.resultText.length).toBeGreaterThan(0);
        const e = c.effects;
        if (e.attrs) {
          for (const a of e.attrs) {
            expect(['batting', 'bowling', 'fielding', 'meta']).toContain(a.group);
            expect([...ATTR_KEYS[a.group]]).toContain(a.key);
            expect(Math.abs(a.delta)).toBeLessThanOrEqual(6);
          }
        }
        if (e.relationship) for (const r of e.relationship) expect(REL_IDS.has(r.id)).toBe(true);
        if (e.timeline) expect(TIMELINE_KINDS.has(e.timeline.kind)).toBe(true);
        if (e.addSponsor) expect(['LOCAL', 'NATIONAL', 'GLOBAL']).toContain(e.addSponsor.tier);
      }
    }
  });

  it('queueEvent references resolve to real events', () => {
    const idSet = new Set(ids);
    for (const ev of STORY_EVENTS) {
      for (const c of ev.choices) {
        if (c.effects.queueEvent) expect(idSet.has(c.effects.queueEvent)).toBe(true);
      }
    }
  });

  it('conditions never throw for a valid context', () => {
    const save = makeSave();
    const user = save.players[save.userPlayerId!];
    const ctx: StoryContext = { trigger: 'POST_MATCH', save, user, year: 2026, tier: 'Academy', rating: 6, runs: 40, wickets: 1, won: true, selected: true };
    for (const ev of STORY_EVENTS) {
      if (ev.condition) expect(() => ev.condition!(ctx)).not.toThrow();
    }
  });

  it('renders authored templates without raw placeholder tokens', () => {
    const save = makeSave();
    for (const ev of STORY_EVENTS) {
      expect(renderText(ev.title, save)).not.toMatch(/[{}]/);
      expect(renderText(ev.body, save)).not.toMatch(/[{}]/);
      if (ev.speaker) expect(renderText(ev.speaker, save)).not.toMatch(/[{}]/);
      for (const choice of ev.choices) {
        expect(renderText(choice.label, save)).not.toMatch(/[{}]/);
        if (choice.desc) expect(renderText(choice.desc, save)).not.toMatch(/[{}]/);
        expect(renderText(choice.resultText, save)).not.toMatch(/[{}]/);
      }
    }
  });

  it('covers the common gameplay triggers', () => {
    const covered = new Set<StoryTrigger>();
    for (const ev of STORY_EVENTS) {
      for (const t of Array.isArray(ev.trigger) ? ev.trigger : [ev.trigger]) covered.add(t);
    }
    for (const t of ['POST_MATCH', 'GOOD_MATCH', 'BAD_MATCH', 'IDLE', 'SEASON_END', 'MILESTONE'] as StoryTrigger[]) {
      expect(covered.has(t)).toBe(true);
    }
  });
});
