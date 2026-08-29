/**
 * Ties the narrative engine (game/narrative.ts) to real gameplay moments:
 * queues story events after matches / at milestones / on season rollover,
 * resolves the player's choices, and runs the sponsor/endorsement economy.
 */
import { STORY_EVENTS } from '../content/storyEvents';
import { Player, RelationshipMemory, SaveGame } from '../domain/types';
import { makeRng, Rng } from '../engine/rng';
import {
  careerTier,
  PLAYER_RETIREMENT_OPTIONAL_AGE,
  playerRetirementAssessment,
  TIER_LABEL,
} from './career';
import { archetypeLegacyEnding } from './careerArchetypes';
import {
  AppliedEffect,
  applyEffects,
  availableChoices,
  addTimeline,
  ensureCareerDepth,
  markSeen,
  pickEvent,
  renderText,
  StoryContext,
  StoryEvent,
  StoryTrigger,
} from './narrative';

const DEFERRED_STORY_KEY = '__deferred_story_event_ids';

function deferredStoryIds(save: SaveGame): string[] {
  const raw = save.story?.strings?.[DEFERRED_STORY_KEY];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeDeferredStoryIds(save: SaveGame, ids: string[]): void {
  if (!save.story) return;
  save.story.strings ??= {};
  if (ids.length > 0) save.story.strings[DEFERRED_STORY_KEY] = JSON.stringify(ids);
  else delete save.story.strings[DEFERRED_STORY_KEY];
}

/** Repair old saves that accumulated several optional youth stories at once. */
export function normalizePendingStoryQueue(save: SaveGame): void {
  ensureCareerDepth(save);
  if (!save.story || save.story.pendingEventIds.length <= 1) return;
  const [current, ...overflow] = save.story.pendingEventIds;
  const deferred = [...deferredStoryIds(save), ...overflow].filter(
    (id, index, all) => id !== current && all.indexOf(id) === index,
  );
  save.story.pendingEventIds = [current];
  writeDeferredStoryIds(save, deferred);
}

/** Release at most one preserved story after a later match, never immediately. */
export function releaseDeferredStoryAfterMatch(save: SaveGame): boolean {
  normalizePendingStoryQueue(save);
  if (!save.story || save.story.pendingEventIds.length > 0) return false;
  const deferred = deferredStoryIds(save);
  const next = deferred.shift();
  if (!next) return false;
  save.story.pendingEventIds.push(next);
  writeDeferredStoryIds(save, deferred);
  return true;
}

function currentYear(save: SaveGame): number {
  return (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ?? 2026;
}

function baseContext(save: SaveGame, trigger: StoryTrigger): StoryContext | null {
  if (!save.userPlayerId) return null;
  const user = save.players[save.userPlayerId];
  if (!user) return null;
  return { trigger, save, user, year: currentYear(save), tier: TIER_LABEL[careerTier(save, user)] };
}

/** Queue at most one event for a trigger (respecting once/conditions/weights). */
export function queueStoryForTrigger(
  save: SaveGame,
  trigger: StoryTrigger,
  rng: Rng,
  extra?: Partial<StoryContext>,
): boolean {
  ensureCareerDepth(save);
  normalizePendingStoryQueue(save);
  // Youth matchday deliberately remains playable while a story is waiting.
  // Do not let one unresolved beat grow into a four-card backlog across the
  // next fixtures; story chains can still queue their single direct follow-up.
  if ((save.story?.pendingEventIds.length ?? 0) > 0 || deferredStoryIds(save).length > 0) {
    return true;
  }
  const ctx = baseContext(save, trigger);
  if (!ctx) return false;
  Object.assign(ctx, extra);
  const ev = pickEvent(STORY_EVENTS, ctx, rng);
  if (!ev) return false;
  if (!save.story!.pendingEventIds.includes(ev.id)) save.story!.pendingEventIds.push(ev.id);
  if (ev.id.startsWith('pass_monthly_player_') && ev.id.endsWith('_opening')) {
    save.seasonPassExperience!.playerStoryCycleId = save.pass!.seasonId;
  }
  return true;
}

export interface MatchStoryInput {
  rating: number;
  runs: number;
  wickets: number;
  won: boolean;
  selected: boolean;
  milestone?: 'FIFTY' | 'HUNDRED' | 'FIVEFER' | 'POTM';
}

/**
 * After a match, possibly surface a story beat. Milestones/being dropped always
 * fire; ordinary matches fire ~55% of the time so the inbox never feels spammy.
 * Tries the most specific trigger first, falling back to generic life events.
 */
export function maybeQueueMatchStory(save: SaveGame, input: MatchStoryInput, rng: Rng): boolean {
  ensureCareerDepth(save);
  save.seasonRatings = [...(save.seasonRatings ?? []), input.rating];

  const extra: Partial<StoryContext> = {
    rating: input.rating,
    runs: input.runs,
    wickets: input.wickets,
    won: input.won,
    selected: input.selected,
    milestone: input.milestone,
  };

  const order: StoryTrigger[] = [];
  if (input.milestone) order.push('MILESTONE');
  if (!input.selected) order.push('DROPPED');
  if (input.rating >= 7.5) order.push('GOOD_MATCH');
  if (input.rating < 4.5) order.push('BAD_MATCH');
  order.push('POST_MATCH');

  const guaranteed = Boolean(input.milestone) || !input.selected;
  if (!guaranteed && rng() > 0.55) {
    // Sometimes a quiet, generic life event instead of nothing.
    if (rng() > 0.5) return queueStoryForTrigger(save, 'IDLE', rng, extra);
    return false;
  }

  for (const t of order) {
    if (queueStoryForTrigger(save, t, rng, extra)) return true;
  }
  // Nothing specific matched — try a life event.
  return queueStoryForTrigger(save, 'IDLE', rng, extra);
}

/* ---------------- Reading & resolving ---------------- */

export interface RenderedEvent {
  event: StoryEvent;
  title: string;
  speaker?: string;
  body: string;
  choices: { id: string; label: string; desc?: string }[];
}

export function findEvent(id: string): StoryEvent | undefined {
  return STORY_EVENTS.find((e) => e.id === id);
}

/** The next queued event, fully rendered for the UI (or null if the inbox is empty). */
export function nextPendingEvent(save: SaveGame): RenderedEvent | null {
  const id = save.story?.pendingEventIds[0];
  if (!id) return null;
  const event = findEvent(id);
  if (!event) {
    // Stale id (content changed) — drop it.
    if (save.story) save.story.pendingEventIds = save.story.pendingEventIds.filter((x) => x !== id);
    return null;
  }
  return {
    event,
    title: renderText(event.title, save),
    speaker: event.speaker ? renderText(event.speaker, save) : undefined,
    body: renderText(event.body, save),
    choices: availableChoices(save, event).map((c) => ({
      id: c.id,
      label: renderText(c.label, save),
      desc: c.desc ? renderText(c.desc, save) : undefined,
    })),
  };
}

export function pendingEventCount(save: SaveGame): number {
  return save.story?.pendingEventIds.length ?? 0;
}

export interface ChoiceResult {
  ok: boolean;
  resultText?: string;
  applied?: AppliedEffect[];
}

/** Apply a chosen option: mutate the save, record the beat, advance the inbox. */
export function resolveStoryChoice(
  save: SaveGame,
  eventId: string,
  choiceId: string,
  rng: Rng,
): ChoiceResult {
  const event = findEvent(eventId);
  if (!event) return { ok: false };
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false };

  const applied = applyEffects(save, choice.effects, currentYear(save), rng);
  const resultText = renderText(choice.resultText, save);
  if (choice.effects.relationship?.length) {
    const memories = (save.experience ??= {}).relationshipMemories ?? [];
    for (const effect of choice.effects.relationship) {
      const relationship = save.relationships?.[effect.id];
      if (!relationship) continue;
      const consequence =
        effect.id === 'selector'
          ? 'This now affects selection patience and reputation gains.'
          : effect.id === 'agent'
            ? 'This now affects future contract terms.'
            : effect.id === 'coach'
              ? 'This now affects selection patience and contract support.'
              : effect.id === 'captain'
                ? 'This will shape future dressing-room events.'
                : effect.id === 'rival'
                  ? 'This rivalry will return in future career events.'
                  : 'This relationship will be remembered in future events.';
      const memory: RelationshipMemory = {
        id: `${eventId}:${choiceId}:${effect.id}:${memories.length}`,
        characterId: effect.id,
        characterName: relationship.name,
        role: relationship.role,
        summary: `${renderText(event.title, save)}: ${resultText}`,
        season: currentYear(save),
        createdAt: Date.now(),
        delta: effect.delta,
        consequence,
      };
      memories.unshift(memory);
    }
    if (memories.length > 40) memories.length = 40;
    (save.experience ??= {}).relationshipMemories = memories;
  }
  addTimeline(save, {
    year: currentYear(save),
    kind: 'STORY',
    text: `${renderText(event.title, save)}: ${resultText}`,
  });
  markSeen(save, eventId);
  return { ok: true, resultText, applied };
}

/**
 * On season rollover: tick down deals, drop any whose form/integrity terms are
 * broken, and reset the per-season rating log.
 */
export function rolloverSponsors(save: SaveGame): { expired: string[]; lost: string[] } {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const expired: string[] = [];
  const lost: string[] = [];
  const kept = (save.sponsors ?? []).filter((sp) => {
    if (sp.requiresIntegrity && (save.integrity ?? 80) < 45) {
      lost.push(sp.brand);
      return false;
    }
    if (sp.minForm != null && user && (user.meta.form ?? 60) < sp.minForm) {
      lost.push(sp.brand);
      return false;
    }
    sp.seasonsLeft -= 1;
    if (sp.seasonsLeft <= 0) {
      expired.push(sp.brand);
      return false;
    }
    return true;
  });
  save.sponsors = kept;
  save.seasonRatings = [];
  return { expired, lost };
}

/* ---------------- Retirement & New Game+ ---------------- */

export function canRetire(user: Player): boolean {
  return user.age >= PLAYER_RETIREMENT_OPTIONAL_AGE;
}

export function shouldPromptRetirement(user: Player, save?: SaveGame): boolean {
  return save
    ? playerRetirementAssessment(save).recommended || Boolean(save.flags.playerRetirementRecommended)
    : canRetire(user) && user.overall <= 62;
}

/**
 * The 0..100 "legacy score" of the user's career, plus its component parts.
 * This is what the Legacy Meter shows AND what is carried forward into a New
 * Game+ protégé's head-start (see createCareerSave), so the two always agree.
 */
export function careerLegacyScore(save: SaveGame): {
  score: number;
  runs: number;
  wkts: number;
  titles: number;
  caps: number;
} {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const cs = user?.careerStats;
  const runs = Math.min(100, Math.round(((cs?.runs ?? 0) / 5000) * 100));
  const wkts = Math.min(100, Math.round(((cs?.wickets ?? 0) / 200) * 100));
  const titles = Math.min(100, (save.records?.titles?.length ?? 0) * 25);
  const caps = Math.min(100, Math.round(((save.userCaps ?? 0) / 50) * 100));
  const score = Math.round((runs + wkts + titles + caps) / 4);
  return { score, runs, wkts, titles, caps };
}

/** A career-summary line for the retirement / Hall-of-Fame screen. */
export function careerEpitaph(save: SaveGame): string {
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (!user) return '';
  const cs = user.careerStats;
  const caps = save.userCaps ?? 0;
  const runs = cs?.runs ?? 0;
  const wkts = cs?.wickets ?? 0;
  const bits = [`${runs} runs`, `${wkts} wickets`, `${caps} caps`];
  return `${bits.join(' \u00b7 ')}. ${archetypeLegacyEnding(save, user)}.`;
}

/** Deterministic rng for a save at a given salt (keeps story beats reproducible). */
export function storyRng(save: SaveGame, salt: number): Rng {
  let h = 2166136261 >>> 0;
  const s = `${save.id}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return makeRng(h >>> 0);
}
