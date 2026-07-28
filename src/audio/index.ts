/**
 * Unified "juice" entry point: one call plays the right SFX + haptic for a
 * match moment. Both layers independently respect their settings toggles.
 */
import * as haptics from './haptics';
import * as music from './music';
import * as sfx from './sfx';

export { sfx, haptics, music };
export { setMusicEnabled, syncMusicWithSettings, isMusicPlaying } from './music';
export { playHaptic } from './haptics';
export type { HapticType } from './haptics';
export type { SfxKey } from './sfx';

export type Moment = 'tap' | 'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'win' | 'crowd';

export function moment(kind: Moment): void {
  switch (kind) {
    case 'four':
      sfx.play('four');
      haptics.impact(haptics.ImpactStyle.Light);
      break;
    case 'six':
      sfx.play('six');
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
    case 'tap':
    default:
      sfx.play('tap');
      haptics.selection();
      break;
  }
}
