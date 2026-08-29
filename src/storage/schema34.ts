import type { SaveGame } from '../domain/types';
import { NEWSPAPER_TEMPLATES } from '../content/newspaperTemplates';

const TEMPLATE_BY_ID = new Map(
  NEWSPAPER_TEMPLATES.map((template) => [template.id, template] as const),
);
const OPTIONAL_TEXT = [
  'teamName',
  'teamScore',
  'opponentScore',
  'resultLine',
  'competitionName',
  'venueName',
] as const;

/** Preserve legacy rendered copy while validating only newly optional metadata. */
export function synchronizeSchema34State(save: SaveGame): void {
  for (const story of save.experience?.mediaScrapbook ?? []) {
    const mutable = story as unknown as Record<string, unknown>;
    const template =
      typeof mutable.templateId === 'string' ? TEMPLATE_BY_ID.get(mutable.templateId) : undefined;
    if (mutable.templateId !== undefined) {
      if (!template) {
        delete mutable.templateId;
      }
    }
    if (
      mutable.newspaperCategory !== undefined &&
      mutable.newspaperCategory !== template?.category
    ) {
      delete mutable.newspaperCategory;
    }
    if (
      mutable.headlineFamily !== undefined &&
      mutable.headlineFamily !== template?.headlineFamily
    ) {
      delete mutable.headlineFamily;
    }
    for (const field of OPTIONAL_TEXT) {
      if (
        mutable[field] !== undefined &&
        (typeof mutable[field] !== 'string' || !mutable[field].trim())
      ) {
        delete mutable[field];
      }
    }
  }
}
