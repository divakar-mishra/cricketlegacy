import type { NewspaperStory, SaveGame } from '../domain/types';
import {
  newspaperTemplatesFor,
  type NewspaperPlaceholder,
  type NewspaperTemplate,
  type NewspaperTemplateCategory,
} from '../content/newspaperTemplates';

export type NewspaperFactMap = Partial<Record<NewspaperPlaceholder, string>>;

export interface RenderedNewspaperTemplate {
  template: NewspaperTemplate;
  headline: string;
  deck: string;
  body: string;
}

const RAW_PLACEHOLDER = /\[[A-Z_]+\]/;
const TEMPLATE_PLACEHOLDER = /\[([A-Z_]+)\]([’'][sS])?/g;

export function newspaperPossessive(value: string): string {
  return /s$/i.test(value) ? `${value}’` : `${value}’s`;
}

function renderCopy(copy: string, facts: NewspaperFactMap): string | null {
  const rendered = copy.replace(
    TEMPLATE_PLACEHOLDER,
    (raw, key: NewspaperPlaceholder, possessiveSuffix: string | undefined) => {
      const value = facts[key]?.trim();
      if (!value) return raw;
      return possessiveSuffix ? newspaperPossessive(value) : value;
    },
  );
  return RAW_PLACEHOLDER.test(rendered) ? null : rendered;
}

/** Render only when every fact required by the immutable template is verified. */
export function renderNewspaperTemplate(
  template: NewspaperTemplate,
  facts: NewspaperFactMap,
): RenderedNewspaperTemplate | null {
  if (template.requiredPlaceholders.some((placeholder) => !facts[placeholder]?.trim())) {
    return null;
  }
  const headline = renderCopy(template.headline, facts);
  const deck = renderCopy(template.deck, facts);
  const body = renderCopy(template.body, facts);
  if (!headline || !deck || !body) return null;
  return { template, headline, deck, body };
}

export function normalizeNewspaperHeadline(headline: string): string {
  return headline
    .normalize('NFKD')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function recentStoriesWithTemplateId(save: SaveGame, count: number): NewspaperStory[] {
  return (save.experience?.mediaScrapbook ?? [])
    .filter((story) => Boolean(story.templateId))
    .slice(-count);
}

function recentStoriesWithHeadlineFamily(save: SaveGame, count: number): NewspaperStory[] {
  return (save.experience?.mediaScrapbook ?? [])
    .filter((story) => Boolean(story.headlineFamily))
    .slice(-count);
}

/**
 * Deterministic selection with five-template and three-family history windows.
 * Fact eligibility is never relaxed; family history relaxes before exact IDs.
 */
export function selectNewspaperTemplate(
  save: SaveGame,
  storyMatchId: string,
  category: NewspaperTemplateCategory,
  facts: NewspaperFactMap,
): RenderedNewspaperTemplate | null {
  let eligible = newspaperTemplatesFor(category)
    .map((template) => renderNewspaperTemplate(template, facts))
    .filter((item): item is RenderedNewspaperTemplate => item !== null)
    .sort((left, right) => left.template.id.localeCompare(right.template.id));
  if (eligible.length === 0) return null;

  const previousHeadline = save.experience?.mediaScrapbook?.at(-1)?.headline;
  if (previousHeadline) {
    const normalizedPrevious = normalizeNewspaperHeadline(previousHeadline);
    const withoutImmediateDuplicate = eligible.filter(
      (item) => normalizeNewspaperHeadline(item.headline) !== normalizedPrevious,
    );
    if (withoutImmediateDuplicate.length > 0) eligible = withoutImmediateDuplicate;
  }

  const recentFive = recentStoriesWithTemplateId(save, 5);
  const recentThree = recentStoriesWithHeadlineFamily(save, 3);
  const exactHistory = recentFive.map((story) => story.templateId!);
  const familyHistory = new Set(recentThree.map((story) => story.headlineFamily!));

  let candidates = eligible.filter(
    (item) =>
      !exactHistory.includes(item.template.id) && !familyHistory.has(item.template.headlineFamily),
  );

  // First relaxation: keep exact-template protection, permit a recent family.
  if (candidates.length === 0) {
    candidates = eligible.filter((item) => !exactHistory.includes(item.template.id));
  }

  // Final relaxation: remove exact history from oldest to newest.
  if (candidates.length === 0) {
    const remainingHistory = [...exactHistory];
    while (candidates.length === 0 && remainingHistory.length > 0) {
      remainingHistory.shift();
      const blocked = new Set(remainingHistory);
      candidates = eligible.filter((item) => !blocked.has(item.template.id));
    }
  }

  if (candidates.length === 0) return null;
  const index = stableHash(`${save.id}${storyMatchId}${category}`) % candidates.length;
  return candidates[index];
}

export function hasRawNewspaperPlaceholder(value: string): boolean {
  return RAW_PLACEHOLDER.test(value);
}
