import type { BallEvent } from '../domain/types';
import type { MusicScene } from './music';

export function matchMusicScene(phase: string, won?: boolean): MusicScene {
  if (phase === 'live' || phase === 'saving' || phase === 'save-error') return 'MATCH_LIVE';
  if (phase === 'prematch') return 'MATCH_CALM';
  if (phase === 'done') return won ? 'VICTORY' : 'DEFEAT';
  return 'MENU';
}

/** Audio follows the delivery outcome, independently of cinematic speed. */
export function deliveryMoment(event: Pick<BallEvent, 'outcome' | 'isWicket' | 'shot'>) {
  if (event.isWicket) return 'wicket';
  switch (event.outcome) {
    case '6': return 'six';
    case '4': return 'four';
    case '1':
    case '2':
    case '3': return 'bat';
    case 'DOT': return event.shot && event.shot !== 'LEAVE' ? 'bat' : null;
    default: return null;
  }
}
