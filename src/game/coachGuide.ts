export type GuideStep = {
  target: string;
  title: string;
  body: string;
  /** Only an actual successful control action completes an action step. */
  action?: string;
  /** Required creation fields cannot be bypassed with the coach's Next button. */
  required?: boolean;
};

export type GuideRect = { x: number; y: number; width: number; height: number };
export const guidePrefix = (chapter: string) => `coach-v1:${chapter}:`;
export const guideStepKey = (chapter: string, target: string) => `${guidePrefix(chapter)}${target}`;
export const guideSkipKey = (chapter: string) => `coach-v1:skip:${chapter.split('.')[0]}`;
export function firstGuideStep(
  chapter: string,
  steps: readonly GuideStep[],
  done: readonly string[],
) {
  const index = steps.findIndex((step) => !done.includes(guideStepKey(chapter, step.target)));
  return index < 0 ? steps.length : index;
}

/** A creation guide may scroll inside a tall choice list, never past that step. */
export function guideScrollRange(top: number, height: number, viewport: number, maxOffset: number) {
  const min = Math.max(0, Math.min(maxOffset, top - 12));
  const max = Math.max(min, Math.min(maxOffset, top + height - viewport + 12));
  return { min, max };
}

/** Window-local coordinates; never put the coach card over the actual control. */
export function guidePlacement(
  target: GuideRect,
  width: number,
  height: number,
  cardHeight: number,
  topInset = 0,
  bottomInset = 0,
) {
  const gap = 12;
  const top = Math.max(gap, topInset);
  const bottom = Math.max(top, height - bottomInset - gap);
  const rect = {
    x: Math.max(0, target.x - 4),
    y: Math.max(top, target.y - 4),
    width: Math.min(width, target.width + 8),
    height: target.height + 8,
  };
  rect.width = Math.max(0, Math.min(rect.width, width - rect.x));
  rect.height = Math.max(0, Math.min(target.y + target.height + 4, bottom) - rect.y);
  const below = Math.max(0, bottom - (rect.y + rect.height) - gap);
  const above = Math.max(0, rect.y - top - gap);
  const side = below >= Math.min(cardHeight, 220) || below >= above ? 'below' : 'above';
  const available = side === 'below' ? below : above;
  const actualHeight = Math.min(cardHeight, available);
  return {
    rect,
    side,
    maxHeight: available,
    cardY: side === 'below' ? rect.y + rect.height + gap : rect.y - gap - actualHeight,
    arrowX: Math.max(24, Math.min(width - 24, rect.x + rect.width / 2)),
  };
}

type GuideActionListener = (action: string) => void;
const listeners = new Set<GuideActionListener>();
/** UI signals only: never purchases, spends currency, changes a save or simulates a result. */
export function guideAction(action: string) {
  listeners.forEach((listener) => listener(action));
}
export function subscribeGuideActions(listener: GuideActionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
