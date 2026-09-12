import type { FieldShotTone } from './fieldGeometry';

/** Presentation only: no generated commentary or inferred cricket outcomes. */
export function deliveryCaption(
  shot?: {
    tone: FieldShotTone;
    runs?: number;
    delivery?: string;
    shot?: string;
    dismissalType?: string;
  } | null,
): { mark: string; title: string; detail: string } {
  if (!shot)
    return { mark: '•', title: 'Ready at the crease', detail: 'Bowling from the bottom end' };
  const readable = (value?: string) => (value ?? '').replace(/_/g, ' ').toLowerCase();
  const detail = [readable(shot.delivery), readable(shot.shot)].filter(Boolean).join(' · ');
  if (shot.tone === 'wicket')
    return { mark: 'W', title: 'Wicket', detail: readable(shot.dismissalType) || detail };
  if (shot.tone === 'six') return { mark: '6', title: 'Over the rope', detail };
  if (shot.tone === 'four') return { mark: '4', title: 'Boundary', detail };
  if (shot.tone === 'extra') return { mark: '+', title: 'Extras', detail };
  const runs = shot.runs ?? 0;
  return {
    mark: runs > 0 ? String(runs) : '•',
    title: runs > 0 ? `${runs} ${runs === 1 ? 'run' : 'runs'}` : 'Dot ball',
    detail,
  };
}

/** Sprite bounds already scale with the field: don't multiply by field size twice. */
export function cricketerScale(role: 'fielder' | 'batter' | 'bowler' | 'keeper'): number {
  return role === 'fielder' ? 0.98 : role === 'keeper' ? 1.08 : 1.16;
}

export function visualRunningCount(shot?: { tone: FieldShotTone; runs?: number } | null): number {
  if (!shot || (shot.tone !== 'normal' && shot.tone !== 'extra')) return 0;
  return Math.max(0, Math.min(3, Math.floor(shot.runs ?? 0)));
}
