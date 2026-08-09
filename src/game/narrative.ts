/**
 * Narrative engine for Player Career.
 *
 * A career is a story: after matches, at milestones, on call-ups and between
 * seasons the game surfaces branching **events** — a prompt from a coach, the
 * press, your agent, a rival, a sponsor — and your **choice** has lasting
 * consequences on attributes, morale, form, relationships, your brand,
 * integrity, money and future events (via story flags).
 *
 * This module is the engine (pure/mutating helpers). The content bank lives in
 * `content/storyEvents.ts` and is authored against the types exported here.
 */
import { namePoolFor } from '../data/names';
import { getCountry } from '../data/countries';
import { Player, Relationship, SaveGame, Sponsor, TimelineEntry } from '../domain/types';
import { computeOverall } from '../engine/rating';
import { makeRng, Rng } from '../engine/rng';
import { clamp } from '../utils/math';
import { addCoins, addGems } from './economy';

/* ---------------- Event schema ---------------- */

export type StoryTrigger =
  | 'CAREER_START'
  | 'POST_MATCH'
  | 'GOOD_MATCH'
  | 'BAD_MATCH'
  | 'MILESTONE'
  | 'SEASON_END'
  | 'CALLUP'
  | 'CAPTAINCY'
  | 'DROPPED'
  | 'INJURY'
  | 'IDLE';

export interface StoryContext {
  trigger: StoryTrigger;
  save: SaveGame;
  user: Player;
  year: number;
  tier: string;
  rating?: number;
  runs?: number;
  wickets?: number;
  won?: boolean;
  selected?: boolean;
  milestone?: 'FIFTY' | 'HUNDRED' | 'FIVEFER' | 'POTM';
}

/** A single stat/relationship/flag change applied by a choice. */
export interface EffectSpec {
  attrs?: { group: 'batting' | 'bowling' | 'fielding' | 'meta'; key: string; delta: number }[];
  morale?: number;
  form?: number;
  confidence?: number;
  brand?: number;
  integrity?: number;
  coins?: number;
  gems?: number;
  nationalRep?: number;
  relationship?: { id: string; delta: number }[];
  /** Additive numeric flags in story.flags (booleans as +1). */
  flags?: Record<string, number>;
  /** Immediately grant an endorsement (pays the signing bonus now). */
  addSponsor?: Omit<Sponsor, 'id'>;
  captainClub?: boolean;
  unlockAchievement?: string;
  timeline?: { kind: TimelineEntry['kind']; text: string };
  /** Queue a follow-up event id to appear next (branching storylines). */
  queueEvent?: string;
}

export interface StoryChoice {
  id: string;
  label: string;
  desc?: string;
  effects: EffectSpec;
  /** Narration shown after the choice is made (supports {tokens}). */
  resultText: string;
  /** Hide this choice unless a story flag is in range. */
  requiresFlag?: { key: string; min?: number; max?: number };
}

export interface StoryEvent {
  id: string;
  trigger: StoryTrigger | StoryTrigger[];
  title: string;
  speaker?: string;
  body: string;
  choices: StoryChoice[];
  weight?: number;
  once?: boolean;
  priority?: number;
  condition?: (ctx: StoryContext) => boolean;
}

/* ---------------- Character seeding ---------------- */

const CHARACTER_ROLES: { id: string; role: string }[] = [
  { id: 'coach', role: 'Head Coach' },
  { id: 'captain', role: 'Club Captain' },
  { id: 'mentor', role: 'Mentor' },
  { id: 'agent', role: 'Agent' },
  { id: 'rival', role: 'Rival' },
  { id: 'selector', role: 'Chief Selector' },
];

function personName(countryId: string, rng: Rng): string {
  const pool = namePoolFor(countryId);
  const f = pool.first[Math.floor(rng() * pool.first.length)];
  const l = pool.last[Math.floor(rng() * pool.last.length)];
  return `${f} ${l}`;
}

function seedRelationships(save: SaveGame, user: Player): Record<string, Relationship> {
  const rng = makeRng((hash(save.id) ^ 0x5eed) >>> 0);
  const rels: Record<string, Relationship> = {};
  for (const c of CHARACTER_ROLES) {
    rels[c.id] = {
      id: c.id,
      name: personName(user.nationality, rng),
      role: c.role,
      level: c.id === 'rival' ? -10 : 15,
    };
  }
  return rels;
}

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------------- Depth initialisation ---------------- */

/**
 * Ensure a career save has all narrative/life state initialised. Safe to call
 * repeatedly (idempotent) — used for both new saves and older migrated ones.
 */
export function ensureCareerDepth(save: SaveGame): void {
  if (save.mode !== 'career' || !save.userPlayerId) return;
  const user = save.players[save.userPlayerId];
  if (!user) return;

  if (user.morale == null) user.morale = 70;
  if (save.brand == null) save.brand = Math.round(clamp(user.overall - 25, 5, 60));
  if (save.integrity == null) save.integrity = 80;
  if (!save.relationships) save.relationships = seedRelationships(save, user);
  if (!save.sponsors) save.sponsors = [];
  if (!save.timeline) save.timeline = [];
  if (!save.seasonRatings) save.seasonRatings = [];
  if (!save.story) {
    save.story = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
  }
  if (!save.story.strings) save.story.strings = {};
  // Give brand-new careers their opening beat.
  if (save.timeline.length === 0 && !save.story.seenEventIds.includes('career_start')) {
    if (!save.story.pendingEventIds.includes('career_start')) {
      save.story.pendingEventIds.unshift('career_start');
    }
  }
}

/* ---------------- Token rendering ---------------- */

export function characterName(save: SaveGame, id: string): string {
  return save.relationships?.[id]?.name ?? 'the coach';
}

export function sanitizeNarrativeText(
  text: string,
  fallback = 'A new career moment awaits.',
): string {
  const sanitized = text
    .replace(/\b(?:undefined|null|NaN)\b/gi, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return sanitized || fallback;
}

/** Replace {tokens} in narrative copy with live save values. */
export function renderText(text: string, save: SaveGame): string {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const tokens: Record<string, string> = {
    name: user?.name ?? 'you',
    first: (user?.name ?? 'you').split(' ')[0],
    team: team?.name ?? 'your club',
    teamShort: team?.shortName ?? 'your club',
    country: user ? (getCountry(user.nationality)?.name ?? 'your country') : 'your country',
    coach: characterName(save, 'coach'),
    captain: characterName(save, 'captain'),
    mentor: characterName(save, 'mentor'),
    agent: characterName(save, 'agent'),
    rival: characterName(save, 'rival'),
    selector: characterName(save, 'selector'),
  };
  return sanitizeNarrativeText(
    text.replace(/\{(\w+)\}/g, (_, k: string) => tokens[k] ?? 'the moment'),
  );
}

/* ---------------- Effect application ---------------- */

export interface AppliedEffect {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
}

function fmtDelta(label: string, delta: number): AppliedEffect {
  const sign = delta > 0 ? '+' : '';
  return {
    label: `${label} ${sign}${delta}`,
    tone: delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral',
  };
}

export function adjustRelationship(save: SaveGame, id: string, delta: number): void {
  if (!save.relationships?.[id]) return;
  save.relationships[id].level = clamp(Math.round(save.relationships[id].level + delta), -100, 100);
}

export function addTimeline(save: SaveGame, entry: TimelineEntry): void {
  if (!save.timeline) save.timeline = [];
  save.timeline.unshift(entry);
  if (save.timeline.length > 200) save.timeline.length = 200;
}

/** Apply a choice's effects to the save (mutating). Returns a UI-friendly summary. */
export function applyEffects(
  save: SaveGame,
  effects: EffectSpec,
  year: number,
  rng: Rng,
): AppliedEffect[] {
  const out: AppliedEffect[] = [];
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;

  if (user && effects.attrs) {
    for (const a of effects.attrs) {
      const grp = user[a.group] as unknown as Record<string, number>;
      if (grp[a.key] == null) continue;
      grp[a.key] = clamp(Math.round(grp[a.key] + a.delta), 1, 99);
      out.push(fmtDelta(a.key, a.delta));
    }
    user.overall = computeOverall(user);
  }
  if (user && effects.form != null) {
    user.meta.form = clamp(Math.round(user.meta.form + effects.form), 1, 99);
    out.push(fmtDelta('Form', effects.form));
  }
  if (user && effects.confidence != null) {
    user.meta.confidence = clamp(Math.round(user.meta.confidence + effects.confidence), 1, 99);
    out.push(fmtDelta('Confidence', effects.confidence));
  }
  if (user && effects.morale != null) {
    user.morale = clamp(Math.round((user.morale ?? 70) + effects.morale), 0, 100);
    out.push(fmtDelta('Morale', effects.morale));
  }
  if (effects.brand != null) {
    save.brand = clamp(Math.round((save.brand ?? 20) + effects.brand), 0, 100);
    out.push(fmtDelta('Brand', effects.brand));
  }
  if (effects.integrity != null) {
    save.integrity = clamp(Math.round((save.integrity ?? 80) + effects.integrity), 0, 100);
    out.push(fmtDelta('Integrity', effects.integrity));
  }
  if (effects.nationalRep != null) {
    save.nationalRep = clamp(Math.round((save.nationalRep ?? 0) + effects.nationalRep), 0, 100);
    out.push(fmtDelta('Selection rep', effects.nationalRep));
  }
  if (effects.coins) {
    save.wallet = addCoins(save.wallet, effects.coins);
    out.push({
      label: `${effects.coins > 0 ? '+' : ''}${effects.coins} coins`,
      tone: effects.coins > 0 ? 'good' : 'bad',
    });
  }
  if (effects.gems) {
    save.wallet = addGems(save.wallet, effects.gems);
    out.push({
      label: `${effects.gems > 0 ? '+' : ''}${effects.gems} gems`,
      tone: effects.gems > 0 ? 'good' : 'bad',
    });
  }
  if (effects.relationship) {
    for (const r of effects.relationship) {
      adjustRelationship(save, r.id, r.delta);
      const nm = save.relationships?.[r.id]?.role ?? r.id;
      out.push({
        label: `${nm} ${r.delta > 0 ? 'closer' : 'strained'}`,
        tone: r.delta > 0 ? 'good' : 'bad',
      });
    }
  }
  if (effects.flags) {
    if (!save.story) save.story = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
    for (const [k, v] of Object.entries(effects.flags)) {
      save.story.flags[k] = (save.story.flags[k] ?? 0) + v;
    }
  }
  if (effects.addSponsor) {
    const s: Sponsor = { id: `spon-${year}-${Math.floor(rng() * 1e6)}`, ...effects.addSponsor };
    if (!save.sponsors) save.sponsors = [];
    save.sponsors.push(s);
    if (s.signingBonus > 0) save.wallet = addCoins(save.wallet, s.signingBonus);
    out.push({ label: `Signed ${s.brand}`, tone: 'good' });
  }
  if (effects.captainClub) {
    save.captainClub = true;
    addTimeline(save, {
      year,
      kind: 'CAPTAINCY',
      text: `Named captain of ${save.userTeamId ? save.teams[save.userTeamId]?.name : 'the club'}.`,
    });
    out.push({ label: 'Named captain', tone: 'good' });
  }
  if (effects.unlockAchievement) unlockAchievement(save, effects.unlockAchievement);
  if (effects.timeline) {
    addTimeline(save, {
      year,
      kind: effects.timeline.kind,
      text: renderText(effects.timeline.text, save),
    });
  }
  if (
    effects.queueEvent &&
    save.story &&
    !save.story.pendingEventIds.includes(effects.queueEvent)
  ) {
    save.story.pendingEventIds.push(effects.queueEvent);
  }
  return out;
}

export function unlockAchievement(save: SaveGame, id: string): boolean {
  if (!save.achievements) save.achievements = [];
  if (save.achievements.includes(id)) return false;
  save.achievements.push(id);
  return true;
}

/* ---------------- Event selection ---------------- */

function triggersMatch(ev: StoryEvent, trigger: StoryTrigger): boolean {
  return Array.isArray(ev.trigger) ? ev.trigger.includes(trigger) : ev.trigger === trigger;
}

function choiceAvailable(save: SaveGame, choice: StoryChoice): boolean {
  if (!choice.requiresFlag) return true;
  const v = save.story?.flags[choice.requiresFlag.key] ?? 0;
  if (choice.requiresFlag.min != null && v < choice.requiresFlag.min) return false;
  if (choice.requiresFlag.max != null && v > choice.requiresFlag.max) return false;
  return true;
}

export function availableChoices(save: SaveGame, event: StoryEvent): StoryChoice[] {
  const list = event.choices.filter((c) => choiceAvailable(save, c));
  return list.length ? list : event.choices;
}

/** All events eligible to fire for a context (respecting `once`, conditions). */
export function eligibleEvents(events: StoryEvent[], ctx: StoryContext): StoryEvent[] {
  const seen = new Set(ctx.save.story?.seenEventIds ?? []);
  return events.filter((ev) => {
    if (!triggersMatch(ev, ctx.trigger)) return false;
    if (ev.once && seen.has(ev.id)) return false;
    if (ev.condition && !ev.condition(ctx)) return false;
    return true;
  });
}

/** Pick one eligible event (priority first, then weighted-random). */
export function pickEvent(
  events: StoryEvent[],
  ctx: StoryContext,
  rng: Rng,
): StoryEvent | undefined {
  const pool = eligibleEvents(events, ctx);
  if (!pool.length) return undefined;
  const maxPriority = Math.max(...pool.map((e) => e.priority ?? 0));
  const top = pool.filter((e) => (e.priority ?? 0) === maxPriority);
  const total = top.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rng() * total;
  for (const e of top) {
    r -= e.weight ?? 1;
    if (r <= 0) return e;
  }
  return top[top.length - 1];
}

export function markSeen(save: SaveGame, eventId: string): void {
  if (!save.story) save.story = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
  if (!save.story.seenEventIds.includes(eventId)) save.story.seenEventIds.push(eventId);
  save.story.pendingEventIds = save.story.pendingEventIds.filter((id) => id !== eventId);
}
