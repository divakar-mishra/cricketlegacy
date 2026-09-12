import type { BallEvent } from '../domain/types';
import { CELEBRATIONS } from '../data/cosmetics';

export type CelebrationMotion = 'rise' | 'rain' | 'burst' | 'orbit' | 'sweep';
export const CELEBRATION_MOTIONS: Readonly<Record<string, CelebrationMotion>> = {
  cel_wave: 'sweep', cel_fist: 'burst', cel_helmet: 'rise', cel_sky: 'rise',
  cel_dance: 'orbit', cel_legend: 'sweep', pass_celebration_lights: 'rise',
  pass_celebration_rainmaker: 'rain', pass_celebration_wave: 'sweep',
  pass_celebration_crest: 'rise', pass_celebration_pulse: 'burst',
  pass_celebration_ice: 'rain', pass_celebration_crown: 'rise',
  pass_celebration_startrail: 'orbit', pass_celebration_dust: 'sweep',
  pass_celebration_lightsout: 'orbit', pass_celebration_fireworks: 'burst',
  pass_celebration_numberone: 'rise', pass_celebration_legacy: 'sweep',
};

export function celebrationAppearance(id?: string) {
  const item = CELEBRATIONS.find(option => option.id === id);
  if (!item || !Object.hasOwn(CELEBRATION_MOTIONS, item.id)) return undefined;
  return { id: item.id, label: item.label, icon: item.previewIcon!, color: item.previewAccent!, motion: CELEBRATION_MOTIONS[item.id] };
}

/** Positive personal moments only. Run-outs are not credited to the bowler. */
export function personalCelebrationId(input: {
  mode?: string;
  playerId?: string;
  equippedId?: string;
  event: Pick<BallEvent, 'strikerId' | 'bowlerId' | 'outcome' | 'isWicket' | 'dismissal'>;
  milestonePlayerId?: string;
}): string | undefined {
  const { mode, playerId, equippedId, event, milestonePlayerId } = input;
  if (mode !== 'career' || !playerId || !celebrationAppearance(equippedId)) return undefined;
  if (milestonePlayerId) return milestonePlayerId === playerId ? equippedId : undefined;
  if (event.isWicket) {
    const bowlerWicket = event.dismissal && event.dismissal.type !== 'RUN_OUT' && event.bowlerId === playerId;
    const fieldingWicket = event.dismissal?.fielderId === playerId;
    return bowlerWicket || fieldingWicket ? equippedId : undefined;
  }
  return event.strikerId === playerId && (event.outcome === '4' || event.outcome === '6') ? equippedId : undefined;
}
