export interface ModalViewportMetrics {
  availableHeight: number;
  verticalMargin: number;
}

/**
 * Keep a centred modal inside the usable window, even in a very short
 * landscape or split-screen viewport. The preferred margin shrinks before the
 * card is allowed to exceed the safe area.
 */
export function modalViewportMetrics(
  windowHeight: number,
  topInset: number,
  bottomInset: number,
  preferredMargin: number,
): ModalViewportMetrics {
  const safeHeight = Math.max(1, windowHeight - Math.max(0, topInset) - Math.max(0, bottomInset));
  const verticalMargin = Math.min(Math.max(0, preferredMargin), Math.max(0, (safeHeight - 1) / 2));

  return {
    availableHeight: Math.max(1, safeHeight - verticalMargin * 2),
    verticalMargin,
  };
}
