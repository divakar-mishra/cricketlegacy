/**
 * Haptics wrapper. Honours the user's `haptics` setting and never throws
 * (Taptic engine is unavailable on web, in low-power mode, etc.).
 */
import * as Haptics from 'expo-haptics';
import { useSettings } from '../state/settingsStore';

function enabled(): boolean {
  try {
    return useSettings.getState().haptics;
  } catch {
    return false;
  }
}

export function impact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): void {
  if (!enabled()) return;
  Haptics.impactAsync(style).catch(() => {});
}

export function notify(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): void {
  if (!enabled()) return;
  Haptics.notificationAsync(type).catch(() => {});
}

export function selection(): void {
  if (!enabled()) return;
  Haptics.selectionAsync().catch(() => {});
}

export type HapticType =
  | 'selection'
  | 'impact-light'
  | 'impact-medium'
  | 'impact-heavy'
  | 'notify-success'
  | 'notify-warning'
  | 'notify-error';

/** Single gated entry point for screens and ceremonies. */
export function playHaptic(type: HapticType): void {
  switch (type) {
    case 'impact-light':
      impact(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'impact-heavy':
      impact(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'impact-medium':
      impact(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'notify-warning':
      notify(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'notify-error':
      notify(Haptics.NotificationFeedbackType.Error);
      break;
    case 'notify-success':
      notify(Haptics.NotificationFeedbackType.Success);
      break;
    case 'selection':
    default:
      selection();
      break;
  }
}

export const ImpactStyle = Haptics.ImpactFeedbackStyle;
export const NotifyType = Haptics.NotificationFeedbackType;
