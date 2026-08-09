/**
 * Unified "juice" entry point: one call plays the right SFX + haptic for a
 * match moment. Both layers independently respect their settings toggles.
 */
import * as haptics from './haptics';
import * as music from './music';
import * as sfx from './sfx';

export { haptics, music };
export { setMusicEnabled, syncMusicWithSettings } from './music';
export { playHaptic } from './haptics';

type Moment =
  | 'tap'
  | 'four'
  | 'six'
  | 'wicket'
  | 'fifty'
  | 'hundred'
  | 'win'
  | 'crowd'
  | 'coin'
  | 'phone'
  | 'trophy'
  | 'defeat'
  | 'reward';

export function moment(kind: Moment): void {
  switch (kind) {
    case 'four':
      sfx.play('four');
      haptics.impact(haptics.ImpactStyle.Light);
      break;
    case 'six':
      sfx.play('six');
      setTimeout(() => sfx.play('crowd'), 70);
      haptics.impact(haptics.ImpactStyle.Heavy);
      break;
    case 'wicket':
      sfx.play('wicket');
      haptics.notify(haptics.NotifyType.Warning);
      break;
    case 'fifty':
      sfx.play('fifty');
      haptics.notify(haptics.NotifyType.Success);
      break;
    case 'hundred':
      sfx.play('hundred');
      haptics.notify(haptics.NotifyType.Success);
      break;
    case 'win':
      sfx.play('win');
      haptics.notify(haptics.NotifyType.Success);
      break;
    case 'crowd':
      sfx.play('crowd');
      break;
    case 'coin':
      sfx.play('coin');
      setTimeout(() => sfx.play('tap'), 85);
      haptics.selection();
      break;
    case 'phone':
      sfx.play('phone');
      haptics.selection();
      break;
    case 'trophy':
      sfx.play('trophy');
      setTimeout(() => sfx.play('coin'), 90);
      setTimeout(() => sfx.play('phone'), 190);
      haptics.notify(haptics.NotifyType.Success);
      break;
    case 'defeat':
      sfx.play('defeat');
      setTimeout(() => sfx.play('tap'), 150);
      haptics.notify(haptics.NotifyType.Warning);
      break;
    case 'reward':
      sfx.play('coin');
      setTimeout(() => sfx.play('phone'), 110);
      haptics.notify(haptics.NotifyType.Success);
      break;
    case 'tap':
    default:
      sfx.play('tap');
      haptics.selection();
      break;
  }
}
